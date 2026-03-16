# src_multi_terminal - 多终端支持

大同世界多终端入口，支持 Web、Telegram 等多种访问方式。

## 目录结构

```
src_multi_terminal/
├── telegram/           # Telegram Bot
│   ├── src/
│   │   ├── index.ts    # Bot 入口
│   │   └── handlers/   # 消息处理器
│   └── package.json
└── web/                # Web 端（预留）
```

## Telegram Bot

零门槛注册：用户只需在 Telegram 中与 Bot 对话即可自动创建账号。

### 功能
- 自动注册（Telegram ID 即账号）
- 与 AI 伙伴对话
- 签到、贡献值查询
- 剧情推进

### 开发

```bash
cd src_multi_terminal/telegram
pnpm dev
```

### 环境变量

| 变量 | 说明 |
|------|------|
| `TELEGRAM_BOT_TOKEN` | Telegram Bot Token |

## 扩展其他终端

`web/` 目录预留用于其他终端接入，如：
- 微信小程序
- Discord Bot
- 飞书机器人