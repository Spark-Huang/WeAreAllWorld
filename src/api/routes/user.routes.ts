/**
 * 用户路由
 */

import { Router, Request, Response } from 'express';
import { supabase } from '../index';
import { UserService } from '../../services/user.service';

const router: Router = Router();
const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY!;

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
        isNewUser: !result.aiPartner // 简单判断：没有AI伙伴就是新用户
      }
    });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Registration failed' });
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