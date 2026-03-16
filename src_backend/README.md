# src_backend - 后端 API

大同世界后端服务，基于 Node.js + Express + TypeScript。

## 目录结构

```
src_backend/
├── api/
│   ├── routes/          # API 路由
│   │   ├── auth.routes.ts
│   │   ├── user.routes.ts
│   │   ├── ai-partner.routes.ts
│   │   ├── dialogue.routes.ts
│   │   ├── story.routes.ts
│   │   └── admin.routes.ts
│   └── middleware/      # 中间件
│       └── auth.ts
├── services/            # 业务服务
│   ├── user.service.ts
│   ├── ai-partner.service.ts
│   ├── dialogue.service.ts
│   ├── story.service.ts
│   └── openclaw-provision.service.ts
├── contribution-evaluation/  # 贡献值评估
│   └── services/
│       ├── quality-judge.service.ts
│       ├── memory-points.service.ts
│       └── central-evaluation.service.ts
└── index.ts             # 应用入口
```

## API 端点

| 路径 | 方法 | 说明 |
|------|------|------|
| `/api/v1/auth/register` | POST | 用户注册 |
| `/api/v1/auth/create-user` | POST | 创建用户 |
| `/api/v1/user/profile` | GET | 用户资料 |
| `/api/v1/ai-partner` | GET | AI 伙伴信息 |
| `/api/v1/ai-partner/checkin` | POST | 每日签到 |
| `/api/v1/dialogue` | POST | 发送对话 |
| `/api/v1/story` | GET | 剧情进度 |
| `/api/v1/admin/*` | * | 管理接口 |

## 开发

```bash
# 开发模式
pnpm dev:api

# 构建
pnpm build

# 生产运行
pnpm start
```

## 环境变量

| 变量 | 说明 |
|------|------|
| `PORT` | 服务端口 (默认 3000) |
| `SUPABASE_URL` | Supabase 项目 URL |
| `SUPABASE_ANON_KEY` | Supabase 匿名密钥 |
| `LLM_API_KEY` | LLM API Key (OpenAI 兼容) |
| `LLM_API_URL` | LLM API 地址 |