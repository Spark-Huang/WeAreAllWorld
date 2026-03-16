# infra - 基础设施配置

大同世界基础设施配置文件。

## 目录结构

```
infra/
├── database/           # 数据库 Schema 和迁移
│   ├── schema.sql      # 主表结构
│   ├── functions.sql   # 数据库函数
│   ├── triggers.sql    # 触发器
│   ├── rls-policies.sql # RLS 策略
│   └── migrations/     # 迁移文件
└── supabase/           # Supabase 配置
    └── config.toml     # Supabase CLI 配置
```

## 数据库

详见 `database/README.md`