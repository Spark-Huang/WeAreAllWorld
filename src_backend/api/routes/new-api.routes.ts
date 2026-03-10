/**
 * 大同世界（WeAreAll.World）- New API 路由
 * 
 * 提供给前端的 API 接口
 */

import { Router, Request, Response } from 'express';
import { getNewApiService } from '../../services/new-api.service';

const router: Router = Router();

/**
 * 获取用户额度信息
 * GET /api/v1/new-api/quota
 */
router.get('/quota', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: '未登录'
      });
    }
    
    const newApiService = getNewApiService();
    if (!newApiService) {
      return res.status(503).json({
        success: false,
        error: 'New API 服务不可用'
      });
    }
    
    const quotaInfo = await newApiService.getQuota(userId);
    
    if (!quotaInfo) {
      // 尝试同步用户
      const syncResult = await newApiService.syncUser({ userId });
      
      if (!syncResult.success) {
        return res.status(500).json({
          success: false,
          error: '同步用户失败'
        });
      }
      
      // 返回初始额度
      return res.json({
        success: true,
        data: {
          quota: 100000,
          usedQuota: 0,
          totalQuota: 100000
        }
      });
    }
    
    res.json({
      success: true,
      data: quotaInfo
    });
  } catch (error) {
    console.error('获取额度失败:', error);
    res.status(500).json({
      success: false,
      error: '获取额度失败'
    });
  }
});

/**
 * 获取充值链接
 * GET /api/v1/new-api/recharge-url
 */
router.get('/recharge-url', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: '未登录'
      });
    }
    
    const newApiService = getNewApiService();
    if (!newApiService) {
      return res.status(503).json({
        success: false,
        error: 'New API 服务不可用'
      });
    }
    
    // 确保用户已同步
    await newApiService.syncUser({ userId });
    
    const rechargeUrl = await newApiService.getRechargeUrl(userId);
    
    res.json({
      success: true,
      data: {
        rechargeUrl
      }
    });
  } catch (error) {
    console.error('获取充值链接失败:', error);
    res.status(500).json({
      success: false,
      error: '获取充值链接失败'
    });
  }
});

/**
 * 同步用户到 New API（手动触发）
 * POST /api/v1/new-api/sync
 */
router.post('/sync', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    const email = (req as any).user?.email;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: '未登录'
      });
    }
    
    const newApiService = getNewApiService();
    if (!newApiService) {
      return res.status(503).json({
        success: false,
        error: 'New API 服务不可用'
      });
    }
    
    const result = await newApiService.syncUser({ userId, email });
    
    if (!result.success) {
      return res.status(500).json({
        success: false,
        error: result.error || '同步失败'
      });
    }
    
    res.json({
      success: true,
      data: {
        synced: true,
        newApiUserId: result.newApiUserId
      }
    });
  } catch (error) {
    console.error('同步用户失败:', error);
    res.status(500).json({
      success: false,
      error: '同步用户失败'
    });
  }
});

/**
 * 检查额度是否足够
 * GET /api/v1/new-api/check-quota
 */
router.get('/check-quota', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    const requiredQuota = parseInt(req.query.required as string) || 1000;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: '未登录'
      });
    }
    
    const newApiService = getNewApiService();
    if (!newApiService) {
      return res.status(503).json({
        success: false,
        error: 'New API 服务不可用'
      });
    }
    
    const result = await newApiService.checkQuota(userId, requiredQuota);
    
    res.json({
      success: true,
      data: {
        sufficient: result.sufficient,
        quota: result.quota,
        required: requiredQuota
      }
    });
  } catch (error) {
    console.error('检查额度失败:', error);
    res.status(500).json({
      success: false,
      error: '检查额度失败'
    });
  }
});

/**
 * 管理员：获取所有用户的 New API 状态
 * GET /api/v1/new-api/admin/users
 */
router.get('/admin/users', async (req: Request, res: Response) => {
  try {
    const userRole = (req as any).user?.role;
    
    if (userRole !== 'admin') {
      return res.status(403).json({
        success: false,
        error: '权限不足'
      });
    }
    
    // TODO: 实现管理员查询
    
    res.json({
      success: true,
      data: {
        users: [],
        total: 0
      }
    });
  } catch (error) {
    console.error('获取用户列表失败:', error);
    res.status(500).json({
      success: false,
      error: '获取用户列表失败'
    });
  }
});

export default router;