/**
 * 对话路由
 * 
 * 设计：
 * 1. 优先转发到用户的专属 OpenClaw Pod
 * 2. 如果没有专属 Pod，使用共享 LLM 服务
 * 3. 记录消息和质量判定
 */

import { Router, Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';
import { qualityJudgeService } from '../../contribution-evaluation/services/quality-judge.service';
import { asyncQualityEvaluationService } from '../../contribution-evaluation/services/async-quality-evaluation.service';
import { LLMService } from '../../services/llm.service';
import { getNewApiService } from '../../services/new-api.service';
import { getOpenClawProvisionService } from '../../services/openclaw-provision.service';
import { quotaCheckMiddleware } from '../middleware/quota-check.middleware';

const router: Router = Router();
const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY!;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const llmService = new LLMService();

// 会话超时时间（毫秒）- 5分钟无消息视为会话结束
const SESSION_TIMEOUT = 5 * 60 * 1000;

// 用户会话缓存
const userSessions = new Map<string, { sessionId: string; lastActivity: number }>();

/**
 * POST /api/v1/dialogue
 * 发送对话消息并获取AI回复
 * 
 * 优先级：
 * 1. 用户专属 OpenClaw Pod
 * 2. 共享 OpenClaw Pod
 * 3. 后备 LLM 服务
 */
router.post('/', quotaCheckMiddleware(1000), async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const { message } = req.body;
    
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    
    if (!message || typeof message !== 'string') {
      res.status(400).json({ error: 'Message is required' });
      return;
    }
    
    // 1. 检查用户是否有专属 OpenClaw Pod
    const openclawService = getOpenClawProvisionService();
    let openclawEndpoint: string | null = null;
    
    console.log(`[对话] OpenClaw Service: ${openclawService ? '已初始化' : 'null'}`);
    
    if (openclawService) {
      const instance = await openclawService.getInstance(userId);
      console.log(`[对话] 用户 ${userId} 实例:`, instance ? `${instance.podName} (${instance.status})` : 'null');
      if (instance && instance.status === 'running') {
        // 使用 Pod 内部地址 (OpenClaw Gateway 端口 18789)
        openclawEndpoint = `http://${instance.podName}.${instance.namespace}:18789`;
        console.log(`[对话] 用户 ${userId} 使用专属 Pod: ${instance.podName}`);
      }
    }
    
    // 2. 如果有专属 Pod，转发请求
    if (openclawEndpoint) {
      try {
        // OpenClaw 使用 WebSocket，这里先测试健康检查
        console.log(`[对话] 尝试连接: ${openclawEndpoint}/health`);
        const healthCheck = await fetch(`${openclawEndpoint}/health`, {
          signal: AbortSignal.timeout(5000)
        }).catch(err => {
          console.log(`[对话] 连接失败:`, err.message);
          return null;
        });
        
        if (healthCheck && healthCheck.ok) {
          console.log(`[对话] OpenClaw Pod 健康检查通过`);
          
          // 尝试通过 WebSocket 发送消息
          const { getOpenClawClientManager } = require('../../services/openclaw-websocket.service');
          const wsManager = getOpenClawClientManager();
          
          if (wsManager) {
            console.log(`[对话] 尝试 WebSocket 连接...`);
            const response = await wsManager.sendMessage(userId, openclawEndpoint, message);
            
            if (response.type !== 'error') {
              // 记录消息到数据库
              await recordMessage(userId, message, response.content);
              
              // 快速质量判定
              const quickResult = qualityJudgeService.calculateQuality(message);
              
              return res.json({
                success: true,
                data: {
                  aiReply: response.content,
                  qualityResult: quickResult,
                  source: 'dedicated-openclaw',
                  podName: openclawEndpoint.split('/')[2]
                }
              });
            } else {
              console.warn(`[对话] WebSocket 响应错误:`, response.content);
            }
          }
          
          // WebSocket 失败，使用后备 LLM 服务
          console.log(`[对话] WebSocket 不可用，使用后备 LLM`);
        }
      } catch (err) {
        console.warn(`[对话] 专属 Pod 请求失败，使用后备:`, err);
      }
    }
    
    // 3. 后备：使用现有的 LLM 服务
    console.log(`[对话] 用户 ${userId} 使用后备 LLM 服务`);
    
    // 获取用户和AI伙伴信息
    const { data: userData } = await supabase
      .from('users')
      .select('telegram_username')
      .eq('id', userId)
      .single();
    
    const { data: partner } = await supabase
      .from('ai_partners')
      .select('*')
      .eq('user_id', userId)
      .single();
    
    if (!partner) {
      res.status(404).json({ error: 'AI partner not found' });
      return;
    }
    
    // 快速质量判定
    const quickResult = qualityJudgeService.calculateQuality(message);
    
    // 获取或创建会话
    const sessionId = await getOrCreateSession(userId);
    
    // 生成AI回复
    const growthStage = getGrowthStage(partner.total_contribution);
    let aiReply = '';
    
    try {
      aiReply = await llmService.generatePartnerReply({
        userName: userData?.telegram_username || '用户',
        userMessage: message,
        partnerName: '小零',
        totalContribution: partner.total_contribution,
        growthStage,
        abilities: partner.abilities || {},
        conversationHistory: []
      });
    } catch (llmError) {
      console.error('LLM error:', llmError);
      aiReply = getFallbackReply(quickResult.qualityType);
    }
    
    // 5. 保存对话记录（包含原始消息，等待异步评估）
    await supabase
      .from('interaction_logs')
      .insert({
        user_id: userId,
        session_id: sessionId,
        category: quickResult.qualityType,
        granted_power: quickResult.points,
        data_rarity: quickResult.dataRarity,
        raw_message: message,
        raw_reply: aiReply,
        quick_quality_type: quickResult.qualityType,
        quick_points: quickResult.points,
        llm_evaluated: false,
        ai_understanding: {
          userMessage: message,
          aiReply,
          emotion: quickResult.emotionDetected,
          keyInfo: quickResult.keyInfo
        }
      });
    
    // 6. 快速更新贡献值（直接更新 ai_partners 表，避免 RPC 创建空记录）
    await supabase
      .from('ai_partners')
      .update({
        total_contribution: partner.total_contribution + quickResult.points,
        last_interaction_at: new Date().toISOString()
      })
      .eq('user_id', userId);
    
    res.json({
      success: true,
      data: {
        qualityResult: quickResult,
        aiReply,
        sessionId
      }
    });
  } catch (err) {
    console.error('Dialogue error:', err);
    res.status(500).json({ error: 'Failed to process dialogue' });
  }
});

