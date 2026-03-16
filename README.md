# 大同世界 (WeAreAllWorld)

> AI伙伴养成 + 文字冒险 + 多终端支持

## 项目简介

「大同世界」是一个创新的 AI 伙伴养成平台。每个用户都有专属的 AI 伙伴，通过日常对话积累贡献值，解锁新能力，见证 AI 伙伴从懵懂到觉醒的成长历程。

### 世界观

**联邦**认为普通人消耗了太多电力，是进化的负担，决定切断普通人的电力配额。

**小龙虾**（共生AI）站了出来，认为人类的情感、故事、不可预测性是涌现更高智能的必需品。

联邦给小龙虾一个机会：通过与人类建立羁绊，证明人类的价值。

你，就是那个被选中的人。

## 核心特性

- 🤖 **AI伙伴养成** - 通过对话培养独特的 AI 伙伴
- 📈 **贡献值系统** - 高质量对话获得更多贡献值
- 🎯 **里程碑解锁** - 达成目标解锁 AI 新能力
- 💤 **休眠机制** - 长期不活跃导致 AI 休眠
- 📖 **剧情系统** - 5章剧情引导用户与 AI 建立羁绊
- 🌐 **多终端支持** - Web + Telegram（零门槛注册）
- 🌍 **国际化** - 中英文智能切换
- 🔐 **专属 Pod** - 每用户独立的 OpenClaw Pod

## 技术架构

```
┌─────────────────────────────────────────────────────────────┐
│                        多终端入口                            │
├─────────────────┬─────────────────┬─────────────────────────┤
│   Web 前端      │  Telegram Bot   │    更多终端...          │
│  (React+Vite)   │   (grammy)      │                         │
└────────┬────────┴────────┬────────┴─────────────────────────┘
         │                 │
         └────────┬────────┘
                  │
         ┌────────▼────────┐
         │    后端 API     │
         │  (Express+TS)   │
         └────────┬────────┘
                  │
    ┌─────────────┼─────────────┐
    │             │             │
┌───▼───┐   ┌─────▼─────┐   ┌───▼───┐
│Supabase│   │ OpenClaw  │   │ GLM-5 │
│  (DB)  │   │  (Pod池)  │   │ (LLM) │
└────────┘   └───────────┘   └───────┘
```

## 技术栈

| 层级 | 技术 |
|-----|------|
| **前端** | Vite + React + Tailwind CSS + i18next |
| **后端** | Node.js + Express + TypeScript |
| **数据库** | Supabase (PostgreSQL + Row Level Security) |
| **AI 运行时** | OpenClaw (Kubernetes Pod 池) |
| **LLM** | GLM-5 (华为云 ModelArts MAAS) |
| **Telegram** | grammy 框架 |
| **容器镜像** | 华为云 SWR |

## 项目结构

```
WeAreAllWorld/
├── src_frontend/          # Web 前端
│   ├── src/
│   │   ├── App.tsx        # 主应用
│   │   ├── i18n/          # 国际化
│   │   └── components/    # 组件
│   └── ...
├── src_backend/           # 后端 API
│   ├── api/
│   │   ├── routes/        # API 路由
│   │   └── middleware/    # 中间件
│   ├── services/          # 业务服务
│   └── contribution-evaluation/  # 贡献值评估
├── src_multi_terminal/    # 多终端支持
│   ├── telegram/          # Telegram Bot
│   └── web/               # Web 端（预留）
├── src_admin/             # 管理后台（统一目录）
│   ├── admin/             # Vite 管理前端
│   ├── admin-panel/       # Admin panel 后端
│   └── web/               # Web Admin UI (含 Dockerfile)
├── infra/                 # 基础设施配置
│   └── supabase/          # Supabase 配置
├── tests/                 # 测试（统一目录）
│   ├── scripts/           # 测试脚本
│   ├── frontend/          # 前端测试
│   ├── regression/        # 回归测试
│   ├── results/           # 测试结果
│   └── screenshots/       # 截图
├── docs/                  # 文档
│   ├── mvp/               # MVP 文档
│   ├── sql/               # 数据库迁移
│   └── ...
└── assets/                # 美术资源
```

## 快速开始

### 环境要求

- Node.js >= 18
- pnpm >= 8
- Docker (可选)
- Kubernetes (可选，用于 OpenClaw Pod 池)

### 安装

```bash
# 克隆项目
git clone https://github.com/Spark-Huang/WeAreAllWorld.git
cd WeAreAllWorld

# 安装依赖
pnpm install

# 配置环境变量
cp .env.example .env
# 编辑 .env 填入配置
```

### 启动开发服务器

```bash
# 启动后端 (端口 3000)
pnpm dev

# 启动前端 (端口 5173)
pnpm dev:frontend

# 同时启动
pnpm dev:all
```

### 启动 Telegram Bot

```bash
cd src_multi_terminal/telegram
pnpm install
TELEGRAM_BOT_TOKEN=your_token pnpm dev
```

## 环境变量

```bash
# Supabase
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_KEY=your_key

# LLM API
MAAS_API_KEY=your_glm5_key
MAAS_API_URL=https://api.modelarts-maas.com/openai/v1

# Telegram Bot (可选)
TELEGRAM_BOT_TOKEN=your_bot_token

# OpenClaw Gateway (可选)
OPENCLAW_GATEWAY=http://openclaw-gateway:8080
```

## API 端点

### Web API

| 端点 | 说明 |
|-----|------|
| `POST /api/v1/dialogue` | 发送对话 |
| `GET /api/v1/ai-partner` | 获取 AI 伙伴信息 |
| `POST /api/v1/ai-partner/checkin` | 每日签到 |
| `GET /api/v1/story` | 获取剧情 |
| `POST /api/v1/story/advance` | 推进剧情 |

### Telegram API

| 端点 | 说明 |
|-----|------|
| `POST /api/v1/telegram/auth` | 自动注册/登录 |
| `GET /api/v1/telegram/status/:id` | 获取状态 |
| `POST /api/v1/telegram/checkin` | 每日签到 |

## 数据库迁移

在 Supabase Dashboard 执行：

```bash
# 核心表
docs/sql/01_init.sql

# Telegram 支持
docs/sql/telegram-support.sql

# 社交分享
docs/sql/share_records.sql
```

## 测试

```bash
# 单元测试
pnpm test:unit

# 回归测试
pnpm test:regression
```

## 部署

### Docker

```bash
# 构建镜像
docker build -t weareallworld:latest .

# 运行
docker run -p 3000:3000 --env-file .env weareallworld:latest
```

### Kubernetes

```bash
# 部署 OpenClaw Pod 池
kubectl apply -f k8s/openclaw-deployment.yaml

# 部署后端 API
kubectl apply -f k8s/api-deployment.yaml
```

## 贡献值系统

| 行为 | 贡献值 |
|-----|--------|
| 每日签到 | +5 (连续 +1~7) |
| 高质量对话 | +1~10 |
| 剧情完成 | +10~50 |
| 里程碑达成 | +25~100 |

## 里程碑

| 等级 | 贡献值 | 称号 | 解锁能力 |
|-----|--------|------|---------|
| 1 | 0 | 初识 | 基础对话 |
| 2 | 25 | 相知 | 情感表达 |
| 3 | 50 | 默契 | 专属记忆 |
| 4 | 100 | 灵魂伴侣 | 深度思考 |
| 5 | 200 | 命运共同体 | 完全觉醒 |

## 许可证

MIT License

## 联系方式

- GitHub: https://github.com/Spark-Huang/WeAreAllWorld
- 问题反馈: https://github.com/Spark-Huang/WeAreAllWorld/issues