# RLS策略部署指南

## 🔴 CRITICAL安全漏洞待修复

测试结果显示以下严重问题需要立即修复：

| 问题 | 严重程度 | 状态 |
|------|---------|------|
| RLS防护 - 跨用户数据修改 | 🔴 CRITICAL | 待部署 |
| 并发竞态条件 | 🟠 HIGH | 待部署 |
| 无效输入验证 | 🟠 HIGH | 待部署 |

## 📋 部署步骤

### 方法1: Supabase Dashboard (推荐)

1. 打开 [Supabase Dashboard](https://supabase.com/dashboard)
2. 选择项目: `kmbmfzehpjjctvuagecd`
3. 进入 **SQL Editor**
4. 点击 **New query**
5. 复制以下文件内容并粘贴:
   - `src/contribution-evaluation/database/rls-policies.sql`
6. 点击 **Run** 执行

### 方法2: 使用psql (需要数据库密码)

```bash
# 获取数据库连接字符串
# Supabase Dashboard > Settings > Database > Connection string > URI

# 设置环境变量
export SUPABASE_DB_URL="postgresql://postgres.kmbmfzehpjjctvuagecd:[YOUR_PASSWORD]@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres"

# 执行部署
psql "$SUPABASE_DB_URL" -f src/contribution-evaluation/database/rls-policies.sql
```

### 方法3: 使用Supabase CLI

```bash
# 安装Supabase CLI
npm install -g supabase

# 登录
supabase login

# 链接项目
supabase link --project-ref kmbmfzehpjjctvuagecd

# 执行SQL
supabase db execute --file src/contribution-evaluation/database/rls-policies.sql
```

## ✅ 验证部署

部署后，运行以下命令验证：

```bash
cd WeAreAllWorld
pnpm run test:security
```

期望结果：
- ✅ RLS防护 - 跨用户数据修改
- ✅ 并发竞态条件
- ✅ 无效输入验证

## 📊 当前测试状态

```
✅ 通过: 49
❌ 失败: 4
🔴 严重: 1
🟠 高危: 3
📈 通过率: 92%
```

部署修复后，期望通过率达到 **100%**。

---

*生成时间: 2026-03-07*