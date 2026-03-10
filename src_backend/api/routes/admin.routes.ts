/**
 * 管理员路由
 * 用于手动触发定时任务和管理功能
 */

import { Router, Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';
import { CentralEvaluationService } from '../../contribution-evaluation/services/central-evaluation.service';
import { ScheduledTaskService } from '../../contribution-evaluation/services/scheduled-task.service';

const router: Router = Router();
const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY!;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// 简单的 API Key 验证
const ADMIN_API_KEY = process.env.ADMIN_API_KEY || 'weareallworld_admin_2026';

const validateAdminKey = (req: Request, res: Response): boolean => {
  const apiKey = req.headers['x-admin-api-key'] as string || req.query.apiKey as string;
  if (apiKey !== ADMIN_API_KEY) {
    res.status(403).json({ error: 'Invalid admin API key' });
    return false;
  }
  return true;
};

/**
 * GET /api/v1/admin/stats
 * 获取系统统计信息
 */
router.get('/stats', async (req: Request, res: Response) => {
  if (!validateAdminKey(req, res)) return;
  
  try {
    // 获取用户总数
    const { count: totalUsers } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true });
    
    // 获取 AI 伙伴统计
    const { data: aiStats } = await supabase
      .from('ai_partners')
      .select('status');
    
    const activeAIs = aiStats?.filter(ai => ai.status === 'active').length || 0;
    const hibernatedAIs = aiStats?.filter(ai => ai.status === 'hibernated').length || 0;
    
    // 获取总贡献值
    const { data: contributionData } = await supabase
      .from('ai_partners')
      .select('total_contribution');
    
    const totalContribution = contributionData?.reduce((sum, ai) => sum + (ai.total_contribution || 0), 0) || 0;
    
    // 获取今日对话数
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const { count: todayDialogues } = await supabase
      .from('interaction_logs')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', today.toISOString());
    
    // 获取里程碑统计
    const { data: milestoneData } = await supabase
      .from('ai_partners')
      .select('abilities');
    
    let milestoneStats = {
      voiceEnabled: 0,
      memoryEnabled: 0,
      reasoningEnabled: 0,
      toolsEnabled: 0
    };
    
    milestoneData?.forEach(ai => {
      if (ai.abilities?.voice) milestoneStats.voiceEnabled++;
      if (ai.abilities?.memory) milestoneStats.memoryEnabled++;
      if (ai.abilities?.reasoning) milestoneStats.reasoningEnabled++;
      if (ai.abilities?.tools) milestoneStats.toolsEnabled++;
    });
    
    res.json({
      success: true,
      data: {
        users: {
          total: totalUsers || 0
        },
        aiPartners: {
          total: aiStats?.length || 0,
          active: activeAIs,
          hibernated: hibernatedAIs
        },
        contribution: {
          total: totalContribution,
          average: totalUsers ? Math.round(totalContribution / totalUsers) : 0
        },
        dialogues: {
          today: todayDialogues || 0
        },
        milestones: milestoneStats
      }
    });
  } catch (err) {
    console.error('Get stats error:', err);
    res.status(500).json({ error: 'Failed to get stats' });
  }
});

/**
 * GET /api/v1/admin/users
 * 获取用户列表
 */
router.get('/users', async (req: Request, res: Response) => {
  if (!validateAdminKey(req, res)) return;
  
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = (page - 1) * limit;
    
    const { data: users, error } = await supabase
      .from('users')
      .select(`
        id,
        email,
        created_at,
        last_active,
        ai_partners (
          id,
          name,
          status,
          total_contribution,
          weekly_contribution,
          violation_count,
          abilities
        )
      `)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);
    
    if (error) throw error;
    
    // 获取总数
    const { count: total } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true });
    
    res.json({
      success: true,
      data: users,
      pagination: {
        page,
        limit,
        total: total || 0,
        totalPages: Math.ceil((total || 0) / limit)
      }
    });
  } catch (err) {
    console.error('Get users error:', err);
    res.status(500).json({ error: 'Failed to get users' });
  }
});

/**
 * GET /api/v1/admin/users/:userId
 * 获取单个用户详情
 */
