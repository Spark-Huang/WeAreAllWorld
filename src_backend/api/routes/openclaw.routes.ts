/**
 * OpenClaw 实例管理路由
 */

import { Router, Request, Response } from 'express';
import { getOpenClawProvisionService } from '../../services/openclaw-provision.service';

const router: Router = Router();

/**
 * POST /api/v1/openclaw/provision
 * 为当前用户创建 OpenClaw 实例
 */
router.post('/provision', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: '未登录'
      });
    }
    
    const provisionService = getOpenClawProvisionService();
    if (!provisionService) {
      return res.status(503).json({
        success: false,
        error: 'OpenClaw 部署服务不可用'
      });
    }
    
    const result = await provisionService.provisionForUser(userId);
    
    if (!result.success) {
      return res.status(500).json({
        success: false,
        error: result.error || '创建实例失败'
      });
    }
    
    res.json({
      success: true,
      data: {
        instance: result.instance,
        message: 'OpenClaw 实例创建成功'
      }
    });
  } catch (error) {
    console.error('创建 OpenClaw 实例失败:', error);
    res.status(500).json({
      success: false,
      error: '创建实例失败'
    });
  }
});

/**
 * GET /api/v1/openclaw/instance
 * 获取当前用户的 OpenClaw 实例信息
 */
router.get('/instance', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: '未登录'
      });
    }
    
    const provisionService = getOpenClawProvisionService();
    if (!provisionService) {
      return res.status(503).json({
        success: false,
        error: 'OpenClaw 部署服务不可用'
      });
    }
    
    const instance = await provisionService.getInstance(userId);
    
    res.json({
      success: true,
      data: {
        instance,
        hasInstance: !!instance
      }
    });
  } catch (error) {
    console.error('获取 OpenClaw 实例失败:', error);
    res.status(500).json({
      success: false,
      error: '获取实例失败'
    });
  }
});

/**
 * DELETE /api/v1/openclaw/instance
 * 停止当前用户的 OpenClaw 实例
 */
router.delete('/instance', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: '未登录'
      });
    }
    
    const provisionService = getOpenClawProvisionService();
    if (!provisionService) {
      return res.status(503).json({
        success: false,
        error: 'OpenClaw 部署服务不可用'
      });
    }
    
    const success = await provisionService.stopInstance(userId);
    
    if (!success) {
      return res.status(500).json({
        success: false,
        error: '停止实例失败'
      });
    }
    
    res.json({
      success: true,
      message: 'OpenClaw 实例已停止'
    });
  } catch (error) {
    console.error('停止 OpenClaw 实例失败:', error);
    res.status(500).json({
      success: false,
      error: '停止实例失败'
    });
  }
});

/**
 * POST /api/v1/openclaw/chat
 * 与用户的 OpenClaw 实例对话
 */
router.post('/chat', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    const { message } = req.body;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: '未登录'
      });
    }
    
    if (!message) {
      return res.status(400).json({
        success: false,
        error: '消息不能为空'
      });
    }
    
    const provisionService = getOpenClawProvisionService();
    if (!provisionService) {
      return res.status(503).json({
        success: false,
        error: 'OpenClaw 部署服务不可用'
      });
    }
    
    // 获取用户的 OpenClaw 实例
    const instance = await provisionService.getInstance(userId);
    
    if (!instance || instance.status !== 'running') {
      // 自动创建实例
      const result = await provisionService.provisionForUser(userId);
      if (!result.success) {
        return res.status(500).json({
          success: false,
          error: '无法创建 OpenClaw 实例'
        });
      }
    }
    
    // 转发请求到用户的 OpenClaw 实例
    const instanceInfo = instance || (await provisionService.getInstance(userId))!;
    
    // 这里应该调用用户的 OpenClaw 实例
    // 目前使用共享实例作为后备
    const response = await fetch(`http://${instanceInfo.podName}.${instanceInfo.namespace}:3000/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-User-ID': userId
      },
      body: JSON.stringify({ message })
    });
    
    if (!response.ok) {
      // 使用共享实例作为后备
      const fallbackResponse = await fetch('http://openclaw.we-are-all-world:3000/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-ID': userId
        },
        body: JSON.stringify({ message })
      });
      
      const data = await fallbackResponse.json();
      return res.json(data);
    }
    
    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('OpenClaw 对话失败:', error);
    res.status(500).json({
      success: false,
      error: '对话失败'
    });
  }
});

export default router;