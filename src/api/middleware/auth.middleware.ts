/**
 * 认证中间件
 * 使用 Supabase Auth 验证 JWT Token
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
 */
export async function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // 开发模式：支持通过 header 传递用户ID
    if (process.env.NODE_ENV !== 'production') {
      const devUserId = req.headers['x-user-id'] as string;
      if (devUserId) {
        req.user = { id: devUserId };
        next();
        return;
      }
    }
    
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Missing or invalid authorization header' });
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