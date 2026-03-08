import { Router } from 'express';
import { openclawService } from '../services/openclaw.service.js';
import { supabase } from '../services/supabase.service.js';

const router = Router();

/**
 * POST /api/instances
 * 创建 OpenClaw 实例
 */
router.post('/', async (req, res) => {
  try {
    const { userId, subdomain, plan = 'basic' } = req.body;

    // 验证用户存在
    const { data: user, error } = await supabase
      .from('users')
      .select('id, email')
      .eq('id', userId)
      .single();

    if (error || !user) {
      return res.status(404).json({ error: '用户不存在' });
    }

    // 创建 OpenClaw 实例
    const instance = await openclawService.createInstance({
      customerId: userId,
      subdomain,
      plan
    });

    // 记录实例信息到数据库
    await supabase
      .from('openclaw_instances')
      .insert({
        user_id: userId,
        instance_id: instance.instanceId,
        subdomain,
        status: 'creating',
        plan
      });

    res.json({
      instanceId: instance.instanceId,
      url: instance.url,
      status: 'creating'
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/instances/:id
 * 查询实例状态
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // 从数据库获取实例信息
    const { data: instance, error } = await supabase
      .from('openclaw_instances')
      .select('*')
      .eq('instance_id', id)
      .single();

    if (error || !instance) {
      return res.status(404).json({ error: '实例不存在' });
    }

    // 从 K8S 获取实时状态
    const status = await openclawService.getInstanceStatus(id);

    res.json({
      ...instance,
      k8sStatus: status
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/instances/user/:userId
 * 获取用户的所有实例
 */
router.get('/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    const { data, error } = await supabase
      .from('openclaw_instances')
      .select('*')
      .eq('user_id', userId);

    if (error) throw error;
    res.json({ instances: data });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/instances/:id
 * 删除实例
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // 删除 K8S 实例
    await openclawService.deleteInstance(id);

    // 更新数据库状态
    await supabase
      .from('openclaw_instances')
      .update({ status: 'deleted', deleted_at: new Date().toISOString() })
      .eq('instance_id', id);

    res.json({ message: '实例已删除', instanceId: id });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;