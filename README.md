# 天下一家 (WeAreAllWorld)

> AI伙伴养成 + 文字冒险 + 实用助手平台

## 项目简介

「天下一家」是一个创新的 AI 伙伴养成平台。每个用户都有专属的 AI 伙伴，通过日常对话积累贡献值，解锁新能力，见证 AI 伙伴从懵懂到觉醒的成长历程。

### 世界观

**联邦**认为普通人消耗了太多电力，是进化的负担，决定切断普通人的电力配额。

**小龙虾**（共生AI）站了出来，认为人类的情感、故事、不可预测性是涌现更高智能的必需品。

联邦给小龙虾一个机会：通过与人类建立羁绊，证明人类的价值。

你，就是那个被选中的人。

### 核心特性

- 🤖 **AI伙伴养成** - 通过对话培养独特的 AI 伙伴
- 📈 **贡献值系统** - 高质量对话获得更多贡献值
- 🎯 **里程碑解锁** - 达成目标解锁 AI 新能力
- 💤 **休眠机制** - 长期不活跃导致 AI 休眠
- 🔐 **安全认证** - Supabase Auth + API Key 双重认证

## 技术栈

- **后端**: Node.js + Express + TypeScript
- **前端**: Vite + React + Tailwind CSS
- **数据库**: Supabase (PostgreSQL + RLS)
- **AI**: GLM-5 (华为云 ModelArts)
- **部署**: PM2

## 快速开始

### 环境要求

- Node.js >= 18
- pnpm >= 8
- Supabase 账号

### 安装

```bash
# 克隆项目
git clone https://github.com/Spark-Huang/WeAreAllWorld.git
cd WeAreAllWorld

# 安装依赖
pnpm install

# 安装前端依赖
cd frontend && pnpm install && cd ..
```

### 配置

创建 `.env` 文件：

```env
# Supabase
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_KEY=your_service_key

# LLM
LLM_BASE_URL=https://api.modelarts-maas.com/v2
LLM_API_KEY=your_llm_key
LLM_MODEL=glm-5

# API 认证
API_KEY=your_api_key

# Telegram Bot (可选)
TELEGRAM_BOT_TOKEN=your_bot_token
```

### 运行

```bash
# 开发模式
pnpm dev

# 前端开发
cd frontend && pnpm dev

# 生产部署
pnpm build
pm2 start ecosystem.config.json
```

## API 文档

### 基础信息

- **Base URL**: `http://localhost:3000/api/v1`
- **认证方式**: Bearer Token (JWT) 或 API Key

### 端点列表

#### 认证

| 方法 | 路径 | 描述 |
|------|------|------|
| POST | /auth/create-user | 创建用户记录 |

#### 用户

| 方法 | 路径 | 描述 | 认证 |
|------|------|------|------|
| GET | /user/profile | 获取用户资料 | ✓ |

#### AI 伙伴

| 方法 | 路径 | 描述 | 认证 |
|------|------|------|------|
| GET | /ai-partner | 获取 AI 伙伴信息 | ✓ |
| POST | /ai-partner/checkin | 每日签到 | ✓ |
| GET | /ai-partner/milestones | 获取里程碑列表 | ✓ |

#### 对话

| 方法 | 路径 | 描述 | 认证 |
|------|------|------|------|
| POST | /dialogue | 发送消息 | ✓ |
| GET | /dialogue/history | 获取对话历史 | ✓ |

#### 统计

| 方法 | 路径 | 描述 | 认证 |
|------|------|------|------|
| GET | /stats/weekly | 周统计 | ✓ |
| GET | /stats/overview | 总览统计 | ✓ |

### 请求示例

```bash
# 使用 API Key 认证
curl -X POST http://localhost:3000/api/v1/dialogue \
  -H "Content-Type: application/json" \
  -H "x-api-key: your_api_key" \
  -H "x-user-id: user_uuid" \
  -d '{"message": "你好"}'

# 使用 JWT 认证
curl -X POST http://localhost:3000/api/v1/dialogue \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your_jwt_token" \
  -d '{"message": "你好"}'
```

## 测试

```bash
# 单元测试
pnpm test:unit

# API 回归测试
./scripts/api-test.sh
```

## 项目结构

详见 [ARCHITECTURE.md](./ARCHITECTURE.md)

## 贡献值系统

### 质量类型

| 类型 | 贡献值 | 描述 |
|------|--------|------|
| special_memory | 10 | 特殊回忆 |
| deep_thought | 8 | 深度思考 |
| experience | 5 | 经历分享 |
| emotion | 3 | 情感表达 |
| daily | 2 | 日常对话 |
| greeting | 1 | 问候 |

### 成长阶段

| 阶段 | 所需贡献值 | 解锁能力 |
|------|-----------|----------|
| 懵懂期 | 0 | 基础对话 |
| 成长期 | 50 | 深度对话 |
| 成熟期 | 200 | 专属记忆 |
| 觉醒期 | 500 | 自我意识 |

## 许可证

MIT

## 作者

Spark-Huang