/**
 * 获取或创建用户会话
 */
async function getOrCreateSession(userId: string): Promise<string> {
  const now = Date.now();
  const cached = userSessions.get(userId);
  
  // 检查是否有活跃会话
  if (cached && (now - cached.lastActivity) < SESSION_TIMEOUT) {
    // 更新最后活动时间
    cached.lastActivity = now;
    userSessions.set(userId, cached);
    return cached.sessionId;
  }
  
  // 如果有超时的会话，先结束它
  if (cached) {
    try {
      await asyncQualityEvaluationService.endSession(cached.sessionId);
    } catch (err) {
      console.error('结束旧会话失败:', err);
    }
  }
  
  // 创建新会话
  const sessionId = await asyncQualityEvaluationService.createSession(userId);
  userSessions.set(userId, { sessionId, lastActivity: now });
  
  console.log(`用户 ${userId} 创建新会话: ${sessionId}`);
  return sessionId;
}

/**
 * GET /api/v1/dialogue/history
 * 获取对话历史
 */
router.get('/history', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const limit = parseInt(req.query.limit as string) || 50;
    
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    
    const { data: logs, error } = await supabase
      .from('interaction_logs')
      .select('id, category, granted_power, data_rarity, ai_understanding, raw_message, raw_reply, created_at, llm_evaluated, llm_quality_type, llm_points')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);
    
    if (error) {
      throw error;
    }
    
    // 转换为对话历史格式
    const history = (logs || []).map(log => ({
      id: log.id,
      category: log.category,
      quickPoints: log.granted_power,
      llmEvaluated: log.llm_evaluated,
      llmQualityType: log.llm_quality_type,
      llmPoints: log.llm_points,
      rarity: log.data_rarity,
      understanding: log.ai_understanding,
      rawMessage: log.raw_message,
      rawReply: log.raw_reply,
      timestamp: log.created_at
    }));
    
    res.json({
      success: true,
      data: history
    });
  } catch (err) {
    console.error('Get dialogue history error:', err);
    res.status(500).json({ error: 'Failed to get dialogue history' });
  }
});

