# 大同世界 架构文档

## 系统架构

```
┌─────────────────────────────────────────────────────────────┐
│                        前端 (React)                          │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐        │
│  │ 登录注册 │  │ AI对话  │  │ 伙伴状态│  │ 里程碑  │        │
│  └────┬────┘  └────┬────┘  └────┬────┘  └────┬────┘        │
└───────┼────────────┼────────────┼────────────┼──────────────┘
        │            │            │            │
        ▼            ▼            ▼            ▼
┌─────────────────────────────────────────────────────────────┐
│                     REST API (Express)                       │
│  ┌──────────────────────────────────────────────────────┐   │
│  │                   认证中间件                          │   │
│  │     Supabase JWT  │  API Key + User ID              │   │
│  └──────────────────────────────────────────────────────┘   │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐        │
│  │ /auth   │  │ /user   │  │/ai-partner│ │/dialogue│        │
│  └────┬────┘  └────┬────┘  └────┬────┘  └────┬────┘        │
└───────┼────────────┼────────────┼────────────┼──────────────┘
        │            │            │            │
        ▼            ▼            ▼            ▼
┌─────────────────────────────────────────────────────────────┐
│                    服务层 (Services)                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │ UserService │  │ LLMService  │  │MemoryService│         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
└─────────────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────┐
│                  数据层 (Supabase)                           │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐        │
│  │ users   │  │ai_partners│ │interaction│ │evaluations│      │
│  └─────────┘  └─────────┘  └─────────┘  └─────────┘        │
└─────────────────────────────────────────────────────────────┘
```

## 目录结构

```
WeAreAllWorld/
├── src/
│   ├── index.ts                 # 应用入口
│   ├── config/                  # 配置
│   │   └── index.ts
│   ├── api/                     # REST API
│   │   ├── index.ts             # Express 应用
│   │   ├── middleware/          # 中间件
│   │   │   └── auth.middleware.ts
│   │   └── routes/              # 路由
│   │       ├── user.routes.ts
│   │       ├── ai-partner.routes.ts
│   │       ├── dialogue.routes.ts
│   │       └── stats.routes.ts
│   ├── services/                # 服务层
│   │   ├── user.service.ts
│   │   ├── llm.service.ts
│   │   └── telegram-bot.service.ts
│   ├── contribution-evaluation/ # 贡献值系统
│   │   ├── services/
│   │   │   ├── quality-judge.service.ts
│   │   │   ├── memory-points.service.ts
│   │   │   ├── central-evaluation.service.ts
│   │   │   └── scheduled-task.service.ts
│   │   └── types/
│   │       └── index.ts
│   └── skills/                  # AI 能力模块
│       ├── emotion-express/
│       ├── story-progress/
│       └── memory-point-calc/
├── frontend/                    # React 前端
│   ├── src/
│   │   ├── App.tsx
│   │   ├── main.tsx
│   │   ├── index.css
│   │   └── lib/
│   │       └── supabase.ts
│   ├── vite.config.ts
│   └── tailwind.config.js
├── tests/                       # 测试（统一目录）
│   ├── scripts/                 # 测试脚本
│   ├── frontend/                # 前端测试
│   ├── regression/              # 回归测试
│   └── results/                 # 测试结果
├── ecosystem.config.json        # PM2 配置
├── .env                         # 环境变量
└── package.json
```

## 数据模型

### users
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY,
  telegram_user_id BIGINT UNIQUE,
  telegram_username VARCHAR(255),
  onboarding_step INTEGER DEFAULT 0,
  onboarding_completed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### ai_partners
```sql
CREATE TABLE ai_partners (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  status VARCHAR(20) DEFAULT 'active',
  total_contribution INTEGER DEFAULT 0,
  weekly_contribution INTEGER DEFAULT 0,
  current_contribution INTEGER DEFAULT 0,
  violation_count INTEGER DEFAULT 0,
  abilities JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### interaction_logs
```sql
CREATE TABLE interaction_logs (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  message_hash VARCHAR(255),
  category VARCHAR(50),
  granted_power INTEGER,
  data_rarity VARCHAR(50),
  ai_understanding JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

## 认证流程

### 1. Supabase Auth (前端)
```
用户注册/登录 → Supabase Auth → JWT Token → API 请求
```

### 2. API Key (服务端/测试)
```
API Key + User ID → 验证用户存在 → API 请求
```

## 贡献值计算流程

```
用户消息 → 质量判定 (LLM) → 计算贡献值 → 更新AI伙伴 → 返回回复
    │
    ├── special_memory: 10点
    ├── deep_thought: 8点
    ├── experience: 5点
    ├── emotion: 3点
    ├── daily: 2点
    └── greeting: 1点
```

## 定时任务

| 任务 | 频率 | 描述 |
|------|------|------|
| 周评估 | 每周一 | 评估用户活跃度，更新贡献值 |
| 休眠检测 | 每日 | 检测不活跃用户，AI进入休眠 |
| 贡献值衰减 | 每日 | 休眠用户贡献值衰减 |

## 部署

### 开发环境
```bash
pnpm dev          # 后端
cd frontend && pnpm dev  # 前端
```

### 生产环境
```bash
pnpm build
pm2 start ecosystem.config.json
pm2 save
```

## 监控

```bash
pm2 status        # 查看状态
pm2 logs          # 查看日志
pm2 monit         # 实时监控
```