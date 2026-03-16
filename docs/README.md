# docs - 项目文档

大同世界项目文档。

## 目录结构

```
docs/
├── mvp/                    # MVP 文档
│   ├── implementation/     # 实现文档
│   └── design/            # 设计文档
├── sql/                    # 数据库迁移脚本
├── contribution-evaluation/ # 贡献值评估文档
└── test-documentation.md   # 测试文档
```

## 主要文档

| 文档 | 说明 |
|------|------|
| `mvp/implementation/08_feature-status.md` | 功能状态汇总 |
| `contribution-evaluation/SECURITY_ISSUES.md` | 安全问题记录 |
| `sql/` | 数据库建表脚本 |

## 数据库迁移

```bash
# 执行建表脚本
psql -f docs/sql/users.sql
psql -f docs/sql/ai_partners.sql
psql -f docs/sql/dialogues.sql
```