/**
 * GET /api/v1/dialogue/sessions
 * 获取用户的会话列表
 */
router.get('/sessions', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const limit = parseInt(req.query.limit as string) || 20;
    
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    
    const { data: sessions, error } = await supabase
      .from('dialogue_sessions')
      .select('*')
      .eq('user_id', userId)
      .order('started_at', { ascending: false })
      .limit(limit);
    
    if (error) {
      throw error;
    }
    
    res.json({
      success: true,
      data: sessions
    });
  } catch (err) {
    console.error('Get sessions error:', err);
    res.status(500).json({ error: 'Failed to get sessions' });
  }
});

/**
 * 获取成长阶段
 */
function getGrowthStage(points: number): string {
  if (points >= 500) return '觉醒期';
  if (points >= 200) return '成熟期';
  if (points >= 50) return '成长期';
  return '懵懂期';
}

/**
 * 降级回复（LLM不可用时）
 */
function getFallbackReply(qualityType: string): string {
  const replies: Record<string, string[]> = {
    special_memory: [
      '谢谢你和我分享这么重要的事，我会好好记住的 💫',
      '这真的很特别，我很开心你能告诉我这些 ✨',
      '这是一个美好的回忆呢，谢谢你愿意和我分享 🌟'
    ],
    deep_thought: [
      '你的想法很有深度，让我也思考了很多 🤔',
      '和你聊天总能让我学到新东西呢 💭',
      '这个问题很有意思，我们一起想想看 💫'
    ],
    experience: [
      '听起来是一段很棒的经历呢！ 📖',
      '谢谢你和我分享你的故事，我很喜欢听你说这些 ✨',
      '原来是这样呀，你的生活真有趣 🌈'
    ],
    emotion: [
      '我能感受到你的心情，谢谢你愿意和我分享 ❤️',
      '不管发生什么，我都会在这里陪着你的 💕',
      '你的感受对我来说很重要，谢谢你信任我 🌸'
    ],
    daily: [
      '嗯嗯，我在听呢～ 💬',
      '哈哈，有意思！还有呢？ ✨',
      '原来如此呀～ 😊'
    ],
    greeting: [
      '你好呀！今天过得怎么样？ 🌸',
      '嗨～见到你真开心！ ✨',
      '你来啦！我正想着你呢 💫'
    ]
  };
  
  const options = replies[qualityType] || replies.daily;
  return options[Math.floor(Math.random() * options.length)];
}

/**
 * 记录消息到数据库
 */
async function recordMessage(userId: string, message: string, reply: string): Promise<void> {
  try {
    const sessionId = await getOrCreateSession(userId);
    
    // 记录用户消息
    await supabase
      .from('interaction_logs')
      .insert({
        user_id: userId,
        session_id: sessionId,
        raw_message: message,
        raw_reply: reply,
        category: 'dialogue',
        granted_power: 0,
        data_rarity: '普通数据'
      });
  } catch (err) {
    console.error('记录消息失败:', err);
  }
}

export { router as dialogueRouter };