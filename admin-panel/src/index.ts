import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';

import userRoutes from './routes/user.routes.js';
import tokenRoutes from './routes/token.routes.js';
import instanceRoutes from './routes/instance.routes.js';
import healthRoutes from './routes/health.routes.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3002;

// 中间件
app.use(helmet());
app.use(cors());
app.use(express.json());

// 路由
app.use('/api/health', healthRoutes);
app.use('/api/users', userRoutes);
app.use('/api/tokens', tokenRoutes);
app.use('/api/instances', instanceRoutes);

// 错误处理
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err.message);
  res.status(500).json({ error: err.message });
});

app.listen(PORT, () => {
  console.log(`🚀 管理后台运行在 http://localhost:${PORT}`);
  console.log(`📋 API 文档:`);
  console.log(`   GET  /api/health          - 健康检查`);
  console.log(`   GET  /api/users           - 用户列表`);
  console.log(`   POST /api/users           - 创建用户`);
  console.log(`   GET  /api/tokens/:userId  - 查询用户额度`);
  console.log(`   POST /api/tokens/recharge - 生成充值链接`);
  console.log(`   POST /api/instances       - 创建 OpenClaw 实例`);
  console.log(`   GET  /api/instances/:id   - 查询实例状态`);
  console.log(`   DELETE /api/instances/:id - 删除实例`);
});