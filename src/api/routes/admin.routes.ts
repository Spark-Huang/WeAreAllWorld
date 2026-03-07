/**
 * 管理员路由
 * 用于手动触发定时任务和管理功能
 */

import { Router, Request, Response } from 'express';
import { CentralEvaluationService } from '../../contribution-evaluation/services/central-evaluation.service';
import { ScheduledTaskService } from '../../contribution-evaluation/services/scheduled-task.service';

const router: Router = Router();
const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY!;

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

export { router as adminRouter };