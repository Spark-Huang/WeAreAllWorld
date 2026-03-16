# infra/database - 数据库

大同世界数据库 Schema 和迁移文件。

## 目录结构

```
infra/database/
├── schema.sql              # 主表结构
├── functions.sql           # 数据库函数
├── triggers.sql            # 触发器
├── rls-policies.sql        # Row Level Security 策略
├── bot-keys-schema.sql     # Bot Key 表结构
├── telegram-support.sql    # Telegram 支持相关
├── emotional-impact.sql    # 情感影响相关
├── share_records.sql       # 分享记录表
├── openclaw_instances.sql  # OpenClaw 实例表
├── engagement-features.sql # 参与度功能
├── fix-trigger.sql         # 触发器修复
└── migrations/             # 迁移文件
    ├── async_quality_migration.sql
    ├── story_migration.sql
    └── 005_add_new_api_fields.sql
```

## 主要表

| 表名 | 说明 |
|------|------|
| `users` | 用户表 |
| `ai_partners` | AI 伙伴表 |
| `dialogues` | 对话记录表 |
| `story_progress` | 剧情进度表 |
| `contribution_records` | 贡献值记录表 |
| `bot_keys` | Bot Key 表 |
| `openclaw_instances` | OpenClaw 实例表 |

## 使用

```bash
# 执行 Schema
psql -f infra/database/schema.sql

# 执行 RLS 策略
psql -f infra/database/rls-policies.sql

# 执行迁移
psql -f infra/database/migrations/story_migration.sql
```

## Supabase

如果使用 Supabase，可以通过 Supabase CLI 管理：

```bash
supabase db push
```