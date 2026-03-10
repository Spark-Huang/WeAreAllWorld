# Telegram Bot 实现

> 零门槛 AI 伙伴养成 Telegram Bot

## 概述

Telegram Bot 提供零门槛的用户体验：
- 用户只需加 Bot 好友
- 发送任意消息自动注册
- 无需邮箱/密码
- Telegram ID 即账号

## 架构

```
用户 → Telegram 服务器 → Bot API → 后端 API → OpenClaw Pod
                                ↓
                            Supabase DB
```

## 安全机制

### Telegram ID 不可伪造

```
黑客 A 想冒充用户 B
        ↓
需要发送带有 B 的 Telegram ID 的消息
        ↓
但消息必须通过 Telegram 官方服务器
        ↓
Telegram 服务器验证：消息来源 ≠ B
        ↓
❌ 无法伪造
```

### 安全保障

| 层面 | 保护 |
|-----|------|
| 传输层 | HTTPS 加密 |
| 身份验证 | Telegram 服务器验证用户身份 |
| Bot 认证 | 只有 Bot Token 持有者能接收消息 |
| ID 不可伪造 | Telegram ID 由服务器分配 |

## 用户流程

```
1. 用户在 Telegram 搜索 Bot
2. 点击 "Start" 或发送任意消息
3. Bot 自动创建账号（使用 Telegram ID）
4. 自动分配专属 OpenClaw Pod
5. 开始与 AI 伙伴对话
```

## 命令

| 命令 | 功能 | 说明 |
|-----|------|------|
| `/start` | 开始使用 | 自动注册/登录 |
| `/help` | 帮助 | 查看使用说明 |
| `/status` | 状态 | 查看成长状态 |
| `/checkin` | 签到 | 每日签到获取贡献值 |

## 代码结构

```
src_multi_terminal/telegram/
├── index.ts          # 主程序
├── package.json      # 依赖
├── tsconfig.json     # TypeScript 配置
└── README.md         # 说明文档
```

## 后端 API

### POST /api/v1/telegram/auth

自动注册/登录

**请求：**
```json
{
  "telegramId": 123456789,
  "telegramUsername": "username"
}
```

**响应：**
```json
{
  "userId": "uuid",
  "isNewUser": true,
  "openClawPodUrl": "http://pod-xxx:8080",
  "contribution": 0
}
```

### GET /api/v1/telegram/status/:telegramId

获取用户状态

**响应：**
```json
{
  "contribution": 100,
  "partnerName": "小零",
  "checkinStreak": 5,
  "dialogueCount": 42
}
```

### POST /api/v1/telegram/checkin

每日签到

**请求：**
```json
{
  "telegramId": 123456789
}
```

**响应：**
```json
{
  "success": true,
  "points": 7,
  "streak": 5
}
```

## 数据库

### 新增字段

```sql
ALTER TABLE users 
ADD COLUMN telegram_id BIGINT UNIQUE,
ADD COLUMN telegram_username VARCHAR(255),
ADD COLUMN last_checkin TIMESTAMPTZ,
ADD COLUMN checkin_streak INTEGER DEFAULT 0;
```

### 签到记录表

```sql
CREATE TABLE checkin_records (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  checkin_date DATE NOT NULL,
  points_earned INTEGER NOT NULL,
  streak_at_checkin INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, checkin_date)
);
```

## 配置

### 环境变量

```bash
# Telegram Bot Token（从 @BotFather 获取）
TELEGRAM_BOT_TOKEN=your_bot_token

# 后端 API
BACKEND_URL=http://localhost:3000

# OpenClaw Gateway
OPENCLAW_GATEWAY=http://openclaw-gateway:8080
```

### 创建 Bot

1. 在 Telegram 搜索 `@BotFather`
2. 发送 `/newbot`
3. 按提示设置 Bot 名称
4. 获取 Token

## 启动

```bash
cd src_multi_terminal/telegram
pnpm install
TELEGRAM_BOT_TOKEN=xxx pnpm dev
```

## OpenClaw Pod 路由

每个用户自动分配专属 OpenClaw Pod：

```typescript
async function getOrCreateOpenClawPod(userId: string): Promise<string> {
  // 检查是否有专属 Pod
  const response = await fetch(`${OPENCLAW_GATEWAY}/pod/${userId}`)
  if (response.ok) {
    return (await response.json()).podUrl
  }
  
  // 创建专属 Pod
  const createResponse = await fetch(`${OPENCLAW_GATEWAY}/pod/create`, {
    method: 'POST',
    body: JSON.stringify({ userId })
  })
  
  return (await createResponse.json()).podUrl
}
```

## 与 Web 端对比

| 特性 | Web | Telegram |
|-----|-----|----------|
| 注册方式 | 邮箱验证 | 自动注册 |
| 登录方式 | 密码 | 无需登录 |
| 用户体验 | 需注册 | 加好友即用 |
| 安全性 | 邮箱可被盗 | ID 不可伪造 |

## 未来扩展

- [ ] 支持图片消息
- [ ] 支持语音消息
- [ ] 支持群组对话
- [ ] 支持内联按钮
- [ ] 支持支付（Telegram Stars）