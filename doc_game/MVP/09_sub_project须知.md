# sub_project 须知 - 云版OpenClaw开发指南

**文档类型**：MVP开发实现文档（分册九）
**版本**：v7.0
**日期**：2026年2月24日
**更新说明**：明确子项目定位为云版OpenClaw，主项目是基于OpenClaw构建的游戏

---

## 目录

1. [核心概念与架构](#1-核心概念与架构)
2. [OpenClaw基础特性](#2-openclaw基础特性)
3. [部署与资源配置](#3-部署与资源配置)
4. [数据库设计](#4-数据库设计)
5. [API与通信接口](#5-api与通信接口)
6. [安全与隔离要求](#6-安全与隔离要求)
7. [成本优化策略](#7-成本优化策略)
8. [开发任务清单](#8-开发任务清单)

---

## 1. 核心概念与架构

### 1.1 项目定位

**子项目是云版OpenClaw**，主项目是基于OpenClaw构建的游戏。

| 项目 | 定位 | 职责 | 技术栈 |
|-----|------|------|--------|
| **子项目** | 云版OpenClaw | 提供OpenClaw的云部署能力，包括每用户独立Pod、PVC持久化、竞价实例、网络隔离等基础设施 | Kubernetes YAML、Docker、华为云CCI |
| **主项目** | 基于OpenClaw的游戏 | 在OpenClaw基础上构建游戏逻辑，包括记忆点数系统、剧情引擎、养成机制、中央系统评估等 | Node.js/TypeScript、OpenClaw Skills |

### 1.2 子项目核心职责

子项目作为**云版OpenClaw**，负责：

1. **OpenClaw云化部署**
   - 将OpenClaw打包为容器镜像
   - 提供Kubernetes部署模板（Deployment、Service、PVC等）
   - 实现每用户独立OpenClaw实例

2. **基础设施管理**
   - 华为云CCI Serverless Kubernetes配置
   - 竞价实例（Spot）管理
   - PVC持久化存储管理
   - NetworkPolicy网络隔离

3. **OpenClaw核心能力提供**
   - LLM集成（OpenAI/Claude等）
   - 记忆管理（短期/长期记忆）
   - 技能系统（Skills框架）
   - 工具调用（浏览器、文件操作等）

### 1.3 核心原则

- **每用户独立沙箱**：每个用户拥有独立的OpenClaw Pod，数据隔离
- **强隔离**：每个用户必须拥有独立的容器，严禁多用户共享同一个OpenClaw进程
- **Serverless架构**：使用华为云CCI，无需管理节点，按秒计费
- **竞价实例**：使用Spot实例降低成本
- **持久化存储**：使用PVC保存用户数据，Pod重启/迁移后数据不丢失

### 1.4 架构模式

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              主项目（游戏）                                  │
│                                                                             │
│  游戏业务逻辑：                                                              │
│  • 记忆点数系统（质量判定、里程碑奖励）                                      │
│  • 剧情引擎（人工骨架+AI细节、分支管理）                                     │
│  • 养成机制（能力解锁、专属记忆）                                            │
│  • 中央系统评估（活跃度检查、休眠机制）                                      │
│  • 社交分享（X.com分享）                                                    │
│                                                                             │
│  OpenClaw Skills（游戏技能）：                                               │
│  • 情感表达技能                                                              │
│  • 剧情推进技能                                                              │
│  • 记忆管理技能                                                              │
│  • 实用能力技能（复用OpenClaw内置能力）                                      │
└────────────────────────────────────────┬────────────────────────────────────┘
                                         │
                                         ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           子项目（云版OpenClaw）                             │
│                                                                             │
│  OpenClaw核心能力：                                                          │
│  • LLM集成（OpenAI/Claude等）                                               │
│  • 记忆管理（短期/长期记忆）                                                 │
│  • 技能系统（Skills框架）                                                    │
│  • 工具调用（浏览器、文件操作等）                                            │
│                                                                             │
│  云基础设施：                                                                │
│  • 每用户独立Pod（Deployment模板）                                           │
│  • PVC持久化存储（用户数据不丢失）                                           │
│  • 竞价实例（Spot，降低成本60-80%）                                          │
│  • NetworkPolicy（网络隔离）                                                 │
│  • Serverless按秒计费                                                        │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 1.5 与主项目的关系

| 维度 | 主项目（游戏） | 子项目（云版OpenClaw） |
|-----|----------------|----------------------|
| **定位** | 基于OpenClaw构建的游戏 | 云版OpenClaw基础设施 |
| **职责** | 游戏业务逻辑、Skills开发 | OpenClaw云部署、基础设施管理 |
| **数据存储** | Supabase（用户信息、记忆点数、剧情进度） | PVC（OpenClaw工作目录、用户记忆） |
| **数据库表** | users, ai_partners, story_progress, memory_points | 无独立表，使用主项目数据 |
| **通信方式** | 通过K8s Service调用用户OpenClaw Pod | 提供HTTP API供主项目调用 |
| **配置管理** | 游戏配置、剧情骨架、Prompt模板 | OpenClaw配置、Skills配置 |
| **代码仓库** | we-are-all-world（主仓库） | sub_project目录或独立仓库 |
| **部署产物** | Docker镜像（管理沙箱） | Kubernetes YAML模板 |
| **版本管理** | 独立版本号 | 跟随OpenClaw版本 |

---

## 2. OpenClaw基础特性

### 2.1 OpenClaw是什么

OpenClaw是一个开源的、可自托管的AI助手/智能体平台，不仅仅是聊天机器人，而是能真正帮用户"干活"的AI：

- **控制浏览器**：访问网页、点击元素、填表单、爬取数据
- **操作文件**：读写本地文件、执行Shell命令
- **管理任务**：收发邮件、管理日程、定时任务
- **扩展能力**：通过Skills（插件）扩展功能

### 2.2 核心组件

| 组件 | 说明 | 在游戏中的应用 |
|-----|------|---------------|
| **大脑** | 对接各种大模型（GPT、Claude、通义千问等）做理解和推理 | AI伙伴对话生成 |
| **手和脚** | 通过Skills和本地工具操作外部系统 | 实用能力（文档处理、代码辅助等） |
| **记事本/大脑外存** | 将用户偏好、历史对话、重要信息存储在本地文件中 | 专属记忆、个性化知识库 |
| **调度中心/网关** | 作为控制平面，路由来自不同聊天平台的消息 | Telegram消息路由 |

### 2.3 部署形态

| 部署形态 | 说明 | 适用场景 |
|---------|------|---------|
| **个人部署** | 在个人电脑/云服务器上用Docker或直接安装 | 个人使用、开发测试 |
| **Kubernetes部署** | 打包成容器，通过Deployment/Service管理生命周期 | 企业级部署 |
| **本项目部署（云版）** | 在华为云CCI上实现多租户SaaS，每个用户独立的OpenClaw实例 | 游戏MVP |

### 2.4 关键配置

| 配置项 | 值 | 说明 |
|-------|-----|------|
| **工作目录** | `/home/node/.openclaw/workspace` | 会话数据存储位置 |
| **配置文件** | `/app/config/openclaw-config.yml` | OpenClaw主配置文件 |
| **Gateway端口** | 18789 | 仅集群内访问，严禁暴露公网 |
| **生命周期** | 持续运行 | 用户不活跃时仍保持运行（保证响应速度） |

---

## 3. 部署与资源配置

### 3.1 基础设施要求

| 资源 | 选型 | 说明 |
|-----|------|------|
| **云服务** | 华为云CCI（云容器实例） | Serverless Kubernetes |
| **计费方式** | 按秒计费，支持竞价实例（Spot） | 成本优化 |
| **存储** | 华为云EVS（云硬盘） | 支持PVC持久化存储 |
| **特点** | 无需管理节点，自动扩缩容 | 运维简化 |

### 3.2 Kubernetes资源模板

每个用户对应以下K8s资源：

#### Deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: user-openclaw-${USER_ID}
  namespace: we-are-all-world
  labels:
    app: user-openclaw
    user-id: "${USER_ID}"
spec:
  replicas: 1
  selector:
    matchLabels:
      app: user-openclaw
      user-id: "${USER_ID}"
  template:
    metadata:
      labels:
        app: user-openclaw
        user-id: "${USER_ID}"
    spec:
      # CCI Serverless配置
      schedulerName: cci-scheduler
      # 使用竞价实例
      priorityClassName: cci-spot-priority
      containers:
        - name: openclaw
          image: ghcr.io/openclaw/openclaw:latest
          ports:
            - containerPort: 18789
          env:
            - name: OPENCLAW_CONFIG_FILE
              value: /app/config/openclaw-config.yml
            - name: USER_ID
              value: "${USER_ID}"
            - name: OPENAI_API_KEY
              valueFrom:
                secretKeyRef:
                  name: llm-secret
                  key: openai-api-key
          resources:
            limits:
              memory: "2Gi"
              cpu: "1000m"
            requests:
              memory: "1Gi"
              cpu: "500m"
          volumeMounts:
            - mountPath: /home/node/.openclaw/workspace
              name: workspace
            - mountPath: /app/config
              name: config
              readOnly: true
          livenessProbe:
            httpGet:
              path: /health
              port: 18789
            initialDelaySeconds: 30
            periodSeconds: 60
          lifecycle:
            preStop:
              exec:
                command: ["/bin/sh", "-c", "curl -X POST http://localhost:18789/shutdown"]
      volumes:
        - name: workspace
          persistentVolumeClaim:
            claimName: user-pvc-${USER_ID}
        - name: config
          configMap:
            name: openclaw-config
```

#### Service (ClusterIP)

```yaml
apiVersion: v1
kind: Service
metadata:
  name: user-svc-${USER_ID}
  namespace: we-are-all-world
spec:
  selector:
    app: user-openclaw
    user-id: "${USER_ID}"
  ports:
    - port: 18789
      targetPort: 18789
  type: ClusterIP
```

#### PVC (PersistentVolumeClaim)

```yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: user-pvc-${USER_ID}
  namespace: we-are-all-world
spec:
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 5Gi
  storageClassName: csi-disk  # CCI EVS存储类
```

### 3.3 生命周期管理

| 生命周期事件 | 处理方式 | 说明 |
|-------------|---------|------|
| **Pod创建** | 管理沙箱调用CCI API | 首次用户注册时创建 |
| **Pod运行** | 持续运行 | 保证响应速度，无冷启动延迟 |
| **健康检查** | Liveness Probe | 每60秒检查一次 |
| **竞价实例回收** | 自动重新调度 | 从PVC恢复数据 |
| **Pod终止** | PreStop Hook | 优雅关闭，保存状态 |

---

## 4. 数据库设计

### 4.1 子项目不创建独立数据库表

子项目（云版OpenClaw）**不创建独立的数据库表**，所有游戏相关数据由主项目管理。

### 4.2 数据存储位置

| 数据类型 | 存储位置 | 管理方 |
|---------|---------|--------|
| **用户信息** | Supabase (users表) | 主项目 |
| **AI伙伴状态** | Supabase (ai_partners表) | 主项目 |
| **记忆点数** | Supabase (memory_points表) | 主项目 |
| **剧情进度** | Supabase (story_progress表) | 主项目 |
| **OpenClaw工作目录** | PVC (/home/node/.openclaw/workspace) | 子项目 |
| **用户记忆文件** | PVC (workspace/memory/) | 子项目 |
| **会话配置** | PVC (workspace/config/) | 子项目 |

### 4.3 数据同步机制

主项目通过API将用户上下文传递给子项目：

```typescript
interface UserContext {
  userId: string;
  memoryPoints: number;           // 记忆点数
  personalityType: string;        // AI性格类型
  growthStage: string;            // 成长阶段
  recentMemories: Memory[];       // 近期记忆
  preferences: UserPreferences;   // 用户偏好
  currentGoal?: string;           // 当前目标
}
```

---

## 5. API与通信接口

### 5.1 主项目调用子项目接口

主项目通过K8s Service名称调用用户OpenClaw Pod：

```typescript
// 主项目调用用户OpenClaw Pod
const response = await fetch(`http://user-svc-${userId}:18789/api/chat`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    message: userMessage,
    context: userContext,
  }),
});
```

### 5.2 OpenClaw内置API

| API | 方法 | 说明 |
|-----|------|------|
| `/api/chat` | POST | 对话接口 |
| `/api/memory` | GET/POST | 记忆管理 |
| `/api/skills` | GET | 技能列表 |
| `/api/skills/:name/execute` | POST | 执行技能 |
| `/health` | GET | 健康检查 |

### 5.3 工作流

```
用户消息 → Telegram Bot API
        → 管理沙箱 (主项目)
        → 用户认证
        → 路由到用户OpenClaw Pod (user-svc-{USER_ID}:18789)
        → 用户OpenClaw Pod处理：
           ├── 质量判定（调用管理沙箱）
           ├── 记忆图谱更新
           ├── 情感状态更新
           ├── LLM API生成回复
           └── 返回响应
        → 管理沙箱更新数据库（记忆点数、里程碑等）
        → Telegram发送回复
```

---

## 6. 安全与隔离要求

### 6.1 网络隔离

| 安全措施 | 配置 | 说明 |
|---------|------|------|
| **NetworkPolicy** | 默认拒绝所有入站/出站流量 | 最小权限原则 |
| **允许入站** | 仅允许管理沙箱访问18789端口 | 限制访问来源 |
| **允许出站** | 允许访问K8s DNS（53端口） | 服务发现 |
| **允许出站** | 允许访问外部API（443端口） | LLM API、Telegram API |
| **Gateway安全** | 严禁配置LoadBalancer或NodePort | 不暴露公网 |

### 6.2 NetworkPolicy配置

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: user-openclaw-policy
  namespace: we-are-all-world
spec:
  podSelector:
    matchLabels:
      app: user-openclaw
  policyTypes:
    - Ingress
    - Egress
  ingress:
    # 只允许管理沙箱访问
    - from:
        - podSelector:
            matchLabels:
              app: management-sandbox
      ports:
        - port: 18789
  egress:
    # 允许DNS查询
    - to:
        - namespaceSelector: {}
          podSelector:
            matchLabels:
              k8s-app: kube-dns
      ports:
        - port: 53
          protocol: UDP
    # 允许访问外部API
    - to:
        - ipBlock:
            cidr: 0.0.0.0/0
            except:
              - 10.0.0.0/8
              - 172.16.0.0/12
              - 192.168.0.0/16
      ports:
        - port: 443
```

### 6.3 资源配额

| 资源 | Request | Limit | 说明 |
|-----|---------|-------|------|
| **CPU** | 500m | 1000m | 可超卖 |
| **Memory** | 1Gi | 2Gi | 可超卖 |
| **存储** | 5Gi | - | 每用户PVC |

### 6.4 RBAC

为管理沙箱的ServiceAccount创建最小权限的ClusterRole：

```yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: pod-manager
  namespace: we-are-all-world
rules:
  - apiGroups: ["apps"]
    resources: ["deployments"]
    verbs: ["create", "get", "update", "delete", "list"]
  - apiGroups: [""]
    resources: ["pods", "services", "secrets", "persistentvolumeclaims"]
    verbs: ["create", "get", "update", "delete", "list"]
```

---

## 7. 成本优化策略

### 7.1 Serverless计费优势

| 特性 | 传统K8s | CCI Serverless |
|-----|---------|----------------|
| **计费粒度** | 按小时/包年包月 | 按秒计费 |
| **闲置成本** | 节点持续计费 | Pod停止后不计费 |
| **运维成本** | 需要运维节点 | 无需运维节点 |

### 7.2 竞价实例策略

| 策略 | 说明 | 效果 |
|-----|------|------|
| **Spot实例** | 使用CCI竞价实例运行用户Pod | 成本降低60-80% |
| **多可用区** | 跨多个可用区部署 | 降低单区域回收风险 |
| **资源超卖** | Requests < Limits | 提高资源利用率 |
| **自动恢复** | Pod被回收后自动重新调度 | 保证服务可用性 |

### 7.3 成本估算

```
成本估算（100 DAU）：

管理沙箱（CCI Serverless正常实例）：
- 2-10副本 × 0.5CPU × 512MB
- 平均4副本运行
- 按秒计费
- 成本：~80元/月

用户沙箱（CCI Serverless竞价实例）：
- 100用户 × 1CPU × 2GB
- 竞价实例价格：正常价格的30%
- 按秒计费
- 成本：100 × 30% × 50元 = ~150元/月

存储（华为云EVS）：
- 100用户 × 5GB
- 成本：~50元/月

LLM API：
- 100 DAU × 10次对话/天 × 30天
- 成本：~150元/月

Supabase：
- 免费 tier 足够MVP使用
- 成本：~0元/月

总计：~430元/月（100 DAU）
```

---

## 8. 开发任务清单

### Phase 1：基础设施搭建

- [ ] 创建华为云CCI集群，配置kubectl访问
- [ ] 创建Supabase项目，配置Auth（Phone）
- [ ] 创建Telegram Bot，获取Token
- [ ] 配置OpenClaw Docker镜像
- [ ] 创建K8s Namespace和基础资源

### Phase 2：OpenClaw云化部署

- [ ] 编写K8s Resource Manifest模板（Deployment、Service、PVC、ConfigMap）
- [ ] 配置CCI竞价实例和PVC存储
- [ ] 配置NetworkPolicy网络隔离
- [ ] 开发Pod管理功能（创建、监控、回收处理）

### Phase 3：与主项目集成

- [ ] 配置主项目与子项目的通信接口
- [ ] 实现用户上下文传递机制
- [ ] 开发OpenClaw Skills（游戏技能）
- [ ] 集成测试

### Phase 4：测试与验收

- [ ] 验证用户Pod自动创建
- [ ] 测试对话功能
- [ ] 验证竞价实例回收处理（Pod被回收后自动恢复）
- [ ] 验证PVC数据持久化（Pod重启后数据不丢失）
- [ ] 检查NetworkPolicy是否生效（确保网络隔离）
- [ ] 测试成本优化效果

---

## 相关文档

- [01_项目架构概述.md](./开发实现/01_项目架构概述.md) - 系统架构、核心组件、数据流
- [02_数据库设计.md](./开发实现/02_数据库设计.md) - 数据库表结构、视图、函数、触发器
- [03_OpenClaw集成设计.md](./开发实现/03_OpenClaw集成设计.md) - OpenClaw技能设计、数据同步
- [04_LLM集成设计.md](./开发实现/04_LLM集成设计.md) - Prompt模板、质量判定服务
- [06_API与业务逻辑.md](./开发实现/06_API与业务逻辑.md) - API接口、业务逻辑、定时任务

---

*文档生成时间：2026年2月24日*
*版本：v7.0*
*更新说明：*
*1. 明确子项目定位为云版OpenClaw，主项目是基于OpenClaw构建的游戏*
*2. 简化数据库设计，子项目不创建独立数据库表*
*3. 明确主项目与子项目的职责边界*
*4. 更新API通信接口设计*
