# 大同世界（WeAreAll.World） MVP开发实现文档 - API与业务逻辑

**文档类型**：MVP开发实现文档（分册六）
**版本**：v18.0（基于最新共生规则系统开发架构文档重构）
**日期**：2026年3月6日

---

## 目录

1. [核心架构原则](#1-核心架构原则)
2. [后台异步处理队列 (BullMQ)](#2-后台异步处理队列-bullmq)
3. [定时任务 (Cron Jobs)](#3-定时任务-cron-jobs)
4. [核心RPC业务封装](#4-核心rpc业务封装)

---

## 1. 核心架构原则

为保证 Telegram Bot 的极速响应，并将高耗时的 LLM 评估与核心库更新脱离主请求链路，本系统的业务逻辑高度依赖**异步消息队列 (BullMQ)** 和 **数据库内建函数 (Supabase RPC)**。

---

## 2. 后台异步处理队列 (BullMQ)

### 2.1 队列配置
在管理沙箱 (Control Plane) 的 Node.js 环境中引入 Redis 和 BullMQ。
创建队列 `scoringQueue`。

### 2.2 Worker 处理逻辑

```typescript
import { Worker, Job } from 'bullmq';

const scoringWorker = new Worker('scoringQueue', async (job: Job) => {
  const { userId, message } = job.data;
  
  // 1. 防刷检查 (从 Redis 获取近期频率)
  const freq = await checkFrequencyLimit(userId);
  if (freq > MAX_FAST_MSG_PER_MIN) {
     // 被判定为灌水，直接给1分，跳过LLM
     await supabase.rpc('add_survival_power', { p_user_id: userId, p_power: 1 });
     return { skip_llm: true, reason: 'rate_limited' };
  }

  // 2. 调用专属评估 LLM 进行定级与提纯
  const prompt = generateEvaluationPrompt(message);
  const evaluationJSON = await callEvaluationLLM(prompt);
  /* 
   * evaluationJSON 期望格式:
   * { "category": "deep_thought", "score": 5, "rarity": "...", "extracted_memory": "..." }
   */
   
  // 3. 记录日志（数据资产化）
  await supabase.from('interaction_logs').insert({
    user_id: userId,
    message_hash: hashMessage(message), // 仅存 Hash 和 提纯的提取记忆，保护原文明文隐私
    category: evaluationJSON.category,
    granted_power: evaluationJSON.score,
    data_rarity: evaluationJSON.rarity,
    ai_understanding: evaluationJSON
  });
  
  // 4. 执行算力发放RPC (处理累加及里程碑触发)
  await supabase.rpc('add_survival_power', { 
    p_user_id: userId, 
    p_power: evaluationJSON.score 
  });
  
  return { success: true };
}, { connection: redisConnection });
```

---

## 3. 定时任务 (Cron Jobs)

使用 `node-cron` 或 K8s 内部 CronJob 驱动，定期拉起清洗脚本操作 Supabase 数据库。这是系统产生“压迫感”的核心。

### 3.1 周常核算与休眠 (Weekly Evaluation)

**频次**：每小时执行一次。扫描 `registration_date` 对齐到今日此时的用户（确保每个用户满整整 7 天才被核算）。

```typescript
// 伪代码逻辑
async function runWeeklyEvaluation() {
  // 1. 查出满7天周期的用户
  const usersToEvaluate = await fetchUsersReachingWeeklyCycle();
  
  for(const user of usersToEvaluate) {
    const ai = user.ai_partners;
    const passed = ai.weekly_new_power >= 15;
    
    let action = 'none';
    let newViolation = ai.violation_count;
    
    if (!passed) {
      newViolation += 1;
      if (newViolation >= 2) {
        action = 'hibernated';
        // 触发休眠
        await supabase.from('ai_partners').update({
          status: 'hibernated',
          dormant_since: new Date().toISOString(),
          weekly_new_power: 0,
          violation_count: newViolation
        }).eq('user_id', user.id);
      } else {
        action = 'warned';
        // 记一次违规但清零周积分，重新算
        await supabase.from('ai_partners').update({
          weekly_new_power: 0,
          violation_count: newViolation
        }).eq('user_id', user.id);
      }
    } else {
      // 通过，重置数据迎接新一周
      await supabase.from('ai_partners').update({
        weekly_new_power: 0,
        violation_count: 0
      }).eq('user_id', user.id);
    }
    
    // 写入审计表
    await supabase.from('central_evaluations').insert({
       user_id: user.id,
       required_power: 15,
       achieved_power: ai.weekly_new_power,
       passed: passed,
       action_taken: action
    });
  }
}
```

### 3.2 每日休眠衰减 (Daily Decay)

**频次**：每日凌晨 00:00 全局扫描。

```typescript
async function runDailyDecay() {
  // 对所有 status = 'hibernated' 且 current_survival_power > 0 的记录扣2分
  
  // 1. 批量调用 RPC 或者直接批量 Update
  const { data: affectedAi } = await supabase.from('ai_partners')
     .select('user_id, current_survival_power')
     .eq('status', 'hibernated')
     .gt('current_survival_power', 0);
     
  for (const ai of affectedAi) {
     // RPC内部含 GREATEST(0, current_survival_power - 2)
     await supabase.rpc('add_survival_power', { p_user_id: ai.user_id, p_power: -2 });
     
     // 记录衰减日志
     await supabase.from('interaction_logs').insert({
       user_id: ai.user_id,
       granted_power: -2,
       source_type: 'decay',
       ai_understanding: { reason: "休眠期每日惩罚" }
     });
  }
}
```

---

## 4. 核心RPC业务封装

所有的状态变化都必须收口在单一的原子层以防并发脏写。这在 `02_数据库设计.md` 中的 `add_survival_power` 已经完整体现。

### 4.1 唤醒补偿 RPC (`wakeup_ai_partner`)

```sql
CREATE OR REPLACE FUNCTION public.wakeup_ai_partner(
  p_user_id UUID
) RETURNS JSONB LANGUAGE plpgsql AS $$
DECLARE
  v_ai RECORD;
  v_days_dormant INTEGER;
  v_penalty INTEGER;
  v_refund INTEGER;
BEGIN
  SELECT * INTO v_ai FROM public.ai_partners WHERE user_id = p_user_id AND status = 'hibernated' FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false); END IF;
  
  -- 粗略计算休眠天数
  v_days_dormant := EXTRACT(DAY FROM NOW() - v_ai.dormant_since);
  v_penalty := v_days_dormant * 2;
  -- 返还损失的一半
  v_refund := v_penalty / 2;
  
  UPDATE public.ai_partners 
  SET status = 'active',
      dormant_since = NULL,
      violation_count = 0,
      current_survival_power = current_survival_power + v_refund
  WHERE user_id = p_user_id;
  
  RETURN jsonb_build_object('success', true, 'refunded', v_refund);
END;
$$;
