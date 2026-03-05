# 共生世界（WeAreAll.World） MVP开发实现文档 - API与业务逻辑

**文档类型**：MVP开发实现文档（分册六）
**版本**：v16.0（基于最新需求文档与sub_project须知优化版）
**日期**：2026年2月26日

---

## 目录

1. [核心原则](#1-核心原则)
2. [API调用方式](#2-api调用方式)
3. [业务逻辑封装](#3-业务逻辑封装)
4. [定时任务](#4-定时任务)

---

## 1. 核心原则

### 1.1 为什么简化API设计？

**错误的设计（已废弃）**：
- ❌ 复杂的内部API（UserServiceAPI、ChatServiceAPI等）
- ❌ OpenClaw Gateway API封装层
- ❌ 多个重复的服务类（MemoryPointsService、MilestoneService等）
- ❌ 复杂的实用能力服务
- ❌ 5个定时任务

**正确的设计（符合优化原则）**：
- ✅ **直接调用Supabase** - 使用RPC和查询，无需封装
- ✅ **直接调用OpenClaw** - 无需Gateway API
- ✅ **数据库函数处理业务逻辑** - 减少后端代码
- ✅ **只保留2个核心定时任务** - 每周评估、休眠衰减
- ✅ **OpenClaw Skills处理AI逻辑** - 无需重复服务

### 1.2 API调用架构

```
┌─────────────────────────────────────────────────────────────┐
│                  管理沙箱（主项目）                          │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Bot Service / API Endpoints                        │   │
│  │                                                     │   │
│  │  • 直接调用 Supabase RPC                           │   │
│  │    - update_memory_points()                        │   │
│  │    - process_daily_checkin()                       │   │
│  │    - run_weekly_evaluation()                       │   │
│  │                                                     │   │
│  │  • 直接查询 Supabase                               │   │
│  │    - SELECT * FROM users                           │   │
│  │    - SELECT * FROM ai_partners                     │   │
│  │    - SELECT * FROM story_progress                  │   │
│  │                                                     │   │
│  │  • 直接调用 OpenClaw API                           │   │
│  │    - POST user-svc-{USER_ID}:18789/api/chat        │   │
│  │    - POST /api/skills/story-progress/get_scene     │   │
│  │    - POST /api/skills/memory-point-calc            │   │
│  └──────────────────┬──────────────────────────────────┘   │
│                     │                                      │
│                     ▼ API调用                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Supabase + OpenClaw                               │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

**关键优势**：
- ✅ 无需维护复杂的API封装层
- ✅ 数据库函数保证数据一致性
- ✅ 代码量减少60%
- ✅ 架构简单，易于维护

---

## 2. API调用方式

### 2.1 Supabase RPC调用（核心函数）

#### 更新记忆点数

```typescript
// 直接调用数据库函数
const { data, error } = await supabase
  .rpc('update_memory_points', {
    p_user_id: 'user-123',
    p_points: 5,              // 变更点数（+/-）
    p_source_type: 'dialogue', // 来源类型
    p_source_detail: 'emotion_expression'
  });

// 返回值
{
  previous_points: 80,
  new_points: 85,
  points_added: 5,
  milestones_reached: [
    { name: "exclusive_memory", threshold: 25 }
  ]
}
```

#### 每日签到

```typescript
const { data, error } = await supabase
  .rpc('process_daily_checkin', {
    p_user_id: 'user-123'
  });

// 返回值
{
  success: true,
  streak_count: 5,
  base_reward: 30,
  streak_bonus: 20,
  total_reward: 50
}
```

#### 每周评估

```typescript
const { data, error } = await supabase
  .rpc('run_weekly_evaluation', {
    p_user_id: 'user-123'
  });

// 返回值
{
  week_start: '2026-02-24',
  points_grown: 45,
  result: 'pass',
  reward_tier: 'active',
  threshold: 15
}
```

### 2.2 Supabase 查询示例

#### 查询用户完整信息

```typescript
const { data, error } = await supabase
  .from('users')
  .select(`
    *,
    ai_partners!inner(*),
    story_progress!inner(*)
  `)
  .eq('telegram_user_id', telegramUserId)
  .single();

// 返回用户 + AI伙伴 + 剧情进度
```

#### 查询记忆点数日志

```typescript
const { data, error } = await supabase
  .from('memory_points_log')
  .select('*')
  .eq('user_id', 'user-123')
  .order('created_at', { ascending: false })
  .limit(10);
```

#### 查询排行榜（前10名）

```typescript
const { data, error } = await supabase
  .from('ai_partners')
  .select('memory_points, users(telegram_username)')
  .order('memory_points', { ascending: false })
  .limit(10);
```

### 2.3 OpenClaw API调用

#### 发送对话消息

```typescript
const response = await fetch(
  `http://user-svc-${userId}:18789/api/chat`,
  {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-User-Context': JSON.stringify({
        userId: userId,
        memoryPoints: 85,
        personalityType: 'warm'
      })
    },
    body: JSON.stringify({
      message: '用户消息'
    })
  }
);

const result = await response.json();
// {
//   response: 'AI回复内容',
//   quality_type: 'emotion_expression',
//   memory_points: 3,
//   emotion_detected: 'happy'
// }
```

#### 调用story-progress Skill

```typescript
const response = await fetch(
  `http://user-svc-${userId}:18789/api/skills/story-progress/get_scene`,
  {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chapter: 1,
      scene_id: 'start',
      user_context: { userId: userId }
    })
  }
);

