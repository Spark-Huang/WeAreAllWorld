# 共生世界（WeAreAll.World） 实用能力助手子AI Agent设计

**文档类型**：子项目技术设计文档
**版本**：v1.0
**日期**：2026年2月23日

---

## 目录

1. [设计概述](#1-设计概述)
2. [架构设计](#2-架构设计)
3. [子AI Agent实现](#3-子ai-agent实现)
4. [与主AI Agent的交互](#4-与主ai-agent的交互)
5. [成本优化策略](#5-成本优化策略)
6. [部署方案](#6-部署方案)

---

## 1. 设计概述

### 1.1 背景
为大幅降低服务器运行成本，将实用能力助手从主AI Agent中分离，作为独立的子AI Agent实现。主AI Agent采用传统的多用户服务架构，而实用能力助手基于OpenClaw实现，仅在用户明确需要实用能力时才被唤起。

### 1.2 核心原则
- **按需启动**：子AI Agent仅在用户请求实用能力时启动
- **成本优化**：避免为每个用户长期运行OpenClaw实例
- **功能完整**：保持实用能力的完整性和个性化体验
- **无缝集成**：用户感知不到主Agent和子Agent的切换

### 1.3 功能范围
子AI Agent专注于以下实用能力：
- 📝 文档处理（总结、分析、提取）
- 💻 代码辅助（调试、优化、解释）
- 📚 学习辅导（概念解释、原理说明）
- 🎯 任务管理（规划、安排、提醒）
- 🌍 语言技能（翻译、润色、写作）
- 💡 创意协作（头脑风暴、故事创作）

---

## 2. 架构设计

### 2.1 整体架构图

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              主AI Agent (传统架构)                          │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                    多用户共享服务 (Node.js/Deno)                      │  │
│  │  • 用户会话管理                                                    │  │
│  │  • 记忆系统                                                        │  │
│  │  • 剧情系统                                                        │  │
│  │  • 新手引导                                                        │  │
│  │  • 基础对话                                                        │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                    │                                         │
│                                    ▼ 检测到实用能力请求                     │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                    实用能力请求路由器                                 │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           实用能力子AI Agent (OpenClaw)                     │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                    按需启动的OpenClaw实例                             │  │
│  │  • 个性化知识库                                                    │  │
│  │  • 交互风格画像                                                    │  │
│  │  • 上下文延续                                                      │  │
│  │  • 实用能力增强                                                    │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                    │                                         │
│                                    ▼ 返回结果                               │
└─────────────────────────────────────────────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              主AI Agent (传统架构)                          │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                    结果整合与返回                                     │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 组件职责

| 组件 | 职责 | 技术栈 | 运行模式 |
|------|------|--------|----------|
| **主AI Agent** | 用户会话管理、记忆系统、剧情系统、基础对话、实用能力检测 | Node.js + Supabase | 常驻服务，多用户共享 |
| **实用能力路由器** | 识别实用能力请求、路由到子AI Agent、管理子AI Agent生命周期 | Node.js | 常驻服务 |
| **子AI Agent** | 提供个性化实用能力服务、应用知识库和上下文 | OpenClaw | 按需启动，单用户专用 |

---

## 3. 子AI Agent实现

### 3.1 OpenClaw配置

```yaml
# sub_project/openclaw-practical-config.yml
practical_abilities:
  enabled: true
  name: "实用能力助手"
  
  # 实用能力类型
  types:
    - information_retrieval  # 信息查询
    - document_processing    # 文档处理
    - code_assistance        # 代码辅助
    - creative_collaboration # 创意协作
    - learning_tutoring      # 学习辅导
    - task_management        # 任务管理
    - language_skills        # 语言能力
    
  # 个性化配置
  personalization:
    knowledge_base_enabled: true
    style_adaptation_enabled: true
    context_continuity_enabled: true
    
  # 生命周期配置
  lifecycle:
    idle_timeout: 300  # 5分钟无活动自动关闭
    max_session_duration: 3600  # 最大会话时长1小时
    auto_cleanup: true  # 会话结束后自动清理资源
```

### 3.2 技能设计

```yaml
# sub_project/skills/practical-core/skill.yml
name: practical-core
description: 实用能力核心技能
version: 1.0.0

actions:
  - name: process_practical_request
    description: 处理实用能力请求
    parameters:
      - name: task_type
        type: string
        enum: [information_retrieval, document_processing, code_assistance, creative_collaboration, learning_tutoring, task_management, language_skills]
        required: true
      - name: request
        type: string
        required: true
      - name: user_context
        type: object
        required: true
        properties:
          - user_id
          - knowledge_summary
          - style_profile
          - recent_tasks
          - current_goals
      - name: session_id
        type: string
        required: true
    returns:
      type: object
      properties:
        - name: enhanced_response
          type: string
        - name: applied_knowledge
          type: array
        - name: style_adaptation_applied
          type: boolean
        - name: context_continuity_used
          type: boolean
        - name: session_active
          type: boolean

  - name: get_knowledge_context
    description: 获取个性化知识库上下文
    parameters:
      - name: user_id
        type: string
        required: true
      - name: task_query
        type: string
        required: true
    returns:
      type: object
      properties:
        - name: knowledge_context
          type: string
        - name: relevant_categories
          type: array
        - name: confidence_score
          type: number

  - name: apply_style_adaptation
    description: 应用交互风格适配
    parameters:
      - name: response
        type: string
        required: true
      - name: style_profile
        type: object
        required: true
    returns:
      type: object
      properties:
        - name: adapted_response
          type: string
        - name: adaptations_applied
          type: array
```

### 3.3 数据同步

子AI Agent需要与主AI Agent共享以下数据：

| 数据类型 | 同步方向 | 同步方式 | 说明 |
|---------|---------|---------|------|
| 个性化知识库 | 主 → 子 | API调用 | 启动时一次性加载 |
| 交互风格画像 | 主 → 子 | API调用 | 启动时一次性加载 |
| 上下文信息 | 主 → 子 | API调用 | 启动时一次性加载 |
| 实用能力结果 | 子 → 主 | API回调 | 处理完成后返回 |
| 会话状态 | 子 → 主 | 心跳机制 | 定期报告活跃状态 |

---

## 4. 与主AI Agent的交互

### 4.1 请求检测

主AI Agent通过关键词和意图识别检测实用能力请求：

```typescript
// 主AI Agent中的实用能力检测逻辑
const PRACTICAL_KEYWORDS = {
  document_processing: ['总结', '文档', '文章', '论文', '报告', '提取', '分析'],
  code_assistance: ['代码', '编程', '写代码', 'debug', '调试', '函数', 'class', 'API'],
  information_retrieval: ['查', '搜索', '最新', '动态', '新闻', '信息'],
  learning_tutoring: ['解释', '学习', '概念', '原理', '教学', '辅导'],
  task_management: ['规划', '安排', '计划', '日程', '任务', 'todo'],
  language_skills: ['翻译', '英文', '文案', '润色', '写作'],
  creative_collaboration: ['创意', '故事', '写作', '生成', '创作', '头脑风暴']
};

function detectPracticalRequest(message: string): string | null {
  for (const [type, keywords] of Object.entries(PRACTICAL_KEYWORDS)) {
    if (keywords.some(keyword => message.includes(keyword))) {
      return type;
    }
  }
  return null;
}
```

### 4.2 会话管理

```typescript
// 实用能力会话管理
interface PracticalSession {
  sessionId: string;
  userId: string;
  taskType: string;
  startTime: Date;
  lastActivity: Date;
  openClawPodName: string;
  status: 'active' | 'idle' | 'completed' | 'expired';
}

class PracticalSessionManager {
  private sessions: Map<string, PracticalSession> = new Map();
  
  async startSession(userId: string, taskType: string, userContext: UserContext): Promise<PracticalSession> {
    // 1. 创建会话ID
    const sessionId = uuidv4();
    
    // 2. 启动OpenClaw实例
    const podName = await this.launchOpenClawInstance(userId, sessionId);
    
    // 3. 初始化子AI Agent
    await this.initializeSubAgent(podName, userContext);
    
    // 4. 创建会话记录
    const session: PracticalSession = {
      sessionId,
      userId,
      taskType,
      startTime: new Date(),
      lastActivity: new Date(),
      openClawPodName: podName,
      status: 'active'
    };
    
    this.sessions.set(sessionId, session);
    return session;
  }
  
  async processRequest(sessionId: string, request: string): Promise<PracticalResponse> {
    const session = this.sessions.get(sessionId);
    if (!session || session.status !== 'active') {
      throw new Error('Session not found or inactive');
    }
    
    // 更新最后活动时间
    session.lastActivity = new Date();
    
    // 调用子AI Agent处理请求
    const response = await this.callSubAgent(session.openClawPodName, request);
    
    // 检查是否需要结束会话
    if (this.shouldEndSession(response)) {
      await this.endSession(sessionId);
    }
    
    return response;
  }
  
  async endSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) return;
    
    // 关闭OpenClaw实例
    await this.shutdownOpenClawInstance(session.openClawPodName);
    
    // 清理会话
    this.sessions.delete(sessionId);
  }
  
  // 定期清理过期会话
  async cleanupExpiredSessions(): Promise<void> {
    const now = new Date();
    for (const [sessionId, session] of this.sessions.entries()) {
      const idleTime = now.getTime() - session.lastActivity.getTime();
      if (idleTime > 300000) { // 5分钟
        await this.endSession(sessionId);
      }
    }
  }
}
```

### 4.3 API接口

```typescript
// 实用能力路由器API
interface PracticalRouterAPI {
  // 启动实用能力会话
  POST '/api/practical/start': {
    body: {
      userId: string;
      taskType: string;
      userContext: UserContext;
    };
    response: {
      sessionId: string;
      message: string;
    };
  };

  // 处理实用能力请求
  POST '/api/practical/process': {
    body: {
      sessionId: string;
      request: string;
    };
    response: {
      enhancedResponse: string;
      appliedKnowledge: string[];
      styleAdaptationApplied: boolean;
      contextContinuityUsed: boolean;
      sessionActive: boolean;
    };
  };

  // 结束实用能力会话
  POST '/api/practical/end': {
    body: {
      sessionId: string;
    };
    response: {
      success: boolean;
    };
  };

  // 获取会话状态
  GET '/api/practical/status/:sessionId': {
    response: {
      status: 'active' | 'idle' | 'completed' | 'expired';
      remainingTime: number;
    };
  };
}
```

---

## 5. 成本优化策略

### 5.1 资源使用对比

| 方案 | 服务器成本 | 内存使用 | CPU使用 | 适用场景 |
|------|-----------|---------|---------|----------|
| **原方案（每个用户OpenClaw）** | 高（~2000元/100用户） | 2GB/用户 | 1CPU/用户 | 小规模测试 |
| **新方案（按需启动）** | 低（~500元/100用户） | 2GB/活跃会话 | 1CPU/活跃会话 | 生产环境 |

### 5.2 优化措施

1. **会话超时**：5分钟无活动自动关闭子AI Agent
2. **最大会话时长**：单次会话不超过1小时
3. **并发限制**：限制同时活跃的子AI Agent数量
4. **资源回收**：会话结束后立即释放资源
5. **缓存机制**：缓存常用的知识库数据，减少重复加载

### 5.3 成本估算

| 用户规模 | 活跃会话比例 | 服务器成本 | 节省比例 |
|---------|-------------|-----------|----------|
| 100 DAU | 10% (10个) | ~800元/月 | 60% |
| 500 DAU | 8% (40个) | ~1500元/月 | 70% |
| 1000 DAU | 5% (50个) | ~2000元/月 | 80% |

---

## 6. 部署方案

### 6.1 Kubernetes资源配置

```yaml
# sub_project/k8s/practical-agent-template.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: practical-agent-${SESSION_ID}
  namespace: we-are-all-world
  labels:
    app: practical-agent
    session-id: ${SESSION_ID}
    user-id: ${USER_ID}
spec:
  replicas: 1
  selector:
    matchLabels:
      app: practical-agent-${SESSION_ID}
  template:
    metadata:
      labels:
        app: practical-agent-${SESSION_ID}
    spec:
      containers:
        - name: practical-agent
          image: ghcr.io/openclaw/openclaw:latest
          ports:
            - containerPort: 18789
          env:
            - name: OPENCLAW_CONFIG_FILE
              value: /app/sub_project/openclaw-practical-config.yml
            - name: SESSION_ID
              value: ${SESSION_ID}
            - name: USER_ID
              value: ${USER_ID}
            - name: GATEWAY_TOKEN
              valueFrom:
                secretKeyRef:
                  name: practical-agent-${SESSION_ID}-secret
                  key: gateway-token
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
            - mountPath: /app/sub_project
              name: config
              readOnly: true
          livenessProbe:
            httpGet:
              path: /health
              port: 18789
              httpHeaders:
                - name: X-Gateway-Token
                  value: ${GATEWAY_TOKEN}
            initialDelaySeconds: 30
            periodSeconds: 60
            timeoutSeconds: 10
          lifecycle:
            preStop:
              exec:
                command: ["/bin/sh", "-c", "curl -X POST http://localhost:18789/shutdown"]
      volumes:
        - name: workspace
          emptyDir: {}
        - name: config
          configMap:
            name: practical-agent-config
---
apiVersion: v1
kind: Service
metadata:
  name: practical-agent-${SESSION_ID}
  namespace: we-are-all-world
spec:
  selector:
    app: practical-agent-${SESSION_ID}
  ports:
    - port: 18789
      targetPort: 18789
  type: ClusterIP
```

### 6.2 自动清理Job

```yaml
# sub_project/k8s/cleanup-job.yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: practical-agent-cleanup
  namespace: we-are-all-world
spec:
  schedule: "*/5 * * * *"  # 每5分钟执行一次
  jobTemplate:
    spec:
      template:
        spec:
          containers:
            - name: cleanup
              image: weareallworld/practical-cleanup:latest
              env:
                - name: K8S_NAMESPACE
                  value: "we-are-all-world"
                - name: SESSION_TIMEOUT
                  value: "300"
          restartPolicy: OnFailure
```

---

## 相关文档

- [主AI Agent架构设计](../doc_game/MVP/开发实现/01_项目架构概述.md)
- [数据库设计](../doc_game/MVP/开发实现/02_数据库设计.md)
- [API与业务逻辑](../doc_game/MVP/开发实现/06_API与业务逻辑.md)

---

*文档生成时间：2026年2月23日*
*版本：v1.0*
*更新说明：首次创建实用能力助手子AI Agent设计文档，定义基于OpenClaw的按需启动架构*