router.get('/users/:userId', async (req: Request, res: Response) => {
  if (!validateAdminKey(req, res)) return;
  
  try {
    const { userId } = req.params;
    
    const { data: user, error } = await supabase
      .from('users')
      .select(`
        id,
        email,
        created_at,
        last_active,
        ai_partners (
          id,
          name,
          status,
          total_contribution,
          weekly_contribution,
          current_contribution,
          violation_count,
          abilities,
          days_hibernated,
          last_interaction,
          created_at
        )
      `)
      .eq('id', userId)
      .single();
    
    if (error) throw error;
    
    // 获取用户最近的交互记录
    const { data: recentLogs } = await supabase
      .from('interaction_logs')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(10);
    
    res.json({
      success: true,
      data: {
        ...user,
        recentInteractions: recentLogs
      }
    });
  } catch (err) {
    console.error('Get user error:', err);
    res.status(500).json({ error: 'Failed to get user' });
  }
});

/**
 * POST /api/v1/admin/weekly-evaluation
 * 手动执行每周评估
 */
router.post('/weekly-evaluation', async (req: Request, res: Response) => {
  if (!validateAdminKey(req, res)) return;
  
  try {
    const centralService = new CentralEvaluationService(SUPABASE_URL, SUPABASE_KEY);
    const result = await centralService.evaluateAllUsers();
    
    res.json({ 
      success: true, 
      message: '每周评估执行完成',
      data: {
        total: result.total,
        passed: result.passed,
        warned: result.warned,
        hibernated: result.hibernated,
        errors: result.errors
      }
    });
  } catch (err) {
    console.error('Weekly evaluation error:', err);
    res.status(500).json({ error: 'Failed to run weekly evaluation' });
  }
});

/**
 * POST /api/v1/admin/hibernation-decay
 * 手动执行休眠衰减
 */
router.post('/hibernation-decay', async (req: Request, res: Response) => {
  if (!validateAdminKey(req, res)) return;
  
  try {
    const centralService = new CentralEvaluationService(SUPABASE_URL, SUPABASE_KEY);
    const result = await centralService.decayAllDormantAIs();
    
    res.json({ 
      success: true, 
      message: '休眠衰减执行完成',
      data: {
        total: result.total,
        success: result.success,
        reachedZero: result.reachedZero,
        errors: result.errors
      }
    });
  } catch (err) {
    console.error('Hibernation decay error:', err);
    res.status(500).json({ error: 'Failed to run hibernation decay' });
  }
});

/**
 * GET /api/v1/admin/task-status
 * 获取任务状态
 */
router.get('/task-status', async (req: Request, res: Response) => {
  if (!validateAdminKey(req, res)) return;
  
  try {
    const scheduledService = new ScheduledTaskService(SUPABASE_URL, SUPABASE_KEY);
    const status = await scheduledService.getTaskStatus();
    
    res.json({ success: true, data: status });
  } catch (err) {
    console.error('Get task status error:', err);
    res.status(500).json({ error: 'Failed to get task status' });
  }
});

/**
 * POST /api/v1/admin/evaluate-user/:userId
 * 手动评估单个用户
 */
router.post('/evaluate-user/:userId', async (req: Request, res: Response) => {
  if (!validateAdminKey(req, res)) return;
  
  try {
    const userId = req.params.userId as string;
    const centralService = new CentralEvaluationService(SUPABASE_URL, SUPABASE_KEY);
    const result = await centralService.evaluateUser(userId);
    
    res.json({ success: true, data: result });
  } catch (err) {
    console.error('Evaluate user error:', err);
    res.status(500).json({ error: 'Failed to evaluate user' });
  }
});

/**
 * POST /api/v1/admin/decay-user/:userId
 * 手动衰减单个用户
 */
router.post('/decay-user/:userId', async (req: Request, res: Response) => {
  if (!validateAdminKey(req, res)) return;
  
  try {
    const userId = req.params.userId as string;
    const centralService = new CentralEvaluationService(SUPABASE_URL, SUPABASE_KEY);
    const result = await centralService.decayHibernatedAI(userId);
    
    res.json({ success: true, data: result });
  } catch (err) {
    console.error('Decay user error:', err);
    res.status(500).json({ error: 'Failed to decay user' });
  }
});

/**
 * GET /api/v1/admin/dormant-ais
 * 获取所有休眠中的AI列表
 */
