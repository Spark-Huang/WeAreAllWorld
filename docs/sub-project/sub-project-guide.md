# 子项目须知 - OpenClaw 实例管理

**文档类型**：架构说明文档
**版本**：v9.0
**日期**：2026年3月8日
**更新说明**：
1. 使用 openclaw-helm 官方 Chart，不再自行开发 K8s 模板
2. 使用管理后台统一管理，不再单独开发子项目
3. 简化文档，只保留必要的配置说明

---

## 1. 当前架构

### 1.1 三个系统连接

```
┌─────────────────────────────────────────────────────────────────┐
│                        管理后台 (admin-panel)                    │
│                     http://localhost:3002                       │
├─────────────────────────────────────────────────────────────────┤
│  • 用户管理（复用大同世界 Supabase）                               │
│  • Token 管理（调用 New API）                                     │
│  • OpenClaw 实例管理（调用 Helm）                                 │
└─────────────────────────────────────────────────────────────────┘
         │                           │                           │
         ▼                           ▼                           ▼
┌─────────────────┐         ┌─────────────────┐         ┌─────────────────┐
│   大同世界       │         │    New API      │         │  openclaw-helm  │
│   (Supabase)    │         │   (Docker)      │         │    (K8S)        │
│                 │         │                 │         │                 │
│  • 用户认证      │         │  • Token 计费    │         │  • OpenClaw 实例 │
│  • 游戏逻辑      │         │  • 额度管理      │         │  • 容器隔离      │
│  • 剧情系统      │         │  • 充值页面      │         │  • 域名绑定      │
└─────────────────┘         └─────────────────┘         └─────────────────┘
```

### 1.2 已完成的工作

| 功能 | 实现方式 | 状态 |
|------|---------|------|
| OpenClaw Docker 镜像 | 使用官方镜像 `ghcr.io/openclaw/openclaw:2026.3.7` | ✅ |
| K8s 部署模板 | 使用 openclaw-helm 官方 Chart | ✅ |
| Pod 生命周期管理 | 管理后台 `openclawService` | ✅ |
| Token 计费 | New API 网关 | ✅ |
| 用户管理 | 大同世界 Supabase | ✅ |

### 1.3 待完成的工作

| 功能 | 说明 | 优先级 |
|------|------|--------|
| K8S 集群部署 | 安装 kubeadm/kubectl/helm | 高 |
| OpenClaw Skills 开发 | emotion-express, story-progress | 中 |
| 用户上下文传递 | 贡献值、成长阶段传给 OpenClaw | 中 |

---

## 2. openclaw-helm 配置

### 2.1 基本信息

| 项目 | 值 |
|------|-----|
| Chart 版本 | 1.4.5 |
| OpenClaw 版本 | 2026.3.7 |
| 许可证 | MIT |
| K8S 要求 | >= 1.26.0 |
| Helm 仓库 | `https://serhanekicii.github.io/openclaw-helm` |

### 2.2 安装命令

```bash
# 添加 Helm 仓库
helm repo add openclaw https://serhanekicii.github.io/openclaw-helm
helm repo update

# 安装 OpenClaw 实例
helm install openclaw-user-{USER_ID} openclaw/openclaw \
  --namespace we-are-all-world --create-namespace \
  --set app-template.ingress.main.enabled=true \
  --set app-template.ingress.main.hosts[0].host={SUBDOMAIN}.yourdomain.com \
  --set app-template.persistence.data.size=5Gi
```

### 2.3 套餐配置

| 套餐 | CPU | 内存 | 存储 |
|------|-----|------|------|
| basic | 500m | 1Gi | 5Gi |
| pro | 1000m | 2Gi | 10Gi |
| enterprise | 2000m | 4Gi | 20Gi |

---

## 3. 管理后台 API

### 3.1 OpenClaw 实例管理

```bash
# 创建实例
POST /api/instances
{
  "userId": "user-uuid",
  "subdomain": "customer",
  "plan": "basic"
}

# 查询实例状态
GET /api/instances/{instanceId}

# 删除实例
DELETE /api/instances/{instanceId}
```

### 3.2 用户上下文传递

当用户与 OpenClaw 对话时，管理后台会传递以下上下文：

```typescript
interface UserContext {
  userId: string;
  memoryPoints: number;           // 贡献值
  personalityType: string;        // AI性格类型
  growthStage: string;            // 成长阶段
  recentMemories: Memory[];       // 近期记忆
  preferences: UserPreferences;   // 用户偏好
}
```

---

## 4. 成本估算

### 4.1 资源成本（100 DAU）

| 项目 | 配置 | 成本/月 |
|------|------|---------|
| 管理后台 | 0.5 CPU, 512MB | ~50元 |
| 用户实例 | 100 × 1 CPU × 2GB (Spot) | ~150元 |
| 存储 | 100 × 5GB | ~50元 |
| LLM API | 100 DAU × 10对话 | ~150元 |
| **总计** | | **~400元/月** |

### 4.2 成本优化策略

1. **竞价实例**：使用 Spot 实例降低 60-80% 成本
2. **按秒计费**：用户不活跃时暂停实例
3. **资源超卖**：Requests < Limits

---

## 5. 相关文档

- [new-api-integration.md](../new-api-integration.md) - New API 网关集成
- [admin-panel/README.md](../../../admin-panel/README.md) - 管理后台文档
- [openclaw-helm](https://github.com/serhanekicii/openclaw-helm) - Helm Chart 仓库

---

*文档更新时间：2026年3月8日*
*版本：v9.0*
*更新说明：使用 openclaw-helm 和管理后台，简化架构*