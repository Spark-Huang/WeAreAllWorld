/**
 * 认证路由（公开，无需认证）
 * 处理零门槛注册和用户创建
 */

import { Router, Request, Response } from 'express';
import { supabase } from '../index';
import { UserService } from '../../services/user.service';
import { getOpenClawProvisionService } from '../../services/openclaw-provision.service';

const router: Router = Router();
const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY!;

/**
 * POST /api/v1/auth/register
 * 注册新用户（通过 Telegram）- 零门槛注册
 */
router.post('/register', async (req: Request, res: Response) => {
  try {
    const { telegramUserId, telegramUsername } = req.body;
    
    if (!telegramUserId) {
      res.status(400).json({ error: 'telegramUserId is required' });
      return;
    }
    
    const userService = new UserService(SUPABASE_URL, SUPABASE_KEY);
    const result = await userService.getOrCreateUser(telegramUserId, telegramUsername);
    
    res.json({
      success: true,
      data: {
        user: result.user,
        aiPartner: result.aiPartner,
        isNewUser: !result.aiPartner
      }
    });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Registration failed' });
  }
});

/**
 * POST /api/v1/auth/ensure-user
 * 确保用户记录存在（登录时调用）
 * 支持两种方式：
 * 1. 零门槛注册：只需要 telegramUserId
 * 2. 已认证用户：通过 X-User-ID header
 */
router.post('/ensure-user', async (req: Request, res: Response) => {
  console.log('[ENSURE-USER] Request received:', {
    telegramUserId: req.body?.telegramUserId,
    xUserId: req.headers['x-user-id'],
    headers: req.headers['x-api-key']
  });
  
  try {
    const { telegramUserId, telegramUsername } = req.body;
    const xUserId = req.headers['x-user-id'] as string;
    
    // 方式1: 零门槛注册（只需要 telegramUserId）
    if (telegramUserId) {
      console.log('[ENSURE-USER] Zero-barrier registration for:', telegramUserId);
      const userService = new UserService(SUPABASE_URL, SUPABASE_KEY);
      const result = await userService.getOrCreateUser(telegramUserId, telegramUsername);
      
      res.json({
        success: true,
        data: {
          user: result.user,
          aiPartner: result.aiPartner,
          isNewUser: !result.aiPartner
        }
      });
      return;
    }
    
    // 方式2: 已认证用户（通过 X-User-ID header）
    if (xUserId) {
      console.log('[ENSURE-USER] Ensuring user exists for:', xUserId);
      
      // 检查用户是否已存在
      const { data: existingUser } = await supabase
        .from('users')
        .select('id')
        .eq('id', xUserId)
        .single();
      
      if (existingUser) {
        // 检查 AI 伙伴是否存在
        const { data: existingPartner } = await supabase
          .from('ai_partners')
          .select('*')
          .eq('user_id', xUserId)
          .single();
        
        res.json({
          success: true,
          data: {
            user: { id: xUserId },
            aiPartner: existingPartner,
            isNewUser: false
          }
        });
        return;
      }
      
      // 创建用户记录（触发器会自动创建AI伙伴）
      const { error } = await supabase
        .from('users')
        .insert({
          id: xUserId,
          telegram_user_id: Math.floor(Math.random() * 1000000000),
          telegram_username: telegramUsername || 'web_user',
          onboarding_step: 0,
          onboarding_completed: false
        });
      
      if (error) {
        console.error('Create user error:', error);
        res.status(500).json({ error: 'Failed to create user' });
        return;
      }
      
      // 获取新创建的 AI 伙伴
      const { data: partner } = await supabase
        .from('ai_partners')
        .select('*')
        .eq('user_id', xUserId)
        .single();
      
      res.json({
        success: true,
        data: {
          user: { id: xUserId },
          aiPartner: partner,
          isNewUser: true
        }
      });
      return;
    }
    
    // 如果没有 telegramUserId 或 X-User-ID，返回错误
    res.status(400).json({ 
      error: 'telegramUserId or X-User-ID is required' 
    });
  } catch (err) {
    console.error('Ensure user error:', err);
    res.status(500).json({ error: 'Failed to ensure user' });
  }
});

/**
 * POST /api/v1/auth/create-user
 * 为 Supabase Auth 用户创建数据库记录
 */
router.post('/create-user', async (req: Request, res: Response) => {
  try {
    const { userId, telegramUsername } = req.body;
    
    if (!userId) {
      res.status(400).json({ error: 'userId is required' });
      return;
    }
    
    // 检查用户是否已存在
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('id', userId)
      .single();
    
    if (existingUser) {
      // 检查 AI 伙伴是否存在
      const { data: existingPartner } = await supabase
        .from('ai_partners')
        .select('id')
        .eq('user_id', userId)
        .single();
      
      if (!existingPartner) {
        // 手动创建 AI 伙伴
        await supabase
          .from('ai_partners')
          .insert({ user_id: userId, name: '小零' });
      }
      
      res.json({ success: true, message: 'User already exists' });
      return;
    }
    
    // 创建用户记录（触发器会自动创建AI伙伴）
    const { error } = await supabase
      .from('users')
      .insert({
        id: userId,
        telegram_user_id: Math.floor(Math.random() * 1000000000),
        telegram_username: telegramUsername || 'web_user',
        onboarding_step: 0,
        onboarding_completed: false
      });
    
    if (error) {
      console.error('Create user error:', error);
      res.status(500).json({ error: 'Failed to create user' });
      return;
    }
    
    // 检查 AI 伙伴是否创建成功
    const { data: partner } = await supabase
      .from('ai_partners')
      .select('id')
      .eq('user_id', userId)
      .single();
    
    if (!partner) {
      // 手动创建 AI 伙伴
      await supabase
        .from('ai_partners')
        .insert({ user_id: userId, name: '小零' });
    }
    
    // 异步创建 OpenClaw 实例（不阻塞响应）
    setImmediate(async () => {
      try {
        const openclawService = getOpenClawProvisionService();
        if (openclawService) {
          console.log(`🚀 为用户 ${userId} 创建 OpenClaw 实例...`);
          const result = await openclawService.provisionForUser(userId);
          if (result.success) {
            console.log(`✅ 用户 ${userId} OpenClaw 实例创建成功: ${result.instance?.podName}`);
          } else {
            console.warn(`⚠️ 用户 ${userId} OpenClaw 实例创建失败:`, result.error);
          }
        }
      } catch (err) {
        console.warn('OpenClaw 实例创建异常:', err);
      }
    });
    
    res.json({ success: true, message: 'User created' });
  } catch (err) {
    console.error('Create user error:', err);
    res.status(500).json({ error: 'Failed to create user' });
  }
});

export { router as authRouter };