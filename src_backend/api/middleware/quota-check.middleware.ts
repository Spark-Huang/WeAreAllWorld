/**
 * 大同世界 - 额度检查中间件
 * 
 * 在对话前检查用户的 New API 额度是否足够
 */

import { Request, Response, NextFunction } from 'express';
import { getNewApiService } from '../../services/new-api.service';

/**
 * 额度检查中间件
 * @param requiredQuota 所需额度，默认 1000
 */
export function quotaCheckMiddleware(requiredQuota: number = 1000) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).user?.id;
      
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: '请先登录'
          }
        });
      }
      
      const newApiService = getNewApiService();
      
      // 如果 New API 未配置，跳过检查
      if (!newApiService) {
        console.warn('New API 未配置，跳过额度检查');
        (req as any).skipQuotaCheck = true;
        return next();
      }
      
      // 确保用户已同步到 New API
      await newApiService.syncUser({ userId });
      
      // 检查额度
      const quotaResult = await newApiService.checkQuota(userId, requiredQuota);
      
      if (!quotaResult.sufficient) {
        // 获取充值链接
        const rechargeUrl = await newApiService.getRechargeUrl(userId);
        
        return res.status(402).json({
          success: false,
          error: {
            code: 'QUOTA_EXCEEDED',
            message: 'Token 额度不足，请充值后继续',
            rechargeUrl
          }
        });
      }
      
      // 将额度信息附加到请求
      (req as any).quota = {
        current: quotaResult.quota,
        required: requiredQuota
      };
      
      next();
    } catch (error) {
      console.error('额度检查失败:', error);
      
      // 检查失败时允许继续（降级处理）
      console.warn('额度检查异常，允许继续');
      (req as any).skipQuotaCheck = true;
      next();
    }
  };
}

/**
 * 扣减额度（对话完成后调用）
 */
export async function deductQuota(
  userId: string,
  tokensUsed: number
): Promise<boolean> {
  const newApiService = getNewApiService();
  
  if (!newApiService) {
    return false;
  }
  
  // New API 会自动扣减，这里只更新本地缓存
  // 实际扣减由 New API 网关处理
  
  return true;
}