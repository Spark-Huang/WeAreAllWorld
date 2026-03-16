# 管理后台

连接 **大同世界**、**New API**、**openclaw-helm** 的统一管理后台。

## 📖 项目背景

### 目的
为大同世界的用户提供 **OpenClaw 实例托管服务**：
1. 用户注册 → 自动创建 New API 账户（Token 计费）
2. 用户付费 → 自动开通 OpenClaw 实例（K8S 容器）
3. 用户管理 → 查询额度、充值、实例状态

### 核心原则
- ✅ **不修改第三方代码**：New API 和 openclaw-helm 只通过 API/配置使用
- ✅ **易于升级**：第三方项目可以直接升级，不影响管理后台
- ✅ **松耦合**：三个系统独立运行，通过 API 连接

## 架构

```
┌─────────────────────────────────────────────────────────────┐
│                    管理后台 (admin-panel)                    │
│                      http://localhost:3002                   │
├─────────────────────────────────────────────────────────────┤
│  用户管理          Token 管理          OpenClaw 实例管理      │
│  (大同世界)        (New API)          (openclaw-helm)        │
└─────────────────────────────────────────────────────────────┘
         │                    │                    │
         ▼                    ▼                    ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│   大同世界       │  │    New API      │  │  openclaw-helm  │
│   (Supabase)    │  │   (Docker)      │  │    (K8S)        │
│                 │  │                 │  │                 │
│  • 用户认证      │  │  • Token 管理   │  │  • 实例创建      │
│  • 用户数据      │  │  • 额度查询     │  │  • 实例管理      │
│                 │  │  • 充值链接     │  │  • 域名绑定      │
└─────────────────┘  └─────────────────┘  └─────────────────┘
```

## API 端点

### 健康检查
```
GET /api/health
```

### 用户管理
```
GET  /api/users           # 用户列表
POST /api/users           # 创建用户（同步到大同世界 + New API）
GET  /api/users/:id       # 用户详情
```

### Token 管理
```
GET  /api/tokens/:userId        # 查询用户额度
POST /api/tokens/recharge       # 生成充值链接
GET  /api/tokens/:userId/usage  # 消费记录
```

### OpenClaw 实例管理
```
POST   /api/instances           # 创建实例
GET    /api/instances/:id       # 查询实例状态
GET    /api/instances/user/:userId  # 用户的所有实例
DELETE /api/instances/:id       # 删除实例
```

## 快速开始

### 1. 安装依赖
```bash
pnpm install
```

### 2. 配置环境变量
```bash
cp .env.example .env
# 编辑 .env 文件，填入实际配置
```

### 3. 启动服务
```bash
pnpm dev
```

## 环境变量说明

| 变量 | 说明 | 示例 |
|------|------|------|
| `PORT` | 服务端口 | `3002` |
| `SUPABASE_URL` | Supabase 项目 URL | `https://xxx.supabase.co` |
| `SUPABASE_ANON_KEY` | Supabase 匿名密钥 | `eyJhbGc...` |
| `SUPABASE_SERVICE_KEY` | Supabase 服务密钥 | `eyJhbGc...` |
| `NEW_API_BASE_URL` | New API 地址 | `http://localhost:3001` |
| `NEW_API_ADMIN_TOKEN` | New API 管理员 Token | `sk-xxx` |
| `OPENCLAW_DOMAIN` | OpenClaw 实例域名 | `yourdomain.com` |

## 使用示例

### 创建用户并开通 OpenClaw 实例

```bash
# 1. 创建用户
curl -X POST http://localhost:3002/api/users \
  -H "Content-Type: application/json" \
  -d '{
    "email": "customer@example.com",
    "password": "Password123!",
    "name": "测试用户"
  }'

# 2. 创建 OpenClaw 实例
curl -X POST http://localhost:3002/api/instances \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user_id_from_step1",
    "subdomain": "customer",
    "plan": "basic"
  }'

# 3. 查询用户额度
curl http://localhost:3002/api/tokens/user_id_from_step1

# 4. 生成充值链接
curl -X POST http://localhost:3002/api/tokens/recharge \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user_id_from_step1",
    "amount": 100
  }'
```

## 套餐配置

| 套餐 | CPU | 内存 | 存储 |
|------|-----|------|------|
| basic | 500m | 1Gi | 5Gi |
| pro | 1000m | 2Gi | 10Gi |
| enterprise | 2000m | 4Gi | 20Gi |

## 数据库表结构

需要在 Supabase 中创建 `openclaw_instances` 表：

