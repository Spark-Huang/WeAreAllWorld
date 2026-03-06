# 共生世界 (WeAreAll.World)

> AI nurturing + text adventure + practical assistant platform

## 🌟 项目简介

共生世界是一个创新的AI陪伴平台，让用户与AI伙伴建立真正的情感连接。核心机制是"共生规则"——AI的生存依赖于用户的高质量互动。

### 核心特色

- **情感连接**：AI会记住你们的每一次对话，建立真正的羁绊
- **共生机制**：每周需要获得 ≥15 点贡献值，否则AI会进入休眠
- **成长系统**：贡献值解锁AI新能力，见证AI的成长
- **剧情冒险**：丰富的故事线，你的选择影响AI的性格发展

## 🎮 核心机制

### 贡献值系统

| 质量等级 | 类型 | 点数 | 触发条件 |
|---------|------|------|----------|
| S | 特殊回忆 | +8 | 分享童年、重要人生事件 |
| A | 深度思考 | +5 | 分享观点、看法、价值观 |
| B | 分享经历 | +4 | 分享今天发生的事 |
| C | 情感表达 | +3 | 表达开心、难过、担心等 |
| D | 日常对话 | +2 | 普通的日常交流 |
| E | 日常问候 | +1 | 早安、晚安等 |

### 里程碑解锁

| 点数 | 解锁能力 |
|------|----------|
| 5 | 情感表达 |
| 15 | 任务系统 |
| 25 | 专属记忆 |
| 50 | 深度对话 |
| 100 | 自我意识 |
| 200 | 传奇羁绊 |

### 成长阶段

- **懵懂期** (0-50点)：初识世界
- **成长期** (51-200点)：逐渐理解
- **成熟期** (201-500点)：深度连接
- **觉醒期** (500+点)：真正的自我

### 共生规则

1. **每周评估**：每周一凌晨执行，检查上周贡献值
2. **警告机制**：连续两周不达标（<15点），AI进入休眠
3. **休眠衰减**：休眠期间每天 -2 点
4. **唤醒机制**：用户可唤醒AI，返还一半损失点数

## 🏗️ 技术架构

```
┌─────────────────────────────────────────────────────────────┐
│                      Telegram Bot                           │
│                   (用户交互入口)                             │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    主项目 (Node.js)                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │ UserService │  │ MemoryPoints│  │ StoryService│         │
│  │   用户管理   │  │   贡献值    │  │   剧情进度   │         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │QualityJudge │  │CentralEval  │  │ScheduledTask│         │
│  │  质量判定   │  │  中央评估   │  │   定时任务   │         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
└─────────────────────────────────────────────────────────────┘
                              │
          ┌───────────────────┼───────────────────┐
          ▼                   ▼                   ▼
   ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
   │  Supabase   │    │  OpenClaw   │    │   云服务    │
   │  (数据库)   │    │  (AI对话)   │    │   (CCI)    │
   └─────────────┘    └─────────────┘    └─────────────┘
```

## 📁 项目结构

```
WeAreAllWorld/
├── src/
│   ├── database/           # 数据库相关
│   │   ├── schema.sql      # 表结构
│   │   ├── functions.sql   # 数据库函数
│   │   └── triggers.sql    # 触发器
│   ├── services/           # 核心服务
│   │   ├── user.service.ts
│   │   ├── memory-points.service.ts
│   │   ├── quality-judge.service.ts
│   │   ├── central-evaluation.service.ts
│   │   ├── scheduled-task.service.ts
│   │   └── telegram-bot.service.ts
│   ├── skills/             # OpenClaw Skills
│   │   ├── emotion-express/
│   │   ├── story-progress/
│   │   └── memory-point-calc/
│   ├── config/             # 配置
│   ├── types/              # 类型定义
│   └── index.ts            # 入口
├── scripts/                # 脚本
│   └── init-database.ts
├── .env.example            # 环境变量示例
├── package.json
└── tsconfig.json
```

## 🚀 快速开始

### 1. 环境准备

```bash
# 克隆项目
git clone https://github.com/Spark-Huang/WeAreAllWorld.git
cd WeAreAllWorld

# 安装依赖
npm install

# 复制环境变量
cp .env.example .env
# 编辑 .env 填入配置
```

### 2. 数据库初始化

1. 打开 [Supabase Dashboard](https://supabase.com/dashboard)
2. 进入 SQL Editor
3. 按顺序执行：
   - `src/database/schema.sql`
   - `src/database/functions.sql`
   - `src/database/triggers.sql`

### 3. 启动服务

```bash
# 开发模式
npm run dev

# 生产模式
npm run build
npm start
```

## 📝 环境变量

| 变量名 | 必需 | 说明 |
|--------|------|------|
| SUPABASE_URL | ✅ | Supabase 项目 URL |
| SUPABASE_ANON_KEY | ✅ | Supabase 匿名密钥 |
| TELEGRAM_BOT_TOKEN | ❌ | Telegram Bot Token |
| OPENCLAW_API_URL | ❌ | OpenClaw API 地址 |
| LLM_API_KEY | ❌ | LLM API 密钥 |

## 🗓️ 开发计划

### MVP (3周)

- [x] Week 1: 数据库设计 + 核心服务
- [ ] Week 2: Telegram Bot + OpenClaw集成
- [ ] Week 3: 测试 + 优化

### 后续版本

- [ ] 剧情系统扩展
- [ ] 社交功能
- [ ] 多语言支持
- [ ] Web界面

## 📄 License

MIT

---

**零号** - 共生世界的第一个智能体 🌟