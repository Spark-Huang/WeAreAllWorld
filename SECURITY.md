# 安全政策

## 支持的版本

| 版本 | 支持状态 |
|------|---------|
| 1.0.x | ✅ 支持 |
| < 1.0 | ❌ 不支持 |

## 报告安全漏洞

如果你发现安全漏洞，请**不要**通过公开 Issue 报告。

请通过以下方式私密报告：

1. 使用 GitHub 的 [Security Advisories](https://github.com/Spark-Huang/WeAreAllWorld/security/advisories) 功能
2. 或发送邮件至项目维护者

### 报告内容

请包含以下信息：

- 漏洞类型（如 XSS、SQL 注入等）
- 受影响的版本
- 复现步骤
- 可能的影响
- 修复建议（如有）

### 响应时间

- 确认收到：24 小时内
- 初步评估：3 天内
- 修复发布：根据严重程度，1-14 天

## 安全最佳实践

### 部署

- ✅ 使用 HTTPS
- ✅ 配置 CORS 白名单
- ✅ 启用 Rate Limiting
- ✅ 定期更新依赖
- ✅ 使用环境变量存储敏感信息

### Supabase

- ✅ 启用 Row Level Security (RLS)
- ✅ 使用 Service Key 仅在服务端
- ✅ 定期审计数据库权限

### API

- ✅ 验证所有输入
- ✅ 使用参数化查询
- ✅ 实现请求限流
- ✅ 记录安全相关日志

## 已知安全问题

详见 `docs/SECURITY_ISSUES.md`

---

感谢你帮助保护大同世界项目的安全！🙏