/**
 * 用户路由
 */

import { Router, Request, Response } from 'express';
import { supabase } from '../index';
import { UserService } from '../../services/user.service';

const router: Router = Router();
const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY!;

/**
 * POST /api/v1/auth/register
 * 注册新用户（通过 Telegram）
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
    
    res.json({ success: true, message: 'User created' });
  } catch (err) {
    console.error('Create user error:', err);
    res.status(500).json({ error: 'Failed to create user' });
  }
});

/**
 * GET /api/v1/user/profile
 * 获取当前用户信息
 */
router.get('/profile', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    
    const { data: user, error } = await supabase
      .from('users')
      .select(`
        *,
        ai_partners (*)
      `)
      .eq('id', userId)
      .single();
    
    if (error) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    
    res.json({ success: true, data: user });
  } catch (err) {
    console.error('Get profile error:', err);
    res.status(500).json({ error: 'Failed to get profile' });
  }
});

/**
 * PUT /api/v1/user/onboarding
 * 更新新手引导进度
 */
router.put('/onboarding', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const { step, completed } = req.body;
    
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    
    const userService = new UserService(SUPABASE_URL, SUPABASE_KEY);
    
    if (completed) {
      await userService.completeOnboarding(userId);
    } else if (step !== undefined) {
      await userService.updateOnboardingStep(userId, step);
    }
    
    res.json({ success: true });
  } catch (err) {
    console.error('Update onboarding error:', err);
    res.status(500).json({ error: 'Failed to update onboarding' });
  }
});

export { router as userRouter };