/**
 * 天下一家 - REST API 入口
 */

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

// 服务
import { asyncQualityEvaluationService } from '../contribution-evaluation/services/async-quality-evaluation.service';

// 中间件
import { authMiddleware } from './middleware/auth.middleware';

const app: Express = express();

// 环境变量
const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY!;

// Supabase 客户端
export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// 基础中间件
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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
    name: '天下一家 (WeAreAll.World)',
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

// 公开路由（无需认证）
app.use(`${API_PREFIX}/auth`, userRouter);

// 受保护路由（需要认证）
app.use(`${API_PREFIX}/user`, authMiddleware, userRouter);
app.use(`${API_PREFIX}/ai-partner`, authMiddleware, aiPartnerRouter);
app.use(`${API_PREFIX}/dialogue`, authMiddleware, dialogueRouter);
app.use(`${API_PREFIX}/stats`, authMiddleware, statsRouter);
app.use(`${API_PREFIX}/bot-key`, authMiddleware, botKeyRouter);
app.use(`${API_PREFIX}/story`, authMiddleware, storyRouter);
app.use(`${API_PREFIX}/new-api`, authMiddleware, newApiRouter);
app.use(`${API_PREFIX}/openclaw`, authMiddleware, openclawRouter);

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