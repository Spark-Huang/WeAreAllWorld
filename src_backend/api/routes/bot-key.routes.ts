/**
 * Bot Key 管理路由
 */

import { Router, Request, Response } from 'express';
import { BotKeyService } from '../../services/bot-key.service';

const router: Router = Router();

// 从环境变量获取 Supabase 配置
const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY!;

const botKeyService = new BotKeyService(SUPABASE_URL, SUPABASE_KEY);

/**
 * POST /api/v1/bot-key
 * 创建或更新 Bot Key
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const { bot_token, bot_name } = req.body;
    
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    
    if (!bot_token || typeof bot_token !== 'string') {
      res.status(400).json({ error: 'Bot Token 是必需的' });
      return;
    }
    
    const result = await botKeyService.upsertBotKey({
      user_id: userId,
      bot_token,
      bot_name
    });
    
    if (!result.success) {
      res.status(400).json({ error: result.error });
      return;
    }
    
    res.json({
      success: true,
      message: 'Bot Key 保存成功',
      data: {
        bot_username: result.data?.bot_username,
        bot_name: result.data?.bot_name,
        is_active: result.data?.is_active
      }
    });
  } catch (err) {
    console.error('Create/Update bot key error:', err);
    res.status(500).json({ error: '保存 Bot Key 失败' });
  }
});

/**
 * GET /api/v1/bot-key
 * 获取当前用户的 Bot Key 信息
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    
    const botKey = await botKeyService.getBotKey(userId);
    
    if (!botKey) {
      res.json({
        success: true,
        data: null,
        message: '未配置 Bot Key'
      });
      return;
    }
    
    // 不返回完整的 token，只返回部分信息
    res.json({
      success: true,
      data: {
        id: botKey.id,
        bot_username: botKey.bot_username,
        bot_name: botKey.bot_name,
        is_active: botKey.is_active,
        token_preview: botKey.bot_token.substring(0, 10) + '...',
        created_at: botKey.created_at,
        updated_at: botKey.updated_at
      }
    });
  } catch (err) {
    console.error('Get bot key error:', err);
    res.status(500).json({ error: '获取 Bot Key 失败' });
  }
});

/**
 * DELETE /api/v1/bot-key
 * 删除当前用户的 Bot Key
 */
router.delete('/', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    
    const result = await botKeyService.deleteBotKey(userId);
    
    if (!result.success) {
      res.status(400).json({ error: result.error });
      return;
    }
    
    res.json({
      success: true,
      message: 'Bot Key 已删除'
    });
  } catch (err) {
    console.error('Delete bot key error:', err);
    res.status(500).json({ error: '删除 Bot Key 失败' });
  }
});

/**
 * POST /api/v1/bot-key/validate
 * 验证 Bot Token
 */
router.post('/validate', async (req: Request, res: Response) => {
  try {
    const { bot_token } = req.body;
    
    if (!bot_token || typeof bot_token !== 'string') {
      res.status(400).json({ error: 'Bot Token 是必需的' });
      return;
    }
    
    const result = await botKeyService.validateBotToken(bot_token);
    
    res.json({
      success: result.valid,
      data: result.valid ? {
        username: result.username,
        first_name: result.first_name
      } : null,
      error: result.error
    });
  } catch (err) {
    console.error('Validate bot token error:', err);
    res.status(500).json({ error: '验证失败' });
  }
});

/**
 * POST /api/v1/bot-key/test
 * 测试 Bot 发送消息
 */
router.post('/test', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const { chat_id, message } = req.body;
    
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    
    const botKey = await botKeyService.getBotKey(userId);
    if (!botKey) {
      res.status(400).json({ error: '请先配置 Bot Key' });
      return;
    }
    
    if (!chat_id) {
      res.status(400).json({ error: 'Chat ID 是必需的' });
      return;
    }
    
    const testMessage = message || '🤖 测试消息：Bot Key 配置成功！';
    
    const result = await botKeyService.testBotMessage(
      botKey.bot_token,
      chat_id,
      testMessage
    );
    
    res.json({
      success: result.success,
      error: result.error
    });
  } catch (err) {
    console.error('Test bot message error:', err);
    res.status(500).json({ error: '测试失败' });
  }
});

export { router as botKeyRouter };