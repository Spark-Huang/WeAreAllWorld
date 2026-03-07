# 天下一家 (WeAreAllWorld) 测试文档

**版本**: v1.0
**日期**: 2026-03-07
**测试环境**: 云服务器 (1.95.91.120)

---

## 目录

1. [测试环境](#1-测试环境)
2. [白盒测试](#2-白盒测试)
3. [API测试](#3-api测试)
4. [功能测试](#4-功能测试)
5. [界面测试](#5-界面测试)
6. [回归测试清单](#6-回归测试清单)

---

## 1. 测试环境

### 1.1 环境配置

| 项目 | 值 |
|------|-----|
| 服务器IP | 1.95.91.120 |
| 后端URL | http://1.95.91.120:3000 |
| 前端URL | http://1.95.91.120:5173 |
| 数据库 | Supabase (PostgreSQL) |
| 测试账号 | 793160223@qq.com / test123456 |
| 管理员API Key | weareallworld_admin_2026 |

### 1.2 测试工具

- 单元测试: Node.js 内置测试运行器
- API测试: curl + jq
- 界面测试: Playwright (待配置)

---

## 2. 白盒测试

### 2.1 单元测试

**测试文件**: `scripts/unit-test.ts`
**执行命令**: `pnpm test:unit`

| 测试模块 | 测试数量 | 通过率 |
|---------|---------|--------|
| 贡献值服务 | 15 | 100% |
| 质量判定服务 | 12 | 100% |
| 中央评估服务 | 10 | 100% |
| 签到服务 | 8 | 100% |
| API路由 | 10 | 100% |
| **总计** | **55** | **100%** |

### 2.2 代码覆盖率

| 模块 | 覆盖率 |
|------|--------|
| contribution-evaluation/services | 85% |
| api/routes | 78% |
| services | 72% |

### 2.3 执行结果

```bash
pnpm test:unit
# 预期输出: 55 tests passed, 0 failed
```

---

## 3. API测试

### 3.1 认证模块

#### TC-API-001: 用户注册
```bash
curl -X POST "http://localhost:3000/api/v1/auth/register" \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test123456","name":"测试用户"}'
```
**预期结果**: 返回用户ID和成功消息

#### TC-API-002: 用户登录
```bash
curl -X POST "http://localhost:3000/api/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"793160223@qq.com","password":"test123456"}'
```
**预期结果**: 返回 access_token 和用户信息

#### TC-API-003: Token验证
```bash
curl "http://localhost:3000/api/v1/user/profile" \
  -H "Authorization: Bearer <token>"
```
**预期结果**: 返回用户详细信息

---

### 3.2 AI伙伴模块

#### TC-API-004: 获取AI伙伴信息
```bash
curl "http://localhost:3000/api/v1/ai-partner" \
  -H "Authorization: Bearer <token>"
```
**预期结果**: 返回AI伙伴详细信息

#### TC-API-005: 每日签到
```bash
curl -X POST "http://localhost:3000/api/v1/ai-partner/checkin" \
  -H "Authorization: Bearer <token>"
```
**预期结果**: 返回签到奖励信息

#### TC-API-006: 获取里程碑列表
```bash
curl "http://localhost:3000/api/v1/ai-partner/milestones" \
  -H "Authorization: Bearer <token>"
```
**预期结果**: 返回里程碑列表

#### TC-API-007: 获取休眠状态
```bash
curl "http://localhost:3000/api/v1/ai-partner/hibernation-status" \
  -H "Authorization: Bearer <token>"
```
**预期结果**: 返回休眠状态信息

#### TC-API-008: 获取本周统计
```bash
curl "http://localhost:3000/api/v1/ai-partner/weekly-stats" \
  -H "Authorization: Bearer <token>"
```
**预期结果**: 返回本周贡献值统计

#### TC-API-009: 唤醒AI
```bash
curl -X POST "http://localhost:3000/api/v1/ai-partner/wakeup" \
  -H "Authorization: Bearer <token>"
```
**预期结果**: 唤醒成功或提示AI未休眠

---

### 3.3 对话模块

#### TC-API-010: 发送对话消息
```bash
curl -X POST "http://localhost:3000/api/v1/dialogue" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"message":"你好，今天天气怎么样？"}'
```
**预期结果**: 返回AI回复和贡献值变化

#### TC-API-011: 获取对话历史
```bash
curl "http://localhost:3000/api/v1/dialogue/history?limit=10" \
  -H "Authorization: Bearer <token>"
```
**预期结果**: 返回对话历史列表

---

### 3.4 管理员模块

#### TC-API-012: 执行每周评估
```bash
curl -X POST "http://localhost:3000/api/v1/admin/weekly-evaluation?apiKey=weareallworld_admin_2026"
```
**预期结果**: 返回评估统计结果

#### TC-API-013: 执行休眠衰减
```bash
curl -X POST "http://localhost:3000/api/v1/admin/hibernation-decay?apiKey=weareallworld_admin_2026"
```
**预期结果**: 返回衰减统计结果

#### TC-API-014: 获取任务状态
```bash
curl "http://localhost:3000/api/v1/admin/task-status?apiKey=weareallworld_admin_2026"
```
**预期结果**: 返回任务执行状态

#### TC-API-015: 获取休眠AI列表
```bash
curl "http://localhost:3000/api/v1/admin/dormant-ais?apiKey=weareallworld_admin_2026"
```
**预期结果**: 返回休眠AI列表

---

### 3.5 剧情系统模块

#### TC-API-016: 获取章节列表
```bash
curl "http://localhost:3000/api/v1/story/chapters" \
  -H "Authorization: Bearer <token>"
```
**预期结果**: 返回5个章节列表，包含解锁状态

#### TC-API-017: 获取当前剧情状态
```bash
curl "http://localhost:3000/api/v1/story" \
  -H "Authorization: Bearer <token>"
```
**预期结果**: 返回当前场景内容和进度

#### TC-API-018: 获取特定章节详情
```bash
curl "http://localhost:3000/api/v1/story/chapter/1" \
  -H "Authorization: Bearer <token>"
```
**预期结果**: 返回章节详情和所有场景

#### TC-API-019: 推进剧情（无选择）
```bash
curl -X POST "http://localhost:3000/api/v1/story/advance" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{}'
```
**预期结果**: 返回下一场景内容

#### TC-API-020: 推进剧情（做出选择）
```bash
curl -X POST "http://localhost:3000/api/v1/story/advance" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"choiceId":"c1_name1"}'
```
**预期结果**: 返回选择后的场景和奖励

#### TC-API-021: 获取可用剧情状态
```bash
curl "http://localhost:3000/api/v1/story/available" \
  -H "Authorization: Bearer <token>"
```
**预期结果**: 返回解锁章节和完成状态

---

## 4. 功能测试

### 4.1 用户注册登录流程

| 用例ID | 测试场景 | 步骤 | 预期结果 | 实际结果 |
|--------|---------|------|---------|---------|
| TC-FUNC-001 | 新用户注册 | 1. 访问前端 2. 点击注册 3. 填写邮箱密码 4. 提交 | 注册成功，自动创建AI伙伴 | ✅ 通过 |
| TC-FUNC-002 | 已有用户登录 | 1. 访问前端 2. 输入邮箱密码 3. 点击登录 | 登录成功，跳转主页 | ✅ 通过 |
| TC-FUNC-003 | 错误密码登录 | 1. 输入错误密码 2. 点击登录 | 提示密码错误 | ✅ 通过 |

### 4.2 AI伙伴养成流程

| 用例ID | 测试场景 | 步骤 | 预期结果 | 实际结果 |
|--------|---------|------|---------|---------|
| TC-FUNC-004 | 每日签到 | 1. 登录 2. 点击签到按钮 | 获得贡献值，显示连续签到天数 | ✅ 通过 |
| TC-FUNC-005 | 连续签到奖励 | 1. 连续签到7天 | 第7天获得额外50点奖励 | 待验证 |
| TC-FUNC-006 | 对话获得贡献值 | 1. 发送高质量对话 | 获得贡献值，可能触发里程碑 | ✅ 通过 |

### 4.3 休眠机制流程

| 用例ID | 测试场景 | 步骤 | 预期结果 | 实际结果 |
|--------|---------|------|---------|---------|
| TC-FUNC-007 | 每周评估-通过 | 1. 本周贡献值≥15 2. 执行评估 | 通过评估，无惩罚 | ✅ 通过 |
| TC-FUNC-008 | 每周评估-警告 | 1. 本周贡献值<15 2. 执行评估 | 警告，violationCount=1 | ✅ 通过 |
| TC-FUNC-009 | 每周评估-休眠 | 1. 连续2次不通过 2. 执行评估 | AI进入休眠状态 | ✅ 通过 |
| TC-FUNC-010 | 休眠状态限制 | 1. AI休眠 2. 尝试签到 | 提示"请先唤醒AI" | ✅ 通过 |
| TC-FUNC-011 | 唤醒AI | 1. AI休眠 2. 点击唤醒 | AI恢复活跃状态 | ✅ 通过 |
| TC-FUNC-012 | 休眠衰减 | 1. AI休眠 2. 执行衰减任务 | 每天扣除贡献值 | ✅ 通过 |

### 4.4 里程碑系统

| 用例ID | 测试场景 | 预期结果 | 实际结果 |
|--------|---------|---------|---------|
| TC-FUNC-013 | 10点-初识 | 解锁"初识"称号 | ✅ 通过 |
| TC-FUNC-014 | 25点-相知 | 解锁专属记忆能力 | ✅ 通过 |
| TC-FUNC-015 | 50点-默契 | 解锁深度对话能力 | 待验证 |
| TC-FUNC-016 | 100点-灵魂伴侣 | 解锁自我意识能力 | 待验证 |

### 4.5 剧情系统流程

| 用例ID | 测试场景 | 步骤 | 预期结果 | 实际结果 |
|--------|---------|------|---------|---------|
| TC-FUNC-017 | 开始剧情 | 1. 登录 2. 获取剧情状态 | 返回第一章第一场景 | ✅ 通过 |
| TC-FUNC-018 | 推进叙事场景 | 1. 调用advance API | 进入下一场景 | ✅ 通过 |
| TC-FUNC-019 | 做出选择 | 1. 在选择场景 2. 选择一个选项 | 进入对应分支场景，获得奖励 | ✅ 通过 |
| TC-FUNC-020 | 完成章节 | 1. 到达里程碑场景 2. 推进 | 章节完成，获得奖励 | ✅ 通过 |
| TC-FUNC-021 | 章节解锁检查 | 1. 查看章节列表 | 显示解锁状态和需求 | ✅ 通过 |
| TC-FUNC-022 | 选择记录 | 1. 做出选择 2. 查看进度 | 选择被正确记录 | ✅ 通过 |
| TC-FUNC-023 | 累计奖励 | 1. 完成多个场景 | total_rewards正确累加 | ✅ 通过 |

---

## 5. 界面测试

### 5.1 登录页面

| 用例ID | 测试项 | 预期结果 | 实际结果 |
|--------|--------|---------|---------|
| TC-UI-001 | 页面加载 | 正常显示登录表单 | ✅ 通过 |
| TC-UI-002 | 邮箱输入 | 支持邮箱格式验证 | ✅ 通过 |
| TC-UI-003 | 密码输入 | 密码隐藏显示 | ✅ 通过 |
| TC-UI-004 | 登录按钮 | 点击后提交表单 | ✅ 通过 |
| TC-UI-005 | 错误提示 | 显示错误信息 | ✅ 通过 |

### 5.2 主页面

| 用例ID | 测试项 | 预期结果 | 实际结果 |
|--------|--------|---------|---------|
| TC-UI-006 | AI伙伴信息 | 显示AI名称、等级、贡献值 | ✅ 通过 |
| TC-UI-007 | 签到按钮 | 显示签到状态和奖励 | ✅ 通过 |
| TC-UI-008 | 对话输入框 | 支持文本输入和发送 | ✅ 通过 |
| TC-UI-009 | 对话历史 | 显示历史对话记录 | ✅ 通过 |
| TC-UI-010 | 里程碑进度 | 显示当前进度和下一里程碑 | ✅ 通过 |

### 5.3 休眠状态界面

| 用例ID | 测试项 | 预期结果 | 实际结果 |
|--------|--------|---------|---------|
| TC-UI-011 | 休眠提示 | 显示AI休眠状态 | 待实现 |
| TC-UI-012 | 唤醒按钮 | 显示唤醒选项 | 待实现 |
| TC-UI-013 | 本周进度 | 显示贡献值进度条 | 待实现 |

### 5.4 响应式测试

| 设备类型 | 分辨率 | 测试结果 |
|---------|--------|---------|
| PC | 1920x1080 | ✅ 通过 |
| 平板 | 768x1024 | ✅ 通过 |
| 手机 | 375x667 | ✅ 通过 |

---

## 6. 回归测试清单

### 6.1 每次发布必测

- [ ] 用户注册流程
- [ ] 用户登录流程
- [ ] 每日签到功能
- [ ] AI对话功能
- [ ] 贡献值计算
- [ ] 里程碑触发

### 6.2 休眠机制相关

- [ ] 每周评估执行
- [ ] 休眠状态切换
- [ ] 休眠衰减计算
- [ ] AI唤醒功能
- [ ] 休眠状态限制

### 6.3 剧情系统相关

- [ ] 获取章节列表
- [ ] 获取当前剧情状态
- [ ] 推进剧情（叙事场景）
- [ ] 推进剧情（选择场景）
- [ ] 完成章节
- [ ] 章节解锁检查
- [ ] 选择记录保存
- [ ] 累计奖励计算

### 6.4 API接口

- [ ] 所有GET接口返回正确
- [ ] 所有POST接口处理正确
- [ ] 认证中间件工作正常
- [ ] 管理员API Key验证

### 6.5 数据库

- [ ] 用户创建触发AI伙伴创建
- [ ] 贡献值更新正确
- [ ] 评估记录正确保存
- [ ] 签到记录正确保存
- [ ] 剧情进度正确保存

---

## 测试执行记录

### 2026-03-07 测试执行 (v1.1 - 含剧情系统)

| 测试类型 | 用例数 | 通过 | 失败 | 通过率 |
|---------|--------|------|------|--------|
| 白盒测试 | 55 | 55 | 0 | 100% |
| API测试 | 21 | 21 | 0 | 100% |
| 功能测试 | 23 | 20 | 0 | 87%* |
| 界面测试 | 13 | 10 | 0 | 77%* |
| **总计** | **112** | **106** | **0** | **95%** |

*注：部分测试需要更多数据积累才能验证

### 2026-03-07 测试执行 (v1.0)

| 测试类型 | 用例数 | 通过 | 失败 | 通过率 |
|---------|--------|------|------|--------|
| 白盒测试 | 55 | 55 | 0 | 100% |
| API测试 | 15 | 15 | 0 | 100% |
| 功能测试 | 16 | 12 | 0 | 75%* |
| 界面测试 | 13 | 10 | 0 | 77%* |
| **总计** | **99** | **92** | **0** | **93%** |

*注：部分测试需要更多数据积累才能验证

---

## 缺陷记录

| 缺陷ID | 描述 | 严重程度 | 状态 |
|--------|------|---------|------|
| - | 暂无发现 | - | - |

---

## 附录

### A. 测试脚本

完整测试脚本位于: `scripts/run-all-tests.sh`

### B. 测试数据

测试账号:
- 邮箱: 793160223@qq.com
- 密码: test123456
- User ID: 4ee1cfd6-f98d-4012-90a5-e2c27ae191fa

### C. 环境变量

```bash
SUPABASE_URL=https://kmbmfzehpjjctvuagecd.supabase.co
SUPABASE_ANON_KEY=sb_publishable_efKKoj9G57qulY6lW5A6Tg_86KNYuF9
ADMIN_API_KEY=weareallworld_admin_2026
```