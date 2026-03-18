/**
 * 速率限制中间件
 * 防止 DoS 攻击和暴力破解
 */

import rateLimit from 'express-rate-limit';
import { Request, Response, NextFunction } from 'express';

// 存储认证失败的 IP 地址
const authFailureStore = new Map<string, { count: number; lastFailure: number }>();

// 认证失败阈值 - 降低以更快检测暴力破解
const AUTH_FAILURE_THRESHOLD = 3;
const AUTH_FAILURE_WINDOW_MS = 15 * 60 * 1000; // 15 分钟
const AUTH_LOCKOUT_MS = 30 * 60 * 1000; // 锁定 30 分钟

/**
 * 获取客户端 IP
 */
export function getClientIp(req: Request): string {
  return req.ip || req.socket.remoteAddress || 'unknown';
}

/**
 * 记录认证失败并返回失败信息
 */
export function handleAuthFailure(req: Request): { remainingAttempts: number } {
  const ip = getClientIp(req);
  const now = Date.now();
  const record = authFailureStore.get(ip);
  
  let count = 1;
  if (record) {
    if (now - record.lastFailure < AUTH_FAILURE_WINDOW_MS) {
      count = record.count + 1;
    }
  }
  
  authFailureStore.set(ip, { count, lastFailure: now });
  cleanupAuthFailureStore();
  
  const remaining = Math.max(0, AUTH_FAILURE_THRESHOLD - count);
  return { remainingAttempts: remaining };
}

/**
 * 认证成功，清除失败记录
 */
export function handleAuthSuccess(req: Request): void {
  const ip = getClientIp(req);
  authFailureStore.delete(ip);
}

/**
 * 认证失败保护中间件
 */
export function authFailureGuard(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const ip = getClientIp(req);
  
  if (isAuthLocked(ip)) {
    res.status(429).json({
      error: 'Too many authentication failures',
      message: '您的账户已被临时锁定，请 30 分钟后再试',
      retryAfter: AUTH_LOCKOUT_MS / 1000
    });
    return;
  }
  
  next();
}

/**
 * 记录认证失败并返回是否应该锁定
 */
export function recordAuthFailure(ip: string): boolean {
  const now = Date.now();
  const record = authFailureStore.get(ip);
  
  if (record) {
    // 如果在窗口期内，增加计数
    if (now - record.lastFailure < AUTH_FAILURE_WINDOW_MS) {
      record.count++;
      record.lastFailure = now;
    } else {
      // 重置计数
      authFailureStore.set(ip, { count: 1, lastFailure: now });
      return false;
    }
  } else {
    authFailureStore.set(ip, { count: 1, lastFailure: now });
    return false;
  }
  
  // 清理过期记录
  cleanupAuthFailureStore();
  
  // 返回是否达到锁定阈值
  return record.count >= AUTH_FAILURE_THRESHOLD;
}

/**
 * 检查 IP 是否被锁定
 */
export function isAuthLocked(ip: string): boolean {
  const record = authFailureStore.get(ip);
  if (!record) return false;
  
  const now = Date.now();
  
  // 如果超过阈值且在锁定期内
  if (record.count >= AUTH_FAILURE_THRESHOLD) {
    if (now - record.lastFailure < AUTH_LOCKOUT_MS) {
      return true;
    } else {
      // 锁定期已过，清除记录
      authFailureStore.delete(ip);
    }
  }
  
  return false;
}

/**
 * 清理过期的认证失败记录
 */
function cleanupAuthFailureStore(): void {
  const now = Date.now();
  const maxAge = Math.max(AUTH_FAILURE_WINDOW_MS, AUTH_LOCKOUT_MS);
  
  for (const [ip, record] of authFailureStore.entries()) {
    if (now - record.lastFailure > maxAge) {
      authFailureStore.delete(ip);
    }
  }
}

/**
 * 认证失败速率限制中间件
 * 在认证失败时检查是否应该锁定
 */
export function authRateLimitMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  
  if (isAuthLocked(ip)) {
    res.status(429).json({
      error: 'Too many authentication failures',
      message: '您的账户已被临时锁定，请 30 分钟后再试',
      retryAfter: AUTH_LOCKOUT_MS / 1000
    });
    return;
  }
  
  next();
}

/**
 * 通用 API 速率限制
 * 每个 IP 每分钟最多 1000 次请求（开发环境宽松限制）
 */
export const generalRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 分钟
  max: 1000, // 每个 IP 最多 1000 次请求
  message: {
    error: 'Too many requests',
    message: '请求过于频繁，请稍后再试'
  },
  standardHeaders: true,
  legacyHeaders: false,
  // 使用请求 IP 作为 key
  keyGenerator: (req: Request) => {
    return req.ip || req.socket.remoteAddress || 'unknown';
  },
  // 跳过健康检查
  skip: (req: Request) => {
    return req.path === '/health' || req.path === '/';
  }
});

// 别名，保持向后兼容
export const globalRateLimiter = generalRateLimiter;

/**
 * 严格速率限制（用于敏感操作）
 * 每个 IP 每分钟最多 100 次请求
 */
export const strictRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 分钟
  max: 100, // 每个 IP 最多 100 次请求
  message: {
    error: 'Too many requests',
    message: '操作过于频繁，请稍后再试'
  },
  standardHeaders: true,
  legacyHeaders: false
});

/**
 * 认证端点速率限制
 * 每个 IP 每分钟最多 100 次请求
 */
export const authRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 分钟
  max: 100, // 每个 IP 最多 100 次认证请求
  message: {
    error: 'Too many authentication attempts',
    message: '认证请求过于频繁，请稍后再试'
  },
  standardHeaders: true,
  legacyHeaders: false
});
