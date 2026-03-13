/**
 * 剧情系统路由
 */

import { Router, Request, Response } from 'express';
import { StoryService } from '../../contribution-evaluation/services/story.service';

const router: Router = Router();
const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY!;

/**
 * GET /api/v1/story
 * 获取剧情状态和当前章节的所有场景
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    
    const storyService = new StoryService(SUPABASE_URL, SUPABASE_KEY);
    const { scene, progress } = await storyService.startStory(userId);
    const available = await storyService.getAvailableStory(userId);
    
    // 获取当前章节的所有场景
    const chapter = storyService.getChapter(progress.currentChapter);
    const chapterScenes = chapter?.scenes || [];
    
    res.json({
      success: true,
      data: {
        currentScene: scene,
        progress: {
          currentChapter: progress.currentChapter,
          currentScene: progress.currentScene,
          completedChapters: progress.completedChapters,
          totalRewards: progress.totalRewards
        },
        available,
        chapterScenes // 返回整个章节的场景数据
      }
    });
  } catch (err) {
    console.error('Get story error:', err);
    res.status(500).json({ error: 'Failed to get story' });
  }
});

/**
 * GET /api/v1/story/chapters
 * 获取所有章节列表
 */
router.get('/chapters', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    
    const storyService = new StoryService(SUPABASE_URL, SUPABASE_KEY);
    const chapters = storyService.getAllChapters();
    const available = await storyService.getAvailableStory(userId);
    
    // 标记每个章节的解锁状态
    const chaptersWithStatus = chapters.map(chapter => ({
      id: chapter.id,
      title: chapter.title,
      description: chapter.description,
      requiredContribution: chapter.requiredContribution,
      rewardContribution: chapter.rewardContribution,
      unlocked: available.unlockedChapters.includes(chapter.id),
      completed: available.completedChapters.includes(chapter.id)
    }));
    
    res.json({
      success: true,
      data: chaptersWithStatus
    });
  } catch (err) {
    console.error('Get chapters error:', err);
    res.status(500).json({ error: 'Failed to get chapters' });
  }
});

/**
 * GET /api/v1/story/chapter/:chapterId
 * 获取特定章节详情
 */
router.get('/chapter/:chapterId', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const chapterId = req.params.chapterId as string;
    
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    
    const storyService = new StoryService(SUPABASE_URL, SUPABASE_KEY);
    const chapter = storyService.getChapter(parseInt(chapterId));
    
    if (!chapter) {
      res.status(404).json({ error: 'Chapter not found' });
      return;
    }
    
    const unlocked = await storyService.isChapterUnlocked(userId, parseInt(chapterId));
    
    res.json({
      success: true,
      data: {
        ...chapter,
        unlocked
      }
    });
  } catch (err) {
    console.error('Get chapter error:', err);
    res.status(500).json({ error: 'Failed to get chapter' });
  }
});

/**
 * POST /api/v1/story/advance
 * 推进剧情（做出选择或继续）
 * 
 * 设计模式：
 * - 前端每一步都是本地推进，不调用 API
 * - 选择被缓存到 pendingChoices 数组
 * - 只有章节完成（milestone）时才调用此 API，一次性提交所有选择
 * - 此 API 是异步的：立即返回 202，后台处理
 * 
 * 支持 pendingChoices 参数，一次性提交章节内的所有选择
 */
router.post('/advance', async (req: Request, res: Response) => {
  const userId = req.user?.id;
  const { choiceId, pendingChoices, currentSceneId, completedChapterId } = req.body || {};
  
  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  
  // 立即返回 202 Accepted，表示请求已接受，正在后台处理
  res.status(202).json({
    success: true,
    message: 'Story progress is being processed in the background'
  });
  
  // 后台异步处理（不阻塞响应）
  setImmediate(async () => {
    try {
      const storyService = new StoryService(SUPABASE_URL, SUPABASE_KEY);
      
      // 如果有 pendingChoices，先处理所有待提交的选择
      if (pendingChoices && pendingChoices.length > 0) {
        for (const pc of pendingChoices) {
          await storyService.recordChoice(userId, pc.sceneId, pc.choiceId);
        }
      }
      
      // 如果前端传入了当前场景 ID，先更新数据库中的进度
      if (currentSceneId) {
        const scene = storyService.findSceneById(currentSceneId);
        if (scene) {
          // 先更新当前场景
          await storyService.updateCurrentScene(userId, scene.chapterId, currentSceneId);
        }
      }
      
      // 如果前端传入了已完成的章节 ID，直接标记章节完成
      if (completedChapterId) {
        await storyService.completeChapter(userId, completedChapterId);
        console.log(`[Story] User ${userId} chapter ${completedChapterId} completed`);
      } else {
        // 否则使用原来的逻辑
        const result = await storyService.advanceStory(userId, choiceId);
        
        console.log(`[Story] User ${userId} chapter complete:`, {
          event: result.event.type,
          reward: result.reward,
          chapterComplete: result.chapterComplete
        });
      }
    } catch (err) {
      console.error('[Story] Background advance error:', err);
    }
  });
});

/**
 * GET /api/v1/story/available
 * 获取可用剧情状态
 */
router.get('/available', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    
    const storyService = new StoryService(SUPABASE_URL, SUPABASE_KEY);
    const available = await storyService.getAvailableStory(userId);
    
    res.json({
      success: true,
      data: available
    });
  } catch (err) {
    console.error('Get available story error:', err);
    res.status(500).json({ error: 'Failed to get available story' });
  }
});

export { router as storyRouter };