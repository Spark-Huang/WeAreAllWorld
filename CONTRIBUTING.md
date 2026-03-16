# 贡献指南

感谢你对大同世界项目的关注！我们欢迎所有形式的贡献。

## 🤝 如何贡献

### 报告 Bug

1. 在 [Issues](https://github.com/Spark-Huang/WeAreAllWorld/issues) 中搜索是否已有相同问题
2. 如果没有，创建新 Issue，包含：
   - 清晰的标题
   - 问题描述
   - 复现步骤
   - 期望行为
   - 截图（如有）
   - 环境信息

### 提出新功能

1. 创建 Issue，标签选择 `enhancement`
2. 描述功能需求和使用场景
3. 等待维护者讨论和批准

### 提交代码

1. Fork 本仓库
2. 创建分支：`git checkout -b feature/your-feature`
3. 提交更改：`git commit -m 'Add some feature'`
4. 推送分支：`git push origin feature/your-feature`
5. 创建 Pull Request

## 📝 代码规范

### TypeScript

- 使用 ESLint 配置
- 所有函数必须有类型注解
- 公共 API 必须有 JSDoc 注释

### 提交信息

使用约定式提交：

```
feat: 添加新功能
fix: 修复 bug
docs: 文档更新
style: 代码格式调整
refactor: 代码重构
test: 测试相关
chore: 构建/工具相关
```

### 分支命名

- `feature/*` - 新功能
- `fix/*` - Bug 修复
- `docs/*` - 文档更新
- `refactor/*` - 代码重构

## ✅ PR 检查清单

- [ ] 代码通过所有测试
- [ ] 代码符合 ESLint 规范
- [ ] 新功能有对应测试
- [ ] 文档已更新
- [ ] 提交信息符合规范

## 🔧 开发环境

```bash
# 安装依赖
pnpm install

# 运行开发服务器
pnpm dev:all

# 运行测试
pnpm test:all

# 代码检查
pnpm lint
```

## 📞 联系方式

- GitHub Issues: 用于 Bug 报告和功能请求
- Discussions: 用于一般讨论

感谢你的贡献！🙏