router.get('/dormant-ais', async (req: Request, res: Response) => {
  if (!validateAdminKey(req, res)) return;
  
  try {
    const centralService = new CentralEvaluationService(SUPABASE_URL, SUPABASE_KEY);
    const dormantAIs = await centralService.getDormantAIs();
    
    res.json({ success: true, data: dormantAIs, count: dormantAIs.length });
  } catch (err) {
    console.error('Get dormant AIs error:', err);
    res.status(500).json({ error: 'Failed to get dormant AIs' });
  }
});

/**
 * POST /api/v1/admin/ai/:aiId/wake
 * 唤醒休眠的AI
 */
router.post('/ai/:aiId/wake', async (req: Request, res: Response) => {
  if (!validateAdminKey(req, res)) return;
  
  try {
    const { aiId } = req.params;
    
    const { error } = await supabase
      .from('ai_partners')
      .update({
        status: 'active',
        days_hibernated: 0
      })
      .eq('id', aiId);
    
    if (error) throw error;
    
    res.json({ success: true, message: 'AI 已唤醒' });
  } catch (err) {
    console.error('Wake AI error:', err);
    res.status(500).json({ error: 'Failed to wake AI' });
  }
});

/**
 * POST /api/v1/admin/ai/:aiId/hibernate
 * 手动休眠AI
 */
router.post('/ai/:aiId/hibernate', async (req: Request, res: Response) => {
  if (!validateAdminKey(req, res)) return;
  
  try {
    const { aiId } = req.params;
    
    const { error } = await supabase
      .from('ai_partners')
      .update({
        status: 'hibernated'
      })
      .eq('id', aiId);
    
    if (error) throw error;
    
    res.json({ success: true, message: 'AI 已休眠' });
  } catch (err) {
    console.error('Hibernate AI error:', err);
    res.status(500).json({ error: 'Failed to hibernate AI' });
  }
});

/**
 * POST /api/v1/admin/ai/:aiId/add-contribution
 * 手动增加贡献值
 */
router.post('/ai/:aiId/add-contribution', async (req: Request, res: Response) => {
  if (!validateAdminKey(req, res)) return;
  
  try {
    const { aiId } = req.params;
    const { amount, reason } = req.body;
    
    if (!amount || amount <= 0) {
      res.status(400).json({ error: 'Invalid amount' });
      return;
    }
    
    // 获取当前贡献值
    const { data: ai, error: fetchError } = await supabase
      .from('ai_partners')
      .select('total_contribution, current_contribution')
      .eq('id', aiId)
      .single();
    
    if (fetchError) throw fetchError;
    
    // 更新贡献值
    const { error: updateError } = await supabase
      .from('ai_partners')
      .update({
        total_contribution: (ai.total_contribution || 0) + amount,
        current_contribution: (ai.current_contribution || 0) + amount
      })
      .eq('id', aiId);
    
    if (updateError) throw updateError;
    
    // 记录日志
    await supabase
      .from('interaction_logs')
      .insert({
        user_id: (await supabase.from('ai_partners').select('user_id').eq('id', aiId).single()).data?.user_id,
        type: 'admin_contribution',
        content: `管理员添加 ${amount} 贡献值: ${reason || '无原因'}`,
        metadata: { amount, reason, aiId }
      });
    
    res.json({ 
      success: true, 
      message: `已添加 ${amount} 贡献值`,
      data: {
        previousTotal: ai.total_contribution,
        newTotal: (ai.total_contribution || 0) + amount
      }
    });
  } catch (err) {
    console.error('Add contribution error:', err);
    res.status(500).json({ error: 'Failed to add contribution' });
  }
});

/**
 * PUT /api/v1/admin/ai/:aiId/name
 * 修改AI名称
 */
router.put('/ai/:aiId/name', async (req: Request, res: Response) => {
  if (!validateAdminKey(req, res)) return;
  
  try {
    const { aiId } = req.params;
    const { name } = req.body;
    
    if (!name || name.trim().length === 0) {
      res.status(400).json({ error: 'Invalid name' });
      return;
    }
    
    const { error } = await supabase
      .from('ai_partners')
      .update({ name: name.trim() })
      .eq('id', aiId);
    
    if (error) throw error;
    
    res.json({ success: true, message: 'AI 名称已更新' });
  } catch (err) {
    console.error('Update AI name error:', err);
    res.status(500).json({ error: 'Failed to update AI name' });
  }
});

export { router as adminRouter };