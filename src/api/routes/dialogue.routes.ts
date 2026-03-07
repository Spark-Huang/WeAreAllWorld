/**
 * 对话路由
 */

import { Router, Request, Response } from 'express';
import { MemoryPointsService } from '../../contribution-evaluation/services/memory-points.service';

const router: Router = Router();
const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY!;

/**
 * POST /api/v1/dialogue
 * 发送对话消息
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const { message } = req.body;
    
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    
    if (!message || typeof message !== 'string') {
      res.status(400).json({ error: 'Message is required' });
      return;
    }
    
    const memoryService = new MemoryPointsService(SUPABASE_URL, SUPABASE_KEY);
    const result = await memoryService.processDialogue(userId, message);
    
    res.json({
      success: true,
      data: {
        qualityResult: result.qualityResult,
        updateResult: result.updateResult
      }
    });
  } catch (err) {
    console.error('Dialogue error:', err);
    res.status(500).json({ error: 'Failed to process dialogue' });
  }
});

/**
 * GET /api/v1/dialogue/history
 * 获取对话历史
 */
router.get('/history', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const limit = parseInt(req.query.limit as string) || 50;
    
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    
    // TODO: 实现对话历史查询
    res.json({
      success: true,
      data: [],
      message: '对话历史功能待实现'
    });
  } catch (err) {
    console.error('Get dialogue history error:', err);
    res.status(500).json({ error: 'Failed to get dialogue history' });
  }
});

export { router as dialogueRouter };