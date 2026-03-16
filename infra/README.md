# infra - 基础设施配置

大同世界基础设施配置文件。

## 目录结构

```
infra/
└── supabase/           # Supabase 配置
    └── config.toml     # Supabase CLI 配置
```

## Supabase

Supabase 作为后端数据库和认证服务。

### 配置

```bash
# 安装 Supabase CLI
npm install -g supabase

# 登录
supabase login

# 链接项目
supabase link --project-ref <project-ref>

# 推送数据库变更
supabase db push
```

### 数据库表

主要表结构：
- `users` - 用户表
- `ai_partners` - AI 伙伴表
- `dialogues` - 对话记录表
- `story_progress` - 剧情进度表
- `contribution_records` - 贡献值记录表

详见 `docs/sql/` 目录。