```sql
CREATE TABLE openclaw_instances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) NOT NULL,
  instance_id VARCHAR(255) NOT NULL,
  subdomain VARCHAR(255) NOT NULL,
  status VARCHAR(50) DEFAULT 'creating',
  plan VARCHAR(50) DEFAULT 'basic',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  deleted_at TIMESTAMP
);
```

## 注意事项

1. **New API** - 不修改代码，通过 API 操作
2. **openclaw-helm** - 不修改代码，通过 Helm values 配置
3. **K8S 集群** - 需要提前配置好 kubectl 访问权限
4. **域名** - 需要配置通配符 DNS (`*.yourdomain.com`)

## 升级说明

- **New API**: `docker pull calciumion/new-api:latest && docker restart new-api`
- **openclaw-helm**: `helm repo update && helm upgrade <release> openclaw/openclaw`
- **管理后台**: `git pull && pnpm install && pnpm build && pm2 restart admin-panel`

## 与大同世界的关系

```
┌─────────────────────────────────────────────────────────────────┐
│                        大同世界 (WeAreAllWorld)                  │
│                     https://weareallworld.ai                    │
├─────────────────────────────────────────────────────────────────┤
│  • AI 伙伴养成平台                                                │
│  • 剧情系统、贡献值、里程碑                                        │
│  • 用户注册/登录、对话功能                                         │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ 用户付费后
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                        管理后台 (admin-panel)                    │
│                     http://localhost:3002                       │
├─────────────────────────────────────────────────────────────────┤
│  • 用户管理（复用大同世界 Supabase）                               │
│  • Token 管理（调用 New API）                                     │
│  • OpenClaw 实例管理（调用 Helm）                                 │
└─────────────────────────────────────────────────────────────────┘
         │                           │
         ▼                           ▼
┌─────────────────┐         ┌─────────────────┐
│    New API      │         │  openclaw-helm  │
│   (Docker)      │         │    (K8S)        │
│                 │         │                 │
│  • Token 计费    │         │  • OpenClaw 实例 │
│  • 额度管理      │         │  • 容器隔离      │
│  • 充值页面      │         │  • 域名绑定      │
└─────────────────┘         └─────────────────┘
```

## 部署流程

### 1. 准备工作

```bash
# 1.1 安装 K8S 集群（推荐 k3s，轻量级）
curl -sfL https://get.k3s.io | sh -

# 1.2 安装 Helm
curl https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash

# 1.3 安装 kubectl
curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl"
chmod +x kubectl && mv kubectl /usr/local/bin/

# 1.4 配置通配符 DNS
# 在你的 DNS 服务商添加 A 记录：
# *.openclaw.yourdomain.com → 你的服务器 IP
```

### 2. 部署 New API

```bash
# 使用已有的 New API Docker 部署
# 确保 New API 运行在 http://localhost:3001
docker ps | grep new-api
```

### 3. 部署管理后台

```bash
cd /root/.openclaw/workspace/WeAreAllWorld/src_admin/admin-panel

# 安装依赖
pnpm install

# 配置环境变量
cp .env.example .env
# 编辑 .env，填入实际配置

# 创建数据库表
# 在 Supabase SQL Editor 中执行 README 中的 CREATE TABLE 语句

# 启动服务
pnpm dev

# 生产环境使用 PM2
pm2 start "pnpm start" --name admin-panel
```

### 4. 测试

```bash
# 健康检查
curl http://localhost:3002/api/health

# 创建测试用户
curl -X POST http://localhost:3002/api/users \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Test@123","name":"测试用户"}'
```

## 常见问题

### Q: Helm 命令找不到？
```bash
# 安装 Helm
curl https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash
```

### Q: kubectl 连接不上 K8S？
```bash
# 检查 K8S 状态
kubectl cluster-info

# 如果使用 k3s
sudo k3s kubectl get nodes
```

### Q: New API 连接失败？
```bash
# 检查 New API 容器状态
docker ps | grep new-api

# 检查端口
curl http://localhost:3001/api/status
```

### Q: 如何添加新的套餐？
编辑 `src/services/openclaw.service.ts` 中的 `PLANS` 对象：
```typescript
const PLANS = {
  basic: { cpu: '500m', memory: '1Gi', storage: '5Gi' },
  pro: { cpu: '1000m', memory: '2Gi', storage: '10Gi' },
  enterprise: { cpu: '2000m', memory: '4Gi', storage: '20Gi' },
  // 添加新套餐
  ultimate: { cpu: '4000m', memory: '8Gi', storage: '50Gi' }
};
```