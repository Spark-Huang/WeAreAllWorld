import { Router } from 'express';
import { newApiService } from '../services/newapi.service.js';
import { supabase } from '../services/supabase.service.js';

const router = Router();

/**
 * GET /api/tokens/:userId
 * 查询用户 Token 额度
 */
router.get('/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    // 从天下一家获取 New API 用户 ID
    const { data: user, error } = await supabase
      .from('users')
      .select('new_api_user_id, new_api_token')
      .eq('id', userId)
      .single();

    if (error || !user?.new_api_user_id) {
      return res.status(404).json({ error: '用户未关联 New API' });
    }

    // 查询 New API 额度
    const quota = await newApiService.getQuota(user.new_api_user_id);

    res.json({
      userId,
      newApiUserId: user.new_api_user_id,
      quota
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/tokens/recharge
 * 生成充值链接（SSO）
 */
router.post('/recharge', async (req, res) => {
  try {
    const { userId, amount } = req.body;

    // 从天下一家获取用户信息
    const { data: user, error } = await supabase
      .from('users')
      .select('new_api_user_id, email')
      .eq('id', userId)
      .single();

    if (error || !user?.new_api_user_id) {
      return res.status(404).json({ error: '用户未关联 New API' });
    }

    // 生成充值链接
    const rechargeUrl = await newApiService.generateRechargeUrl(
      user.new_api_user_id,
      user.email,
      amount
    );

    res.json({
      rechargeUrl,
      amount
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/tokens/:userId/usage
 * 查询用户消费记录
 */
router.get('/:userId/usage', async (req, res) => {
  try {
    const { userId } = req.params;

    const { data: user, error } = await supabase
      .from('users')
      .select('new_api_user_id')
      .eq('id', userId)
      .single();

    if (error || !user?.new_api_user_id) {
      return res.status(404).json({ error: '用户未关联 New API' });
    }

    const usage = await newApiService.getUsage(user.new_api_user_id);

    res.json({ usage });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;