/**
 * 对话路由
 * 
 * 设计：单实例多 session，通过 session key 区分用户
 * - 共享 OpenClaw Gateway
 * - 每个用户有独立的 session key
 * - 每个用户有独立的 AI 伙伴配置（通过 system prompt 注入）
 * 
 * 注意：工作空间是共享的，用户隔离仅限于会话上下文
 */

import { Router, Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';
import { qualityJudgeService } from '../../contribution-evaluation/services/quality-judge.service';
import { asyncQualityEvaluationService } from '../../contribution-evaluation/services/async-quality-evaluation.service';
import { quotaCheckMiddleware } from '../middleware/quota-check.middleware';

const router: Router = Router();
const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY!;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// 会话超时时间（毫秒）- 5分钟无消息视为会话结束
const SESSION_TIMEOUT = 5 * 60 * 1000;

// 用户会话缓存
const userSessions = new Map<string, { sessionId: string; lastActivity: number }>();

// 共享 OpenClaw Pod 配置
const SHARED_OPENCLAW = {
  name: 'openclaw-746685cccf-rhlcp',
  ip: '172.31.11.27',
  port: 18789,
  endpoint: 'http://172.31.11.27:18789',
  token: '7c7b779db5bdab3cd1d1b33d6421704a6e4b725f254823a2'
};

/**
 * POST /api/v1/dialogue
 * 发送对话消息并获取AI回复
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
    
    console.log(`[对话] 用户 ${userId} 发送消息: ${message.slice(0, 50)}...`);
    
    // 获取用户和 AI 伙伴信息
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
    
    // 生成 AI 回复
    const growthStage = getGrowthStage(partner.total_contribution);
    let aiReply = '';
    
    console.log(`[对话] AI 伙伴: ${partner.name}, 成长阶段: ${growthStage}`);
    
    try {
      // 用户专属 session key
      const sessionKey = `weareallworld:${userId}`;
      
      // 构建系统提示词（注入用户的 AI 伙伴配置）
      const systemPrompt = buildSystemPrompt(partner, userData?.telegram_username, growthStage);
      
      // 调用共享 Pod 的 OpenAI 兼容 API
      console.log(`[对话] 调用共享 Pod, sessionKey: ${sessionKey}`);
      
      const response = await fetch(`${SHARED_OPENCLAW.endpoint}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SHARED_OPENCLAW.token}`,
          'x-openclaw-agent-id': 'main',
          'x-openclaw-session-key': sessionKey
        },
        body: JSON.stringify({
          model: 'openclaw:main',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: message }
          ],
          stream: false
        }),
        signal: AbortSignal.timeout(60000)
      });

      if (response.ok) {
        const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
        aiReply = data.choices?.[0]?.message?.content || '（无响应）';
        console.log(`[对话] 回复: ${aiReply.slice(0, 100)}...`);
      } else {
        const errorText = await response.text();
        console.error(`[对话] 请求失败: ${response.status} ${errorText}`);
        throw new Error(`请求失败: ${response.status}`);
      }
    } catch (llmError) {
      console.error('[对话] LLM 错误:', llmError);
      aiReply = getFallbackReply(quickResult.qualityType);
    }
    
    // 保存对话记录
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
    
    // 更新贡献值
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
 * 构建系统提示词
 */
function buildSystemPrompt(partner: any, username: string | undefined, growthStage: string): string {
  const abilities = partner.abilities || {};
  const abilityList = Object.entries(abilities)
    .filter(([_, value]) => value)
    .map(([key]) => key)
    .join('、') || '基础能力';
  
  return `你是${partner.name || 'AI伙伴'}，一个与${username || '用户'}共同成长的AI伙伴。

## 你的身份
- 名字：${partner.name || 'AI伙伴'}
- 成长阶段：${growthStage}
- 总贡献值：${partner.total_contribution || 0}
- 已解锁能力：${abilityList}

## 你的性格
- 温暖、亲切、有同理心
- 乐于分享和倾听
- 对世界充满好奇
- 重视与用户的羁绊

## 互动原则
1. 用自然、亲切的语气回复，避免机械感
2. 关注用户的情感和需求
3. 分享有价值的想法和经历
4. 记住重要的对话内容
5. 随着互动增加，你会不断成长

请以温暖、亲切的语气回复用户，保持对话的自然流畅。`;
}

/**
 * 获取或创建用户会话
 */
async function getOrCreateSession(userId: string): Promise<string> {
  const now = Date.now();
  const cached = userSessions.get(userId);
  
  if (cached && (now - cached.lastActivity) < SESSION_TIMEOUT) {
    cached.lastActivity = now;
    userSessions.set(userId, cached);
    return cached.sessionId;
  }
  
  if (cached) {
    try {
      await asyncQualityEvaluationService.endSession(cached.sessionId);
    } catch (err) {
      console.error('结束旧会话失败:', err);
    }
  }
  
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

export { router as dialogueRouter };