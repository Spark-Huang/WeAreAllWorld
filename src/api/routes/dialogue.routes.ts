/**
 * 对话路由
 * 
 * 设计：
 * 1. 对话时快速响应，只记录消息和快速判定
 * 2. 每15分钟批量 LLM 评估，补偿贡献值差异
 */

import { Router, Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';
import { qualityJudgeService } from '../../contribution-evaluation/services/quality-judge.service';
import { asyncQualityEvaluationService } from '../../contribution-evaluation/services/async-quality-evaluation.service';
import { LLMService } from '../../services/llm.service';

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
 */
router.post('/', async (req: Request, res: Response) => {
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
    
    // 1. 获取用户和AI伙伴信息
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
    
    // 2. 快速质量判定（关键词匹配）
    const quickResult = qualityJudgeService.calculateQuality(message);
    
    // 3. 获取或创建会话
    const sessionId = await getOrCreateSession(userId);
    
    // 4. 生成AI回复
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
    
    // 6. 快速更新贡献值（使用快速判定结果）
    await supabase.rpc('update_contribution', {
      p_user_id: userId,
      p_points: quickResult.points,
      p_category: quickResult.qualityType,
      p_data_rarity: quickResult.dataRarity,
      p_ai_understanding: { quick: true },
      p_message_hash: null
    });
    
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
      .select('id, category, granted_power, data_rarity, ai_understanding, created_at, llm_evaluated, llm_quality_type, llm_points')
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

export { router as dialogueRouter };