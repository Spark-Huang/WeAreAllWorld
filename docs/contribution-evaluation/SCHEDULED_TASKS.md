# 计划任务文档
# Scheduled Tasks Document

> 所有计划任务必须记录在此文档中，不可仅依赖记忆！

---

## 每日安全攻防测试

### 任务ID: `daily-security-penetration`
### 执行时间: 每天 02:00 (GMT+8)
### 执行内容: 模拟顶级黑客攻击核心系统

**测试范围：**
1. SQL注入攻击测试
2. 权限隔离测试（RLS绕过）
3. 数据篡改测试
4. 并发竞态攻击
5. 负数/溢出攻击
6. 跨用户数据访问
7. 批量请求攻击
8. 特殊字符注入

**执行脚本：**
```bash
cd /root/.openclaw/workspace/WeAreAllWorld
pnpm exec ts-node tests/scripts/security-test.ts
```

**失败处理：**
- 发现 CRITICAL 级别漏洞 → 立即修复并重新测试
- 发现 HIGH 级别漏洞 → 当天修复
- 发现 MEDIUM 级别漏洞 → 3天内修复

**结果记录：**
- 测试报告保存至: `logs/security-test-YYYY-MM-DD.log`
- 发现的漏洞记录至: `docs/SECURITY_ISSUES.md`

---

## 每周数据库完整性检查

### 任务ID: `weekly-db-integrity`
### 执行时间: 每周一 03:00 (GMT+8)
### 执行内容: 检查数据库数据完整性

**检查项：**
1. 孤立数据检查（无关联用户的数据）
2. 贡献值一致性检查（total >= current >= weekly）
3. 状态一致性检查（hibernated必须有hibernated_since）
4. 外键完整性检查

**执行脚本：**
```bash
cd /root/.openclaw/workspace/WeAreAllWorld
pnpm exec ts-node tests/scripts/db-integrity-check.ts
```

---

## 每月回归测试

### 任务ID: `monthly-regression`
### 执行时间: 每月1日 04:00 (GMT+8)
### 执行内容: 完整功能回归测试

**测试范围：**
- 所有数据库函数
- 所有API接口
- 所有业务逻辑
- 性能基准测试

---

## 更新历史

| 日期 | 更新内容 | 更新人 |
|------|----------|--------|
| 2026-03-07 | 创建文档，添加每日安全测试任务 | 零号 |