/**
 * 统计路由
 */

import { Router, Request, Response } from 'express';
import { supabase } from '../index';
import { CentralEvaluationService } from '../../contribution-evaluation/services/central-evaluation.service';

const router: Router = Router();
const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY!;

/**
 * GET /api/v1/stats/weekly
 * 获取本周统计
 */
router.get('/weekly', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    
    const evalService = new CentralEvaluationService(SUPABASE_URL, SUPABASE_KEY);
    const stats = await evalService.getWeeklyStats(userId);
    
    res.json({ success: true, data: stats });
  } catch (err) {
    console.error('Get weekly stats error:', err);
    res.status(500).json({ error: 'Failed to get weekly stats' });
  }
});

/**
 * GET /api/v1/stats/overview
 * 获取用户总览统计
 */
router.get('/overview', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    
    const { data: partner, error } = await supabase
      .from('ai_partners')
      .select(`
        total_contribution,
        weekly_contribution,
        current_contribution,
        status,
        violation_count,
        abilities
      `)
      .eq('user_id', userId)
      .single();
    
    if (error) {
      res.status(404).json({ error: 'Stats not found' });
      return;
    }
    
    // 计算成长阶段
    const totalContribution = partner.total_contribution || 0;
    let growthStage = '懵懂期';
    if (totalContribution >= 500) growthStage = '觉醒期';
    else if (totalContribution >= 200) growthStage = '成熟期';
    else if (totalContribution >= 50) growthStage = '成长期';
    
    res.json({
      success: true,
      data: {
        ...partner,
        growthStage,
        nextMilestone: getNextMilestone(totalContribution)
      }
    });
  } catch (err) {
    console.error('Get overview stats error:', err);
    res.status(500).json({ error: 'Failed to get overview stats' });
  }
});

/**
 * 获取下一个里程碑
 */
function getNextMilestone(currentPoints: number): { points: number; title: string } | null {
  const milestones = [
    { points: 10, title: '初识' },
    { points: 25, title: '相知' },
    { points: 50, title: '默契' },
    { points: 100, title: '灵魂伴侣' },
    { points: 200, title: '传奇羁绊' }
  ];
  
  for (const m of milestones) {
    if (currentPoints < m.points) {
      return { points: m.points - currentPoints, title: m.title };
    }
  }
  
  return null;
}

export { router as statsRouter };