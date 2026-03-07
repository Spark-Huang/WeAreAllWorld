/**
 * AI伙伴路由
 */

import { Router, Request, Response } from 'express';
import { supabase } from '../index';
import { MemoryPointsService } from '../../contribution-evaluation/services/memory-points.service';
import { CentralEvaluationService } from '../../contribution-evaluation/services/central-evaluation.service';

const router: Router = Router();
const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY!;

/**
 * GET /api/v1/ai-partner
 * 获取当前用户的AI伙伴信息
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    
    const { data: partner, error } = await supabase
      .from('ai_partners')
      .select('*')
      .eq('user_id', userId)
      .single();
    
    if (error) {
      res.status(404).json({ error: 'AI partner not found' });
      return;
    }
    
    res.json({ success: true, data: partner });
  } catch (err) {
    console.error('Get AI partner error:', err);
    res.status(500).json({ error: 'Failed to get AI partner' });
  }
});

/**
 * GET /api/v1/ai-partner/hibernation-status
 * 获取休眠状态信息
 */
router.get('/hibernation-status', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    
    const { data: partner, error } = await supabase
      .from('ai_partners')
      .select('status, hibernated_since, violation_count, current_contribution, total_contribution')
      .eq('user_id', userId)
      .single();
    
    if (error) {
      res.status(404).json({ error: 'AI partner not found' });
      return;
    }
    
    // 计算休眠天数
    let daysHibernated = 0;
    if (partner.status === 'hibernated' && partner.hibernated_since) {
      daysHibernated = Math.floor(
        (Date.now() - new Date(partner.hibernated_since).getTime()) / (1000 * 60 * 60 * 24)
      );
    }
    
    res.json({
      success: true,
      data: {
        status: partner.status,
        hibernatedSince: partner.hibernated_since,
        daysHibernated,
        violationCount: partner.violation_count,
        currentContribution: partner.current_contribution,
        totalContribution: partner.total_contribution,
        isHibernated: partner.status === 'hibernated',
        isRecycled: partner.status === 'recycled',
        canWakeup: partner.status === 'hibernated' || partner.status === 'recycled'
      }
    });
  } catch (err) {
    console.error('Get hibernation status error:', err);
    res.status(500).json({ error: 'Failed to get hibernation status' });
  }
});

/**
 * GET /api/v1/ai-partner/weekly-stats
 * 获取本周统计信息
 */
router.get('/weekly-stats', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    
    const centralService = new CentralEvaluationService(SUPABASE_URL, SUPABASE_KEY);
    const stats = await centralService.getWeeklyStats(userId);
    
    res.json({ success: true, data: stats });
  } catch (err) {
    console.error('Get weekly stats error:', err);
    res.status(500).json({ error: 'Failed to get weekly stats' });
  }
});

/**
 * POST /api/v1/ai-partner/wakeup
 * 唤醒休眠的AI
 */
router.post('/wakeup', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    
    const centralService = new CentralEvaluationService(SUPABASE_URL, SUPABASE_KEY);
    const result = await centralService.wakeupAI(userId);
    
    res.json({ success: result.success, data: result, message: result.message });
  } catch (err) {
    console.error('Wakeup AI error:', err);
    res.status(500).json({ error: 'Failed to wakeup AI' });
  }
});

/**
 * GET /api/v1/ai-partner/milestones
 * 获取里程碑列表
 */
router.get('/milestones', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    
    const memoryService = new MemoryPointsService(SUPABASE_URL, SUPABASE_KEY);
    const milestones = memoryService.getMilestones();
    
    res.json({ success: true, data: milestones });
  } catch (err) {
    console.error('Get milestones error:', err);
    res.status(500).json({ error: 'Failed to get milestones' });
  }
});

/**
 * GET /api/v1/ai-partner/next-milestone
 * 获取下一个里程碑
 */
router.get('/next-milestone', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    
    // 先获取当前贡献值
    const { data: partner } = await supabase
      .from('ai_partners')
      .select('total_contribution')
      .eq('user_id', userId)
      .single();
    
    const currentPoints = partner?.total_contribution || 0;
    
    const memoryService = new MemoryPointsService(SUPABASE_URL, SUPABASE_KEY);
    const nextMilestone = memoryService.getNextMilestone(currentPoints);
    
    res.json({ success: true, data: nextMilestone });
  } catch (err) {
    console.error('Get next milestone error:', err);
    res.status(500).json({ error: 'Failed to get next milestone' });
  }
});

/**
 * POST /api/v1/ai-partner/checkin
 * 每日签到
 */
router.post('/checkin', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    
    // 检查 AI 是否处于休眠状态
    const { data: partner } = await supabase
      .from('ai_partners')
      .select('status')
      .eq('user_id', userId)
      .single();
    
    if (partner?.status === 'hibernated') {
      res.json({ 
        success: false, 
        error: 'AI is hibernated', 
        message: '你的AI伙伴正在休眠中，请先唤醒它！' 
      });
      return;
    }
    
    const memoryService = new MemoryPointsService(SUPABASE_URL, SUPABASE_KEY);
    const result = await memoryService.processDailyCheckin(userId);
    
    res.json({ success: result.success, data: result });
  } catch (err) {
    console.error('Checkin error:', err);
    res.status(500).json({ error: 'Checkin failed' });
  }
});

export { router as aiPartnerRouter };