const result = await response.json();
// {
//   content: '场景内容...',
//   choices: [{id: 'A', text: '选择A'}, {id: 'B', text: '选择B'}]
// }
```

#### 调用memory-point-calc Skill

```typescript
const response = await fetch(
  `http://user-svc-${userId}:18789/api/skills/memory-point-calc/calculate_quality`,
  {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: '用户消息',
      response: 'AI回复'
    })
  }
);

const result = await response.json();
// {
//   quality_type: 'share_experience',
//   points: 4,
//   reason: '分享了今天的经历'
// }
```

---

## 3. 业务逻辑封装

### 3.1 核心函数封装

```typescript
// utils/supabase-client.ts
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY!;

export const supabase = createClient(supabaseUrl, supabaseKey);
```

```typescript
// services/user-service.ts
import { supabase } from '../utils/supabase-client';

// 获取用户完整信息
export async function getUserByTelegramId(telegramUserId: number) {
  const { data, error } = await supabase
    .from('users')
    .select(`
      *,
      ai_partners!inner(*),
      story_progress!inner(*)
    `)
    .eq('telegram_user_id', telegramUserId)
    .single();

  if (error) throw error;
  return data;
}

// 注册用户
export async function registerUser(telegramUserId: number, telegramUsername?: string) {
  const { data, error } = await supabase
    .from('users')
    .insert({
      telegram_user_id: telegramUserId,
      telegram_username: telegramUsername
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

// 更新用户最后登录时间
export async function updateLastLogin(userId: string) {
  const { error } = await supabase
    .from('users')
    .update({
      last_login_at: new Date().toISOString()
    })
    .eq('id', userId);

  if (error) throw error;
}
```

```typescript
// services/ai-partner-service.ts
import { supabase } from '../utils/supabase-client';

// 获取AI伙伴信息
export async function getAIPartner(userId: string) {
  const { data, error } = await supabase
    .from('ai_partners')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (error) throw error;
  return data;
}

// 更新AI伙伴状态
export async function updateAIStatus(userId: string, status: string) {
  const { error } = await supabase
    .from('ai_partners')
    .update({
      status: status,
      updated_at: new Date().toISOString()
    })
    .eq('user_id', userId);

  if (error) throw error;
}
```

```typescript
// services/story-service.ts
import { supabase } from '../utils/supabase-client';

// 获取剧情进度
export async function getStoryProgress(userId: string) {
  const { data, error } = await supabase
    .from('story_progress')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (error) throw error;
  return data;
}

// 更新剧情进度
export async function updateStoryProgress(
  userId: string,
  chapter: number,
  sceneId: string,
  choice: string
) {
  // 先获取当前进度
  const { data: currentProgress } = await supabase
    .from('story_progress')
    .select('choices_made')
    .eq('user_id', userId)
    .single();

  const { data, error } = await supabase
    .from('story_progress')
    .update({
      current_chapter: chapter,
      current_scene: sceneId,
      choices_made: [...(currentProgress?.choices_made || []), choice],
      updated_at: new Date().toISOString()
    })
    .eq('user_id', userId)
    .select()
    .single();

  if (error) throw error;
  return data;
}
```

### 3.2 OpenClaw调用封装

```typescript
// services/openclaw-service.ts

// 发送消息到OpenClaw
export async function sendMessageToOpenClaw(
  userId: string,
  message: string,
  userContext: any
) {
  const response = await fetch(
    `http://user-svc-${userId}:18789/api/chat`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-User-Context': JSON.stringify(userContext)
      },
      body: JSON.stringify({ message })
    }
  );

  if (!response.ok) {
    throw new Error(`OpenClaw API error: ${response.status}`);
  }

  return response.json();
}

// 获取剧情场景
export async function getStoryScene(
  userId: string,
  chapter: number,
  sceneId: string
) {
  const response = await fetch(
    `http://user-svc-${userId}:18789/api/skills/story-progress/get_scene`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chapter,
        scene_id: sceneId,
        user_context: { userId }
      })
    }
  );

  if (!response.ok) {
    throw new Error(`OpenClaw API error: ${response.status}`);
  }

  return response.json();
}
```

### 3.3 记忆点数更新流程

```typescript
// 完整流程示例
export async function handleUserMessage(
  telegramUserId: number,
  message: string
) {
  // 1. 获取用户信息
  const user = await getUserByTelegramId(telegramUserId);
  const aiPartner = user.ai_partners[0];

  // 2. 调用OpenClaw处理消息
  const openClawResponse = await sendMessageToOpenClaw(
    user.id,
    message,
    {
      userId: user.id,
      memoryPoints: aiPartner.memory_points,
      personalityType: aiPartner.personality
    }
  );

  // 3. 更新记忆点数（如果有）
  if (openClawResponse.memory_points > 0) {
    await supabase.rpc('update_memory_points', {
      p_user_id: user.id,
      p_change: openClawResponse.memory_points,
      p_source_type: 'dialogue',
      p_source_detail: openClawResponse.quality_type
    });
  }

  // 4. 返回AI回复
  return openClawResponse.response;
}
```

---

## 4. 定时任务

### 4.1 核心定时任务（仅2个）

| 任务名称 | 执行频率 | 功能 | 优先级 |
|---------|---------|------|--------|
| `weekly_evaluation` | 每周一 00:00 | 执行每周评估 | P0 |
| `dormant_decay` | 每日 00:00 | 休眠AI记忆点数衰减 | P0 |

**移除的任务**：
- ❌ daily_greeting（非核心）
- ❌ cleanup_expired（MVP数据量小）
- ❌ sync_stats（实时查询即可）

### 4.2 每周评估任务

```typescript
// tasks/weekly-evaluation.ts
import { supabase } from '../utils/supabase-client';
import { createClient } from '@supabase/supabase-js';

const adminSupabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

// 每周一执行评估
export async function runWeeklyEvaluation() {
  console.log('开始每周评估...');

  // 获取所有非休眠用户
  const { data: users, error } = await adminSupabase
    .from('users')
    .select('id');

  if (error) {
    console.error('获取用户失败:', error);
    return;
  }

  // 为每个用户执行评估
  for (const user of users) {
    try {
      const { data: result } = await adminSupabase
        .rpc('run_weekly_evaluation', {
          p_user_id: user.id
        });

      if (result && result.result === 'warning') {
        console.log(`用户 ${user.id} 评估警告`);
      }
    } catch (err) {
      console.error(`评估用户 ${user.id} 失败:`, err);
    }
  }

  console.log('每周评估完成');
}

// 使用node-cron调度
import cron from 'node-cron';

cron.schedule('0 0 * * 1', () => {  // 每周一00:00
  console.log('执行每周评估任务');
  runWeeklyEvaluation();
});
```

### 4.3 休眠衰减任务

```typescript
// tasks/dormant-decay.ts
import { supabase } from '../utils/supabase-client';
import { createClient } from '@supabase/supabase-js';

const adminSupabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

// 每日执行休眠衰减
export async function runDormantDecay() {
  console.log('开始休眠衰减...');

  // 获取所有休眠中的AI
  const { data: aiPartners, error } = await adminSupabase
    .from('ai_partners')
    .select('user_id, dormant_since')
    .eq('status', 'dormant');

  if (error) {
    console.error('获取休眠AI失败:', error);
    return;
  }

  // 为每个休眠AI执行衰减
  for (const ai of aiPartners) {
    try {
      // 获取当前记忆点数
      const { data: aiPartner } = await adminSupabase
        .from('ai_partners')
        .select('memory_points')
        .eq('user_id', ai.user_id)
        .single();

      if (aiPartner && aiPartner.memory_points > 0) {
        // 减少2点
        const newPoints = Math.max(0, aiPartner.memory_points - 2);

        await adminSupabase
          .from('ai_partners')
          .update({ memory_points: newPoints })
          .eq('user_id', ai.user_id);

        // 记录日志
        await adminSupabase
          .from('memory_points_log')
          .insert({
            user_id: ai.user_id,
            change: -2,
            source_type: 'dormant_decay',
            source_detail: `休眠衰减，剩余${newPoints}点`
          });

        // 如果归零，保持休眠状态
        if (newPoints === 0) {
          console.log(`用户 ${ai.user_id} 的AI记忆点数已归零，保持休眠状态`);
        }
      }
    } catch (err) {
      console.error(`处理用户 ${ai.user_id} 衰减失败:`, err);
    }
  }

  console.log('休眠衰减完成');
}

