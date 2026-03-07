# 天下一家 (WeAreAllWorld) 项目架构

## 目录结构

```
WeAreAllWorld/
├── src/
│   ├── api/                    # REST API 层
│   │   ├── index.ts            # Express 应用入口
│   │   ├── middleware/         # 中间件
│   │   │   └── auth.middleware.ts
│   │   └── routes/             # API 路由
│   │       ├── user.routes.ts
│   │       ├── ai-partner.routes.ts
│   │       ├── dialogue.routes.ts
│   │       └── stats.routes.ts
│   ├── services/               # 业务服务层
│   │   ├── user.service.ts     # 用户管理
│   │   ├── llm.service.ts      # LLM 集成
│   │   └── telegram-bot.service.ts
│   ├── contribution/           # 贡献值系统（核心业务）
│   │   ├── services/
│   │   │   ├── quality-judge.service.ts    # 质量判定
│   │   │   ├── memory-points.service.ts    # 贡献值管理
│   │   │   ├── central-evaluation.service.ts
│   │   │   └── scheduled-task.service.ts   # 定时任务
│   │   └── types.ts
│   ├── config/                 # 配置管理
│   │   └── index.ts
│   └── index.ts                # 应用入口
├── frontend/                   # React 前端
│   └── src/
│       ├── App.tsx
│       ├── main.tsx
│       ├── index.css
│       └── lib/
│           └── supabase.ts
├── scripts/                    # 脚本
│   ├── api-test.sh            # API 回归测试
│   └── unit-test.ts           # 单元测试
├── ecosystem.config.json       # PM2 配置
├── .env                        # 环境变量
└── package.json
```

## 核心模块

### 1. API 层 (`src/api/`)
- **index.ts**: Express 应用配置，路由挂载
- **middleware/auth.middleware.ts**: 认证中间件（JWT + API Key）
- **routes/**: RESTful API 路由

### 2. 服务层 (`src/services/`)
- **user.service.ts**: 用户 CRUD 操作
- **llm.service.ts**: LLM API 集成（GLM-5）
- **telegram-bot.service.ts**: Telegram Bot（可选）

### 3. 贡献值系统 (`src/contribution/`)
- **quality-judge.service.ts**: 对话质量判定
- **memory-points.service.ts**: 贡献值计算与更新
- **scheduled-task.service.ts**: 定时任务（周评估、休眠检测）

## 数据流

```
用户消息 → API路由 → 认证中间件
    ↓
质量判定服务 → 计算贡献值
    ↓
LLM服务 → 生成AI回复
    ↓
更新数据库 → 返回响应
```

## 认证流程

```
┌─────────────────┐     ┌─────────────────┐
│  Supabase Auth  │     │    API Key      │
│  (前端用户)      │     │  (服务端调用)    │
└────────┬────────┘     └────────┬────────┘
         │                       │
         ▼                       ▼
┌─────────────────────────────────────────┐
│           auth.middleware.ts            │
│  1. 验证 JWT / API Key                   │
│  2. 获取用户信息                         │
│  3. 注入 req.user                       │
└─────────────────────────────────────────┘
```

## API 端点

| 方法 | 路径 | 描述 | 认证 |
|------|------|------|------|
| GET | /health | 健康检查 | 无 |
| POST | /api/v1/auth/create-user | 创建用户 | 无 |
| GET | /api/v1/user/profile | 用户资料 | 需要 |
| GET | /api/v1/ai-partner | AI伙伴信息 | 需要 |
| POST | /api/v1/ai-partner/checkin | 每日签到 | 需要 |
| POST | /api/v1/dialogue | 发送消息 | 需要 |
| GET | /api/v1/dialogue/history | 对话历史 | 需要 |
| GET | /api/v1/stats/weekly | 周统计 | 需要 |

## 部署

```bash
# 开发环境
pnpm dev

# 生产环境（PM2）
pm2 start ecosystem.config.json
pm2 save
```