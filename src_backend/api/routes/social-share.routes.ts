/**
 * 社交分享 API 路由
 */

import { Router, Request, Response } from 'express';
import { SocialShareService, socialShareService } from '../../services/social-share.service';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

// 应用认证中间件
router.use(authMiddleware);

/**
 * POST /api/v1/share
 * 记录分享行为并发放奖励
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: '未授权' });
    }

    const { shareType, platform, content } = req.body;

    if (!shareType || !platform) {
      return res.status(400).json({ 
        success: false, 
        error: '缺少必要参数: shareType, platform' 
      });
    }

    const validTypes = ['achievement', 'milestone', 'ai_status', 'story', 'daily'];
    const validPlatforms = ['twitter', 'wechat', 'weibo', 'other'];

    if (!validTypes.includes(shareType)) {
      return res.status(400).json({ 
        success: false, 
        error: `无效的分享类型，可选: ${validTypes.join(', ')}` 
      });
    }

    if (!validPlatforms.includes(platform)) {
      return res.status(400).json({ 
        success: false, 
        error: `无效的平台，可选: ${validPlatforms.join(', ')}` 
      });
    }

    const result = await socialShareService.recordShare(
      userId,
      shareType,
      platform,
      content || {}
    );

    return res.json({
      success: result.success,
      data: {
        reward: result.reward,
        message: result.message
      }
    });
  } catch (error) {
    console.error('分享处理失败:', error);
    return res.status(500).json({ success: false, error: '分享处理失败' });
  }
});

/**
 * POST /api/v1/share/generate
 * 生成分享内容
 */
router.post('/generate', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: '未授权' });
    }

    const { shareType, data } = req.body;

    if (!shareType) {
      return res.status(400).json({ success: false, error: '缺少 shareType 参数' });
    }

    const content = socialShareService.generateShareContent(shareType, data || {});
    const twitterUrl = socialShareService.generateTwitterShareUrl(content);

    return res.json({
      success: true,
      data: {
        content,
        shareUrls: {
          twitter: twitterUrl
        }
      }
    });
  } catch (error) {
    console.error('生成分享内容失败:', error);
    return res.status(500).json({ success: false, error: '生成分享内容失败' });
  }
});

/**
 * GET /api/v1/share/history
 * 获取分享历史
 */
router.get('/history', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: '未授权' });
    }

    const limit = parseInt(req.query.limit as string) || 10;
    const history = await socialShareService.getShareHistory(userId, limit);

    return res.json({
      success: true,
      data: history
    });
  } catch (error) {
    console.error('获取分享历史失败:', error);
    return res.status(500).json({ success: false, error: '获取分享历史失败' });
  }
});

/**
 * GET /api/v1/share/today-count
 * 获取今日分享次数
 */
router.get('/today-count', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: '未授权' });
    }

    const count = await socialShareService.getTodayShareCount(userId);

    return res.json({
      success: true,
      data: { count }
    });
  } catch (error) {
    console.error('获取分享次数失败:', error);
    return res.status(500).json({ success: false, error: '获取分享次数失败' });
  }
});

export const socialShareRouter: Router = router;
