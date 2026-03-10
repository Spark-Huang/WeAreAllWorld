/**
 * 认证中间件
 * 支持 Supabase Auth JWT 或 API Key 认证
 */

import { Request, Response, NextFunction } from 'express';
import { createClient } from '@supabase/supabase-js';

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

// 用于验证 JWT 的 Supabase 客户端（必须使用 anon key）
const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY!;
const authClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// 用于数据库操作的 Supabase 客户端（使用 service_role key）
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY || SUPABASE_ANON_KEY;
const dbClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

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
    // 调试日志
    console.log('[AUTH DEBUG] Headers:', JSON.stringify(req.headers, null, 2));
    console.log('[AUTH DEBUG] API_KEY env:', process.env.API_KEY);
    
    // 方式1: API Key 认证（用于服务端调用或测试）
    const apiKey = req.headers['x-api-key'] as string;
    const validApiKey = process.env.API_KEY || 'weareallworld_dev_key_2026';
    console.log('[AUTH DEBUG] Received apiKey:', apiKey);
    console.log('[AUTH DEBUG] Valid apiKey:', validApiKey);
    
    if (apiKey && apiKey === validApiKey) {
      // API Key 认证通过，需要提供用户ID
      const userId = req.headers['x-user-id'] as string;
      console.log('[AUTH DEBUG] userId:', userId);
      
      if (userId) {
        // 验证用户是否存在（允许新用户通过）
        const { data: user } = await dbClient
          .from('users')
          .select('id, telegram_user_id')
          .eq('id', userId)
          .single();
        
        console.log('[AUTH DEBUG] User from DB:', user);
        
        // 即使 users 表中没有记录，也允许通过认证（用于新用户注册）
        req.user = {
          id: userId,
          telegramUserId: user?.telegram_user_id
        };
        next();
        return;
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
    
    // 验证 Supabase JWT（使用 anon key）
    const { data: { user }, error } = await authClient.auth.getUser(token);
    
    if (error || !user) {
      console.error('JWT validation error:', error);
      res.status(401).json({ error: 'Invalid or expired token' });
      return;
    }
    
    // 获取用户详细信息（使用 service_role key）
    const { data: userData } = await dbClient
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
    const { data: { user } } = await authClient.auth.getUser(token);
    
    if (user) {
      const { data: userData } = await dbClient
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
