# New API 网关集成设计文档

## 概述

本文档描述如何将 New API 网关集成到天下一家系统，实现：
1. Token 包计费控制
2. 用户无感知的自动 API Key 关联
3. SSO 单点登录到充值页面

## 架构设计

```
┌──────────────────────────────────────────────────────────────┐
│                      用户视角（无感知）                        │
│                                                              │
│  天下一家登录 → 对话 → Token不足 → 充值 → 继续对话            │
│                    ↓                           ↑             │
│              后端自动调用                    自动返回         │
│              New API Token                   充值页面         │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│                      系统架构                                 │
│                                                              │
│  ┌─────────────┐         ┌─────────────┐                    │
│  │  天下一家    │  创建用户 │   New API   │                    │
│  │   后端      │ ────────► │   (网关)    │                    │
│  │             │  获取Token│             │                    │
│  │  存储:      │ ◄──────── │  生成:      │                    │
│  │  new_api_   │  返回    │  api_key    │                    │
│  │  token      │          │             │                    │
│  └─────────────┘          └─────────────┘                    │
│        │                        │                            │
│        │ 调用LLM                │                            │
│        └───────────────────────►│                            │
└──────────────────────────────────────────────────────────────┘
```

## 技术选型

### New API 网关
- **项目地址**: https://github.com/QuantumNous/new-api
- **协议**: AGPL-3.0
- **功能**:
  - 在线充值（EPay、Stripe）
  - 按量付费模型定价
  - 缓存计费支持
  - Custom OAuth 支持 SSO

### SSO 方案：共享 Supabase Auth
- 天下一家和 New API 共用 Supabase Auth
- 用户在天下一家登录后，跳转 New API 自动登录
- 无需额外实现 OIDC Provider

## 数据库设计

### 天下一家 users 表扩展

```sql
-- 添加 New API 关联字段
ALTER TABLE users ADD COLUMN new_api_user_id INTEGER;
ALTER TABLE users ADD COLUMN new_api_token VARCHAR(64);
ALTER TABLE users ADD COLUMN new_api_quota BIGINT DEFAULT 0;
ALTER TABLE users ADD COLUMN new_api_created_at TIMESTAMP WITH TIME ZONE;
```

### 字段说明

| 字段 | 类型 | 说明 |
|------|------|------|
| new_api_user_id | INTEGER | New API 中的用户 ID |
| new_api_token | VARCHAR(64) | New API 生成的 API Token |
| new_api_quota | BIGINT | 用户当前额度（缓存，定期同步） |
| new_api_created_at | TIMESTAMP | New API 账户创建时间 |

## API 接口设计

### 1. 用户同步到 New API

**触发时机**: 用户首次登录时

```typescript
// POST /api/v1/new-api/sync-user
// 内部调用，不暴露给前端

interface SyncUserRequest {
  userId: string;
  email: string;
}

interface SyncUserResponse {
  success: boolean;
  newApiUserId: number;
  newApiToken: string;
}
```

### 2. 检查用户额度

```typescript
// GET /api/v1/new-api/quota

interface QuotaResponse {
  success: boolean;
  quota: number;        // 剩余额度
  usedQuota: number;    // 已使用额度
  totalQuota: number;   // 总额度
}
```

### 3. 获取充值链接

```typescript
// GET /api/v1/new-api/recharge-url

interface RechargeUrlResponse {
  success: boolean;
  rechargeUrl: string;  // 带SSO的充值链接
}
```

### 4. 对话接口改造

```typescript
// POST /api/v1/dialogue

interface DialogueRequest {
  message: string;
  aiPartnerId: string;
}

interface DialogueResponse {
  success: boolean;
  reply?: string;
  error?: {
    code: 'QUOTA_EXCEEDED' | 'API_ERROR' | 'OTHER';
    message: string;
    rechargeUrl?: string;  // 额度不足时返回
  };
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}
```

## 核心流程

### 流程 1: 用户登录时自动同步

```
用户登录天下一家
    │
    ▼
检查是否已有 new_api_token
    │
    ├── 有 → 跳过
    │
    └── 无 → 调用 New API 创建用户
              │
              ▼
         生成 API Token
              │
              ▼
         存储到 users 表
```

### 流程 2: 对话时调用 LLM

```
用户发送消息
    │
    ▼
获取用户的 new_api_token
    │
    ▼
检查额度是否足够
    │
    ├── 不足 → 返回充值链接
    │
    └── 足够 → 调用 New API
              │
              ▼
         返回 AI 回复
              │
              ▼
         更新本地额度缓存
```

### 流程 3: 充值跳转

```
用户点击充值
    │
    ▼
生成 SSO Token（基于 Supabase JWT）
    │
    ▼
跳转到 New API 充值页
    │
    ▼
New API 验证 SSO Token
    │
    ▼
自动登录并显示充值页
    │
    ▼
用户完成充值
    │
    ▼
返回天下一家继续对话
```

## New API 配置

### 1. 部署 New API

```bash
# Docker 部署
docker run --name new-api -d --restart always \
  -p 3001:3000 \
  -e TZ=Asia/Shanghai \
  -e SQL_DSN="postgresql://..." \
  -e SESSION_SECRET="your-secret" \
  -v ./data:/data \
  calciumion/new-api:latest
```

### 2. 配置 Custom OAuth（SSO）

在 New API 管理后台配置：

| 配置项 | 值 |
|--------|-----|
| Name | 天下一家 |
| Slug | weareallworld |
| Client ID | Supabase 匿名 Key |
| Client Secret | (可选) |
| Authorization Endpoint | https://xxx.supabase.co/auth/v1/authorize |
| Token Endpoint | https://xxx.supabase.co/auth/v1/token?grant_type=authorization_code |
| User Info Endpoint | https://xxx.supabase.co/auth/v1/user |
| Scopes | openid profile email |
| User ID Field | id |
| Email Field | email |

### 3. 创建管理员 Token

用于天下一家后端调用 New API 管理 API：

```bash
# 在 New API 管理后台创建
# 类型：系统访问令牌
# 权限：用户管理、Token管理
```

## 环境变量配置

```env
# New API 配置
NEW_API_BASE_URL=https://new-api.example.com
NEW_API_ADMIN_TOKEN=sk-xxx

# 初始额度配置
NEW_API_INITIAL_QUOTA=100000

# SSO 配置
NEW_API_SSO_SECRET=your-sso-secret
```

## 安全考虑

1. **Token 安全**
   - new_api_token 存储在数据库，不暴露给前端
   - 所有 LLM 调用通过后端代理

2. **SSO 安全**
   - SSO Token 使用短期有效的 JWT
   - 包含用户 ID 和过期时间签名

3. **管理 API 安全**
   - NEW_API_ADMIN_TOKEN 仅后端使用
   - 不暴露给前端

## 监控与告警

1. **额度监控**
   - 定期同步用户额度到本地缓存
   - 额度低于阈值时提醒用户

2. **API 调用监控**
   - 记录每次 LLM 调用的 token 消耗
   - 异常调用告警

## 后续优化

1. **V1.0**: 跳转网关充值 + SSO
2. **V1.5**: 系统内充值（对接 New API API）
3. **V2.0**: 自建计费系统（如需要）

## 相关文件

- `src/services/new-api.service.ts` - New API 服务封装
- `src/api/routes/new-api.routes.ts` - API 路由
- `src/middleware/quota-check.middleware.ts` - 额度检查中间件
- `frontend/src/components/RechargeModal.tsx` - 充值提示组件