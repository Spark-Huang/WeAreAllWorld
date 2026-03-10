import { Router } from 'express';
import { supabase } from '../services/supabase.service.js';
import { newApiService } from '../services/newapi.service.js';

const router = Router();

/**
 * GET /api/users
 * 获取用户列表
 */
router.get('/', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('id, email, created_at, new_api_user_id, new_api_quota');

    if (error) throw error;
    res.json({ users: data });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/users
 * 创建用户（同步到天下一家 + New API）
 */
router.post('/', async (req, res) => {
  try {
    const { email, password, name } = req.body;

    // 1. 在天下一家创建用户
    const { data: weareUser, error: weareError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name }
      }
    });

    if (weareError) throw weareError;

    // 2. 在 New API 创建用户
    const newApiUser = await newApiService.createUser(email, name);

    // 3. 更新天下一家用户表，关联 New API
    await supabase
      .from('users')
      .update({
        new_api_user_id: newApiUser.id,
        new_api_token: newApiUser.token,
        new_api_quota: newApiUser.quota
      })
      .eq('id', weareUser.user!.id);

    res.json({
      user: {
        id: weareUser.user!.id,
        email,
        newApiUserId: newApiUser.id,
        newApiQuota: newApiUser.quota
      }
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/users/:id
 * 获取用户详情
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    res.json({ user: data });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;