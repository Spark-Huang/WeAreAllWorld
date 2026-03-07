/**
 * 认证中间件
 * 支持 Supabase Auth JWT 或 API Key 认证
 */

import { Request, Response, NextFunction } from 'express';
import { supabase } from '../index';

// 扩展 Request 类型
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email?: string;
        telegramUserId?: number;
      };
    }
  }
}

/**
 * 认证中间件
 * 优先级：API Key > Supabase JWT
 */
export async function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // 方式1: API Key 认证（用于服务端调用或测试）
    const apiKey = req.headers['x-api-key'] as string;
    if (apiKey && apiKey === process.env.API_KEY) {
      // API Key 认证通过，需要提供用户ID
      const userId = req.headers['x-user-id'] as string;
      if (userId) {
        // 验证用户是否存在
        const { data: user } = await supabase
          .from('users')
          .select('id, telegram_user_id')
          .eq('id', userId)
          .single();
        
        if (user) {
          req.user = {
            id: user.id,
            telegramUserId: user.telegram_user_id
          };
          next();
          return;
        }
      }
      res.status(401).json({ error: 'Invalid user ID' });
      return;
    }
    
    // 方式2: Supabase JWT 认证
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Missing authorization. Use Bearer token or API key.' });
      return;
    }
    
    const token = authHeader.substring(7);
    
    // 验证 Supabase JWT
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error || !user) {
      res.status(401).json({ error: 'Invalid or expired token' });
      return;
    }
    
    // 获取用户详细信息
    const { data: userData } = await supabase
      .from('users')
      .select('id, telegram_user_id')
      .eq('id', user.id)
      .single();
    
    req.user = {
      id: user.id,
      email: user.email,
      telegramUserId: userData?.telegram_user_id
    };
    
    next();
  } catch (err) {
    console.error('Auth middleware error:', err);
    res.status(500).json({ error: 'Authentication failed' });
  }
}

/**
 * 可选认证中间件（不强制要求登录）
 */
export async function optionalAuthMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      next();
      return;
    }
    
    const token = authHeader.substring(7);
    const { data: { user } } = await supabase.auth.getUser(token);
    
    if (user) {
      const { data: userData } = await supabase
        .from('users')
        .select('id, telegram_user_id')
        .eq('id', user.id)
        .single();
      
      req.user = {
        id: user.id,
        email: user.email,
        telegramUserId: userData?.telegram_user_id
      };
    }
    
    next();
  } catch {
    next();
  }
}