# 数据库新部署必读须知

> ⚠️ 本文档适用于测试环境和生产环境的数据库部署

---

## 📋 部署概述

天下一家数据库包含以下核心组件：

| 组件 | 文件 | 说明 |
|------|------|------|
| 表结构 | `schema.sql` | 用户、AI伙伴、日志等核心表 |
| 触发器 | `triggers.sql` | 用户创建时自动创建AI伙伴 |
| 函数 | `functions.sql` | 贡献值更新、签到、评估等 |
| RLS策略 | `rls-policies.sql` | 行级安全策略（必须部署！） |

---

## 🚀 部署步骤

### 第一步：创建Supabase项目

1. 访问 [Supabase Dashboard](https://supabase.com/dashboard)
2. 点击 **New Project**
3. 填写项目信息：
   - Name: `weareallworld-prod`（生产）/ `weareallworld-test`（测试）
   - Database Password: **请使用强密码并妥善保存**
   - Region: 选择最近的区域（如 Singapore）
4. 等待项目创建完成（约2分钟）

### 第二步：获取连接信息

在 **Settings > Database** 中获取：

| 信息 | 用途 |
|------|------|
| Connection String (URI) | 后端服务连接 |
| Connection String (JDBC) | Java应用连接 |
| Connection String (ODBC) | 其他工具连接 |

### 第三步：执行SQL部署

**按顺序执行以下SQL文件**（在 SQL Editor 中）：

```bash
# 1. 表结构（必须第一个）
src/contribution-evaluation/database/schema.sql

# 2. 触发器
src/contribution-evaluation/database/triggers.sql

# 3. 函数
src/contribution-evaluation/database/functions.sql

# 4. RLS策略（必须最后，安全关键！）
src/contribution-evaluation/database/rls-policies.sql
```

### 第四步：验证部署

```sql
-- 检查表是否创建
SELECT tablename FROM pg_tables WHERE schemaname = 'public';

-- 检查RLS是否启用
SELECT tablename, rowsecurity FROM pg_tables 
WHERE schemaname = 'public' AND rowsecurity = true;

-- 检查RLS策略
SELECT tablename, policyname FROM pg_policies WHERE schemaname = 'public';
```

---

## 🔐 安全配置（生产环境必做！）

### 1. RLS策略验证

**这是最重要的安全配置！**

```sql
-- 确认所有核心表都启用了RLS
SELECT tablename FROM pg_tables 
WHERE schemaname = 'public' AND rowsecurity = false;

-- 如果返回任何结果，执行：
ALTER TABLE public.<tablename> ENABLE ROW LEVEL SECURITY;
```

### 2. Service Key 保护

- ⚠️ **永远不要**将 Service Key 暴露在前端代码中
- ⚠️ **永远不要**提交到 Git 仓库
- ✅ 只在后端服务中使用 Service Key
- ✅ 前端只使用 Anon Key

### 3. 环境变量配置

```env
# .env（不要提交到Git！）
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=eyJxxx...（前端可用）
SUPABASE_SERVICE_KEY=eyJxxx...（仅后端！）
```

### 4. 数据库密码

- 使用强密码（16+字符，包含大小写字母、数字、特殊字符）
- 定期更换（建议每90天）
- 妥善保存，丢失无法恢复

---

## ⚠️ 测试环境 vs 生产环境

| 配置项 | 测试环境 | 生产环境 |
|--------|---------|---------|
| 数据保留 | 可随时清空 | **永久保留** |
| RLS策略 | 必须启用 | **必须启用** |
| 备份 | 可选 | **必须配置** |
| 监控 | 可选 | **建议配置** |
| 密码强度 | 中等 | **高强度** |

---

## 🔄 数据迁移

### 从测试库迁移到生产库

```bash
# 1. 导出测试库数据
pg_dump "$TEST_DB_URL" > test_data.sql

# 2. 导入到生产库
psql "$PROD_DB_URL" < test_data.sql

# 3. 重新部署RLS策略（重要！）
psql "$PROD_DB_URL" < rls-policies.sql
```

### 清空测试数据

```sql
-- ⚠️ 危险操作！仅用于测试环境
TRUNCATE users CASCADE;
-- 这会级联删除所有关联数据
```

---

## 🧪 部署后测试

### 运行安全测试

```bash
cd WeAreAllWorld
export $(grep -v '^#' .env | xargs)
pnpm run test:security
```

### 期望结果

```
✅ 通过: 53
❌ 失败: 0
📈 通过率: 100%
```

### 如果测试失败

1. 检查 RLS 是否启用
2. 检查函数是否正确部署
3. 检查触发器是否生效
4. 参考 `docs/REGRESSION_TEST_GUIDE.md`

---

## 📁 部署文件清单

```
src/contribution-evaluation/database/
├── schema.sql          # 表结构（第一个执行）
├── triggers.sql        # 触发器
├── functions.sql       # 函数
├── rls-policies.sql    # RLS策略（最后一个执行）
└── deploy.sql          # 一键部署脚本（可选）
```

---

## 🆘 常见问题

### Q: RLS策略报错 "policy already exists"

A: 这是正常的，说明策略已部署。可以忽略或先执行 `DROP POLICY IF EXISTS ...`

### Q: 函数报错 "function already exists"

A: 使用 `CREATE OR REPLACE FUNCTION` 会自动替换

### Q: 用户创建后没有AI伙伴

A: 检查触发器是否正确部署：
```sql
SELECT tgname FROM pg_trigger WHERE tgrelid = 'users'::regclass;
```

### Q: 跨用户数据访问测试失败

A: 确认 RLS 已启用：
```sql
SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public';
```

---

## 📞 相关文档

- 回归测试指南: `docs/REGRESSION_TEST_GUIDE.md`
- 安全问题报告: `docs/SECURITY_ISSUES.md`
- RLS部署指南: `docs/DEPLOY_RLS.md`

---

## ✅ 部署检查清单

打印此清单，逐项确认：

- [ ] Supabase 项目已创建
- [ ] 数据库密码已保存
- [ ] schema.sql 已执行
- [ ] triggers.sql 已执行
- [ ] functions.sql 已执行
- [ ] rls-policies.sql 已执行
- [ ] RLS 已启用（所有核心表）
- [ ] 环境变量已配置
- [ ] Service Key 未暴露
- [ ] 安全测试通过（100%）

---

*最后更新: 2026-03-07*
*适用版本: WeAreAllWorld v1.0*