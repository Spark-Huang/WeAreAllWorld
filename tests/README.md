# 天下一家 - 回归测试套件

## 目录结构

```
tests/
├── regression/           # 回归测试
│   ├── unit/            # 单元测试
│   │   └── unit-test.ts
│   ├── e2e/             # 端到端测试
│   │   └── e2e-test.ts
│   ├── integration/     # 集成测试
│   ├── security/        # 安全测试
│   │   └── security-test.ts
│   └── performance/     # 性能测试
├── fixtures/            # 测试数据
├── reports/             # 测试报告
└── run-all-tests.ts     # 完整测试套件
```

## 运行测试

### 运行所有测试
```bash
pnpm test:all
```

### 单独运行
```bash
# 单元测试
pnpm test:unit

# 端到端测试
pnpm test:e2e

# 安全测试
pnpm test:security
```

## 测试覆盖

### 单元测试 (55 项)
- 用户服务
- AI 伙伴服务
- 贡献值计算
- 质量判定
- 剧情系统
- OpenClaw 实例管理

### 端到端测试 (26 项)
- 用户注册流程
- AI 伙伴交互
- 对话功能
- 签到系统
- Token 额度
- 剧情进度
- 里程碑系统

### 安全测试 (53 项)
- SQL 注入防护
- 权限隔离
- 数据完整性
- 输入验证
- 边界条件

## 测试报告

测试报告保存在 `tests/reports/` 目录，JSON 格式。