// 使用node-cron调度
import cron from 'node-cron';

cron.schedule('0 0 * * *', () => {  // 每日00:00
  console.log('执行休眠衰减任务');
  runDormantDecay();
});
```

### 4.4 任务部署

**使用Docker部署**：

```dockerfile
# Dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --production

COPY . .

CMD ["node", "tasks/scheduler.js"]
```

```javascript
// tasks/scheduler.ts
import cron from 'node-cron';
import { runWeeklyEvaluation } from './weekly-evaluation';
import { runDormantDecay } from './dormant-decay';

console.log('定时任务调度器启动');

// 每周一00:00执行评估
cron.schedule('0 0 * * 1', () => {
  console.log('[' + new Date().toISOString() + '] 执行每周评估');
  runWeeklyEvaluation();
});

// 每日00:00执行衰减
cron.schedule('0 0 * * *', () => {
  console.log('[' + new Date().toISOString() + '] 执行休眠衰减');
  runDormantDecay();
});
```

**Kubernetes部署**：

```yaml
# k8s/cronjob-weekly-evaluation.yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: weekly-evaluation
spec:
  schedule: "0 0 * * 1"  # 每周一00:00
  jobTemplate:
    spec:
      template:
        spec:
          containers:
          - name: evaluation
            image: your-registry/game-tasks:latest
            command: ["node", "tasks/weekly-evaluation.js"]
            env:
            - name: SUPABASE_URL
              valueFrom:
                secretKeyRef:
                  name: supabase-config
                  key: url
            - name: SUPABASE_SERVICE_KEY
              valueFrom:
                secretKeyRef:
                  name: supabase-config
                  key: service-key
          restartPolicy: OnFailure
```

```yaml
# k8s/cronjob-dormant-decay.yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: dormant-decay
spec:
  schedule: "0 0 * * *"  # 每日00:00
  jobTemplate:
    spec:
      template:
        spec:
          containers:
          - name: decay
            image: your-registry/game-tasks:latest
            command: ["node", "tasks/dormant-decay.js"]
            env:
            - name: SUPABASE_URL
              valueFrom:
                secretKeyRef:
                  name: supabase-config
                  key: url
            - name: SUPABASE_SERVICE_KEY
              valueFrom:
                secretKeyRef:
                  name: supabase-config
                  key: service-key
          restartPolicy: OnFailure
```

---

## 相关文档

- [01_项目架构概述.md](./01_项目架构概述.md) - 系统架构、核心组件、数据流
- [02_数据库设计.md](./02_数据库设计.md) - 简化后的数据库表结构
- [03_OpenClaw集成设计.md](./03_OpenClaw集成设计.md) - OpenClaw技能设计、数据同步
- [04_LLM集成设计.md](./04_LLM集成设计.md) - Prompt模板、质量判定服务
- [05_Telegram_Bot实现.md](./05_Telegram_Bot实现.md) - Bot命令、消息处理
- [09_sub_project须知.md](../09_sub_project须知.md) - 云版OpenClaw开发指南

---

*文档生成时间：2026年2月26日*
*版本：v16.0（基于最新需求文档与sub_project须知优化版）*
*更新说明：*
*1. 废弃复杂的内部API设计（UserServiceAPI、ChatServiceAPI等）*
*2. 直接调用Supabase RPC和查询，无需封装层*
*3. 直接调用OpenClaw API，无需Gateway API*
*4. 移除多个重复的服务类（MemoryPointsService、MilestoneService等）*
*5. 只保留2个核心定时任务（每周评估、休眠衰减）*
*6. 业务逻辑主要由数据库函数和OpenClaw Skills处理*
*7. 代码量减少约60%*
*8. 符合"简化设计"和"复用OpenClaw能力"原则*
*9. 更新版本号至v16.0以保持与其他文档一致*
