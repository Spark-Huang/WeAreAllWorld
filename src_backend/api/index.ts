/**
 * 大同世界 - REST API 入口
 */

// 确保环境变量在最开始加载
import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(__dirname, '../../.env') });

import express, { Express, Request, Response, NextFunction, Router } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { createClient } from '@supabase/supabase-js';

// 路由
import { userRouter } from './routes/user.routes';
import { aiPartnerRouter } from './routes/ai-partner.routes';
import { dialogueRouter } from './routes/dialogue.routes';
import { statsRouter } from './routes/stats.routes';
import { botKeyRouter } from './routes/bot-key.routes';
import { adminRouter } from './routes/admin.routes';
import { storyRouter } from './routes/story.routes';
import newApiRouter from './routes/new-api.routes';
import openclawRouter from './routes/openclaw.routes';
import { socialShareRouter } from './routes/social-share.routes';
import telegramRouter from './routes/telegram.routes';
import emotionalRouter from './routes/emotional.routes';
import engagementRouter from './routes/engagement.routes';

// 服务
import { asyncQualityEvaluationService } from '../contribution-evaluation/services/async-quality-evaluation.service';

// 中间件
import { authMiddleware } from './middleware/auth.middleware';
import { 
  generalRateLimiter, 
  authRateLimiter,
  authRateLimitMiddleware 
} from './middleware/rate-limit.middleware';

const app: Express = express();

// 环境变量
const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY!;

// Supabase 客户端
export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// 安全配置 - 2026-03-11 安全更新
const allowedOrigins = process.env.CORS_ORIGIN 
  ? process.env.CORS_ORIGIN.split(',').map(o => o.trim())
  : ['http://localhost:3000', 'http://localhost:5173', 'https://weareall.world'];

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'", 'https://api.supabase.co', 'https://kmbmfzehpjjctvuagecd.supabase.co'],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"]
    }
  },
  crossOriginEmbedderPolicy: false,
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));

app.use(cors({
  origin: (origin, callback) => {
    // 允许无 origin 的请求（如移动应用、curl）
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key', 'x-user-id']
}));

// 额外安全头
app.use((_req: Request, res: Response, next: NextFunction) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  next();
});

app.use(express.json({ limit: '10kb' })); // 限制请求体大小
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// 速率限制 - 安全必需
app.use(generalRateLimiter);

// 健康检查
app.get('/health', (_req: Request, res: Response) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// 根路径 - 欢迎页面
app.get('/', (_req: Request, res: Response) => {
  res.json({
    name: '大同世界 (WeAreAll.World)',
    version: '1.0.0',
    description: 'AI伙伴养成 + 文字冒险 + 实用助手平台',
    endpoints: {
      health: '/health',
      api: '/api/v1',
      auth: {
        register: 'POST /api/v1/auth/register',
        createUser: 'POST /api/v1/auth/create-user'
      },
      user: {
        profile: 'GET /api/v1/user/profile'
      },
      aiPartner: {
        info: 'GET /api/v1/ai-partner',
        checkin: 'POST /api/v1/ai-partner/checkin',
        milestones: 'GET /api/v1/ai-partner/milestones'
      },
      dialogue: {
        send: 'POST /api/v1/dialogue',
        history: 'GET /api/v1/dialogue/history',
        sessions: 'GET /api/v1/dialogue/sessions'
      },
      stats: {
        weekly: 'GET /api/v1/stats/weekly',
        overview: 'GET /api/v1/stats/overview'
      },
      botKey: {
        create: 'POST /api/v1/bot-key',
        get: 'GET /api/v1/bot-key',
        delete: 'DELETE /api/v1/bot-key',
        validate: 'POST /api/v1/bot-key/validate',
        test: 'POST /api/v1/bot-key/test'
      },
      story: {
        current: 'GET /api/v1/story',
        chapters: 'GET /api/v1/story/chapters',
        advance: 'POST /api/v1/story/advance'
      }
    },
    documentation: 'https://github.com/Spark-Huang/WeAreAllWorld'
  });
});

// API 版本路由
const API_PREFIX = '/api/v1';

// 公开路由（无需认证）- 使用严格的认证速率限制
app.use(`${API_PREFIX}/auth`, authRateLimiter, authRateLimitMiddleware, userRouter);

// 受保护路由（需要认证）
app.use(`${API_PREFIX}/user`, authMiddleware, userRouter);
app.use(`${API_PREFIX}/ai-partner`, authMiddleware, aiPartnerRouter);
app.use(`${API_PREFIX}/dialogue`, authMiddleware, dialogueRouter);
app.use(`${API_PREFIX}/stats`, authMiddleware, statsRouter);
app.use(`${API_PREFIX}/bot-key`, authMiddleware, botKeyRouter);
app.use(`${API_PREFIX}/story`, authMiddleware, storyRouter);
app.use(`${API_PREFIX}/new-api`, authMiddleware, newApiRouter);
app.use(`${API_PREFIX}/openclaw`, authMiddleware, openclawRouter);
app.use(`${API_PREFIX}/share`, authMiddleware, socialShareRouter);

// Telegram Bot 路由（无需认证，使用 Telegram ID 验证）
app.use(`${API_PREFIX}/telegram`, telegramRouter);

// 情感冲击功能路由
app.use(`${API_PREFIX}/emotional`, emotionalRouter);

// 用户粘性功能路由
app.use(`${API_PREFIX}/engagement`, engagementRouter);

// 管理员路由（需要 Admin API Key）
app.use(`${API_PREFIX}/admin`, adminRouter);

// 404 处理
app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: 'Not Found' });
});

// 错误处理
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('API Error:', err);
  res.status(500).json({ 
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// 启动异步质量评估服务
export function startAsyncEvaluationService(): void {
  console.log('');
  console.log('🔄 启动异步质量评估服务...');
  asyncQualityEvaluationService.start();
}

export { app };