# 回归测试必读须知

## 📋 概述

大同世界核心系统安全测试套件，目标：**世界顶级黑客也无法攻破**。

---

## 🚀 快速开始

### 运行测试

```bash
cd WeAreAllWorld

# 设置环境变量（确保.env文件已配置）
export $(grep -v '^#' .env | xargs)

# 运行安全测试
pnpm run test:security
```

### 期望结果

```
✅ 通过: 53
❌ 失败: 0
📈 通过率: 100%
```

---

## 📊 测试范围

| 部分 | 测试项 | 数量 |
|------|--------|------|
| 功能完整性 | 用户创建、AI伙伴、贡献值、里程碑、签到、评估、休眠唤醒 | 19 |
| 边界条件 | 负数防护、衰减至零、连续未达标 | 5 |
| 安全渗透 | SQL注入、RLS权限、并发竞态、无效输入、特殊字符 | 22 |
| 数据完整性 | 级联删除、唯一约束、外键约束 | 4 |

**总计: 53 项测试**

---

## ⚠️ 测试前检查清单

### 1. 环境变量

确保 `.env` 文件包含以下配置：

```env
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=xxx
SUPABASE_SERVICE_KEY=xxx
```

### 2. 数据库状态

- [ ] RLS 已启用（所有核心表）
- [ ] 触发器已部署（用户创建时自动创建AI伙伴）
- [ ] 函数已部署（update_contribution 等）

### 3. 依赖安装

```bash
pnpm install
```

---

## 🔧 常见问题排查

### 问题1: RLS防护测试失败

**症状**: `RLS防护 - 跨用户数据修改` 失败

**原因**: RLS未启用或策略未部署

**解决**:
```sql
-- 在Supabase SQL Editor中执行
ALTER TABLE public.ai_partners ENABLE ROW LEVEL SECURITY;
-- 然后执行 rls-policies.sql
```

### 问题2: 并发竞态条件失败

**症状**: `并发竞态条件` 期望50，实际小于50

**原因**: `update_contribution` 函数缺少行级锁

**解决**: 确保函数包含 `FOR UPDATE` 锁
```sql
SELECT ... FROM ai_partners WHERE user_id = p_user_id FOR UPDATE;
```

### 问题3: 无效输入验证失败

**症状**: `无效输入拒绝: null user_id` 失败

**原因**: 函数缺少输入验证逻辑

**解决**: 确保函数包含输入验证
```sql
IF p_user_id IS NULL THEN
  RETURN jsonb_build_object('error', 'user_id cannot be null');
END IF;
```

---

## 📁 相关文件

| 文件 | 说明 |
|------|------|
| `tests/scripts/security-test.ts` | 测试套件主文件 |
| `src/contribution-evaluation/database/schema.sql` | 数据库表结构 |
| `src/contribution-evaluation/database/functions.sql` | 数据库函数 |
| `src/contribution-evaluation/database/rls-policies.sql` | RLS安全策略 |
| `src/contribution-evaluation/database/triggers.sql` | 数据库触发器 |

---

## 🔄 CI/CD 集成

### GitHub Actions

```yaml
name: Security Test

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
        with:
          version: 8
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: 'pnpm'
      - run: pnpm install
      - run: pnpm run test:security:ci
        env:
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_SERVICE_KEY: ${{ secrets.SUPABASE_SERVICE_KEY }}
```

---

## 📝 测试结果解读

### 通过率等级

| 通过率 | 状态 | 说明 |
|--------|------|------|
| 100% | ✅ 安全 | 系统安全可靠 |
| 90-99% | ⚠️ 警告 | 存在中低风险问题 |
| <90% | 🚨 危险 | 存在严重安全漏洞 |

### 严重程度说明

| 级别 | 说明 | 处理优先级 |
|------|------|-----------|
| 🔴 CRITICAL | 可导致数据泄露/篡改 | 立即修复 |
| 🟠 HIGH | 存在安全风险 | 今日修复 |
| 🟡 MEDIUM | 功能异常 | 本周修复 |
| 🟢 LOW | 边界情况 | 可延后 |

---

## 🛡️ 安全最佳实践

1. **每次部署前运行测试** - 确保没有引入新的安全漏洞
2. **定期运行测试** - 建议每日自动运行
3. **关注CRITICAL级别** - 任何CRITICAL失败都需要立即处理
4. **保持测试更新** - 新功能需要添加对应的测试用例

---

## 📞 联系方式

如有问题，请查看：
- 安全问题报告: `docs/SECURITY_ISSUES.md`
- RLS部署指南: `docs/DEPLOY_RLS.md`

---

*最后更新: 2026-03-07*
*测试套件版本: v1.0*