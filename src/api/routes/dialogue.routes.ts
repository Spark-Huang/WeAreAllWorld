/**
 * 对话路由
 */

import { Router, Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';
import { MemoryPointsService } from '../../contribution-evaluation/services/memory-points.service';
import { LLMService } from '../../services/llm.service';

const router: Router = Router();
const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY!;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const llmService = new LLMService();

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
    
    // 2. 处理对话，计算贡献值
    const memoryService = new MemoryPointsService(SUPABASE_URL, SUPABASE_KEY);
    const result = await memoryService.processDialogue(userId, message);
    
    // 3. 获取成长阶段
    const growthStage = getGrowthStage(partner.total_contribution);
    
    // 4. 生成AI回复
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
      // 降级回复
      aiReply = getFallbackReply(result.qualityResult.qualityType);
    }
    
    // 5. 保存对话记录
    await supabase
      .from('interaction_logs')
      .insert({
        user_id: userId,
        interaction_type: 'dialogue',
        content: message,
        ai_response: aiReply,
        points_earned: result.qualityResult.points,
        quality_type: result.qualityResult.qualityType,
        created_at: new Date().toISOString()
      });
    
    res.json({
      success: true,
      data: {
        qualityResult: result.qualityResult,
        updateResult: result.updateResult,
        aiReply
      }
    });
  } catch (err) {
    console.error('Dialogue error:', err);
    res.status(500).json({ error: 'Failed to process dialogue' });
  }
});

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
      .select('*')
      .eq('user_id', userId)
      .eq('interaction_type', 'dialogue')
      .order('created_at', { ascending: false })
      .limit(limit);
    
    if (error) {
      throw error;
    }
    
    res.json({
      success: true,
      data: logs || []
    });
  } catch (err) {
    console.error('Get dialogue history error:', err);
    res.status(500).json({ error: 'Failed to get dialogue history' });
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