# API 文档

大同世界后端 API 文档

## 基础信息

- **Base URL**: `http://localhost:3000/api/v1`
- **认证方式**: API Key + User ID
- **请求头**:
  - `X-API-Key`: API 密钥
  - `X-User-ID`: 用户 ID
  - `Content-Type`: `application/json`

---

## 认证接口

### 确保用户存在

```http
POST /auth/ensure-user
```

**请求体**:
```json
{
  "telegramUserId": 123456789,
  "telegramUsername": "username"
}
```

**响应**:
```json
{
  "success": true,
  "data": {
    "user": { "id": "uuid", "email": "...", ... },
    "isNewUser": false
  }
}
```

---

## AI 伙伴接口

### 获取 AI 伙伴

```http
GET /ai-partner
```

**响应**:
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "user_id": "uuid",
    "name": "小助手",
    "status": "active",
    "total_contribution": 100,
    "level": 3
  }
}
```

### 修改 AI 伙伴名称

```http
PUT /ai-partner/name
```

**请求体**:
```json
{ "name": "新名称" }
```

### 获取里程碑列表

```http
GET /ai-partner/milestones
```

**响应**:
```json
{
  "success": true,
  "data": [
    { "threshold": 10, "title": "初次连接", "rewards": [...] },
    { "threshold": 25, "title": "深入交流", "rewards": [...] },
    ...
  ]
}
```

### 签到

```http
POST /ai-partner/checkin
```

---

## 对话接口

### 发送消息

```http
POST /dialogue
```

**请求体**:
```json
{ "message": "你好，今天天气怎么样？" }
```

**响应**:
```json
{
  "success": true,
  "data": {
    "aiReply": "今天天气很好...",
    "qualityResult": {
      "qualityType": "daily",
      "points": 2,
      "emotionDetected": null
    }
  }
}
```

### 获取对话历史

```http
GET /dialogue/history?limit=10
```

---

## 剧情接口

### 获取剧情进度

```http
GET /story
```

### 获取章节列表

```http
GET /story/chapters
```

**响应**:
```json
{
  "success": true,
  "data": [
    { "id": 1, "title": "序章", "requiredContribution": 0 },
    { "id": 2, "title": "第一章", "requiredContribution": 10 },
    ...
  ]
}
```

---

## 贡献值类型

| 类型 | 点数 | 说明 |
|-----|-----|-----|
| greeting | 1 | 问候（早安、晚安等） |
| daily | 2 | 日常对话 |
| emotion | 3 | 情感表达 |
| experience | 4 | 分享经历 |
| deep_thought | 5 | 深度思考 |
| special_memory | 6-8 | 特殊回忆 |

---

## 错误响应

```json
{
  "success": false,
  "error": {
    "code": "INVALID_REQUEST",
    "message": "请求参数无效"
  }
}
```

### 常见错误码

| 状态码 | 错误码 | 说明 |
|-------|-------|-----|
| 400 | INVALID_REQUEST | 请求参数无效 |
| 401 | UNAUTHORIZED | 未认证 |
| 403 | FORBIDDEN | 无权限 |
| 404 | NOT_FOUND | 资源不存在 |
| 429 | RATE_LIMITED | 请求过于频繁 |
| 500 | INTERNAL_ERROR | 服务器内部错误 |

---

## 速率限制

- 默认: 100 请求/分钟
- 对话接口: 30 请求/分钟

超出限制返回 `429 Too Many Requests`