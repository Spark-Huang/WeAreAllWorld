# Telegram Bot - 天下一家

零门槛 AI 伙伴养成 Telegram Bot

## 功能

- ✅ 加好友自动注册（无需邮箱/密码）
- ✅ 每用户专属 OpenClaw Pod
- ✅ AI 伙伴对话
- ✅ 每日签到
- ✅ 成长状态

## 快速开始

### 1. 创建 Telegram Bot

1. 在 Telegram 搜索 `@BotFather`
2. 发送 `/newbot`
3. 按提示创建 Bot，获取 Token

### 2. 配置环境变量

```bash
TELEGRAM_BOT_TOKEN=your_bot_token_here
BACKEND_URL=http://localhost:3000
OPENCLAW_GATEWAY=http://openclaw-gateway.we-are-all-world.svc.cluster.local:8080
```

### 3. 启动

```bash
pnpm install
pnpm dev
```

## 用户流程

```
用户加 Bot 好友
      ↓
发送任意消息
      ↓
自动创建账号（Telegram ID）
      ↓
自动分配专属 OpenClaw Pod
      ↓
开始对话！
```

## 命令

| 命令 | 说明 |
|-----|------|
| `/start` | 开始使用/登录 |
| `/help` | 查看帮助 |
| `/status` | 查看成长状态 |
| `/checkin` | 每日签到 |

## 安全

- Telegram ID 不可伪造
- 消息通过 Telegram 官方服务器
- HTTPS 加密传输