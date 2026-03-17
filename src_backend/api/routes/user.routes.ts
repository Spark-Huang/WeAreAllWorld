/**
 * 用户路由（需要认证）
 */

import { Router, Request, Response } from 'express';
import { supabase } from '../index';
import { UserService } from '../../services/user.service';
import { getOpenClawProvisionService } from '../../services/openclaw-provision.service';


const router: Router = Router();
const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY!;

/**
 * POST /api/v1/user/ensure-user
 * 确保用户记录存在（需要认证）
 * 用于已登录用户
 */
router.post('/ensure-user', async (req: Request, res: Response) => {
  console.log('[ENSURE-USER] Request received:', {
    hasUser: !!req.user,
    userId: req.user?.id
  });
  
  try {
    const { telegramUsername } = req.body;
    const userId = req.user?.id;
    
    if (!userId) {
      console.log('[ENSURE-USER] No user ID, returning 401');
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }
    
    // 检查用户是否已存在
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('id', userId)
      .single();
    
    if (existingUser) {
      res.json({ success: true, isNewUser: false });
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
    
    res.json({ success: true, isNewUser: true });
  } catch (err) {
    console.error('Ensure user error:', err);
    res.status(500).json({ error: 'Failed to ensure user' });
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