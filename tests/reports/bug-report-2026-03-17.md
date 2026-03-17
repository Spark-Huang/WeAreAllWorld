# 🐛 Bug 报告 - 2026-03-17

## 测试环境
- 时间: 2026-03-17 15:45
- 分支: main (commit: e22bc5f)
- 测试类型: 全面回归测试

---

## 🔴 高优先级 Bug

### 1. 质量判定引擎 - 焦虑情感判定错误
- **位置**: `src_backend/contribution-evaluation/services/quality-judge.service.ts`
- **测试**: `tests/quality-judge-test.ts`
- **期望**: 焦虑消息 → `emotion` 类型, 3 点
- **实际**: 焦虑消息 → `experience` 类型, 4 点
- **影响**: 用户分享焦虑情绪时，贡献值计算错误

### 2. 质量判定引擎 - 生活经历判定错误
- **位置**: `src_backend/contribution-evaluation/services/quality-judge.service.ts`
- **测试**: `tests/quality-judge-test.ts`
- **期望**: 生活经历 → `experience` 类型, 4 点
- **实际**: 生活经历 → `daily` 类型, 2 点
- **影响**: 用户分享生活经历时，贡献值被低估

### 3. 质量判定引擎 - 价值观判定错误
- **位置**: `src_backend/contribution-evaluation/services/quality-judge.service.ts`
- **测试**: `tests/quality-judge-test.ts`
- **期望**: 价值观讨论 → `deep_thought` 类型, 5 点
- **实际**: 价值观讨论 → `special_memory` 类型, 8 点
- **影响**: 价值观讨论被错误归类为特殊回忆，贡献值过高

---

## 🟠 中优先级 Bug

### 4. API 接口 - ensure-user 认证失败
- **位置**: `src_backend/api/routes/user.routes.ts`
- **测试**: `tests/api-interface-test.ts`
- **接口**: `POST /auth/ensure-user`
- **期望**: 200/201
- **实际**: 401 Unauthorized
- **影响**: 新用户注册流程可能受影响

### 5. Telegram 零门槛注册失败
- **位置**: 用户系统
- **测试**: `tests/comprehensive-test-suite.ts`
- **状态**: 失败
- **影响**: Telegram 新用户无法直接注册

### 6. 里程碑阈值检查失败
- **位置**: AI伙伴系统
- **测试**: `tests/comprehensive-test-suite.ts`
- **状态**: 失败
- **影响**: 里程碑解锁逻辑可能有问题

---

## 🟡 性能问题

### 7. 高并发成功率下降
- **测试**: `tests/performance-test.ts`
- **50 并发**: 成功率 48%
- **100 并发**: 成功率 0%
- **原因**: 可能是 Rate Limiting 或数据库连接池限制
- **建议**: 检查 rate-limit 配置和 Supabase 连接池设置

---

## ✅ 已通过的测试

| 测试类型 | 通过 | 失败 | 通过率 |
|---------|------|------|--------|
| 单元测试 | 30 | 0 | 100% |
| 端到端测试 | 26 | 0 | 100% |
| 安全测试 | 53 | 0 | 100% |
| 质量判定测试 | 22 | 3 | 88% |
| API接口测试 | 11 | 1 | 92% |

---

## 📋 建议修复顺序

1. **质量判定引擎** - 影响 3 个判定逻辑，建议优先修复
2. **API 认证问题** - 影响新用户注册
3. **性能优化** - 高并发场景需要优化

---

## 🔧 测试命令

```bash
# 运行所有测试
npx ts-node tests/run-all-tests.ts

# 单独运行
npx ts-node tests/quality-judge-test.ts
npx ts-node tests/api-interface-test.ts
npx ts-node tests/performance-test.ts
npx ts-node tests/comprehensive-test-suite.ts
```