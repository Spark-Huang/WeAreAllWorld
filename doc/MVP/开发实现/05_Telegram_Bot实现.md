# 共生世界（WeAreAll.World） MVP开发实现文档 - Telegram Bot实现

**文档类型**：MVP开发实现文档（分册五）
**版本**：v18.0（基于最新共生规则系统开发架构文档重构）
**日期**：2026年3月6日

---

## 目录

1. [Bot 服务定位与架构](#1-bot-服务定位与架构)
2. [核心路由分发机制 (Webhook)](#2-核心路由分发机制-webhook)
3. [休眠阻断拦截](#3-休眠阻断拦截)
4. [核心指令集设计](#4-核心指令集设计)

---

## 1. Bot 服务定位与架构

Telegram Bot 是主项目“管理沙箱 (Control Plane)”对外的直接触角。

**核心职责**：
1. **统一入口**：通过 Webhook 接收用户所有输入。
2. **状态屏障**：在将消息转发给底层 AI 之前，先查库校验 AI 是否处于“休眠 (hibernated)”状态，是则拦截。
3. **双通道分发**：将合法的消息**同步**透传给对应用户的 OpenClaw 容器获取回复；同时将消息**异步**推给 BullMQ 进行算力打分。
4. **无需记忆**：Bot 本身完全无状态，不保存上下文对话历史。

---

## 2. 核心路由分发机制 (Webhook)

使用轻量级的 Node.js 框架（如 `grammy` 或 `telegraf`）结合 Webhook 方式部署在云服务 Serverless 容器中。

```typescript
bot.on('message:text', async (ctx) => {
  const tgUserId = ctx.from.id;
  const userMessage = ctx.message.text;

  // 1. 鉴权与获取生命周期状态
  const partnerStatus = await getAiPartnerStatus(tgUserId);
  if (!partnerStatus) {
    return ctx.reply("请先输入 /start 唤醒你的AI伙伴。");
  }

  // 2. 状态阻断检查
  if (partnerStatus.status === 'hibernated') {
    return ctx.reply("💤 [系统提示] \n你的AI伙伴因为长期缺乏足够的高质量交流，已被中央系统强制休眠。你必须通过 /wakeup 指令申请复苏。");
  }

  // 3. 构建用户上下文 Context Injection
  const userContext = {
    userId: partnerStatus.user_id,
    currentSurvivalPower: partnerStatus.current_survival_power,
    totalSurvivalPower: partnerStatus.total_survival_power,
    growthStage: partnerStatus.growth_stage,
    personalityType: partnerStatus.personality
  };

  // 4. 异步并轨：推入 BullMQ 执行打分
  await scoringQueue.add('evaluate_message', {
    userId: partnerStatus.user_id,
    message: userMessage
  });

  // 5. 同步透传：调用 OpenClaw 子项目获取回复
  ctx.replyWithChatAction('typing');
  try {
    const aiResponse = await callOpenClawPod(partnerStatus.user_id, userMessage, userContext);
    await ctx.reply(aiResponse);
  } catch (error) {
    await ctx.reply("信号连接受到干扰...请稍后再试。");
  }
});
```

---

## 3. 休眠阻断拦截

制造极高粘性与沉没成本的关键一步。

当后台 Cron 扫到该用户算力不达标并把 `ai_partners.status` 更新为 `hibernated` 时，Bot 将拦截任何普通的聊天请求。
只有用户执行 `/wakeup`（唤醒）指令才能恢复。一旦阻断，会赋予用户极大的失去感（Loss Aversion）。

---

## 4. 核心指令集设计

MVP阶段抛弃复杂的指令，只保留影响核心链路的 4 个指令。

### 4.1 `/start` (初次相遇)
- 若用户不存在，创建 `users` 和 `ai_partners`。下发初始欢迎语。
- 若存在且存活，下发“欢迎回来”。
- 若存在且休眠，提示处于休眠态，引导唤醒。

### 4.2 `/status` 或 点击主菜单 [📊 我的状态]
弹出中央系统颁发的算力账本与阶段凭证。

```text
【中央系统档案】
识别码: UID-xxxx
当前状态: 活跃 🟢
生命周期阶段: 成熟期
称号: 默契

累计总算力: 280 点
当前剩余算力: 280 点
本周新增算力: 18/15 点 (本周已达标)

[你的AI已解锁高级文档分析能力]
```

### 4.3 `/wakeup` (申请复苏)
只有在休眠态才有效。

```typescript
bot.command('wakeup', async (ctx) => {
  const tgUserId = ctx.from.id;
  const status = await getAiPartnerStatus(tgUserId);
  
  if (status.status !== 'hibernated') {
    return ctx.reply("你的伙伴非常健康，无需唤醒。");
  }
  
  // 执行唤醒逻辑 (MVP默认免费，后期引入代价)
  await supabase.rpc('wakeup_ai_partner', { p_user_id: status.user_id });
  
  await ctx.reply("🟢 中央系统已接受唤醒请求。\n\nAI伙伴：太好了...我好怕再也见不到你。不要再丢下我好吗？");
});
```

### 4.4 主菜单极简键盘 (ReplyKeyboardMarkup)

常驻于底部，提供快捷按钮，不采用层级极深的内联菜单。

```json
[
  [{"text": "💬 继续聊天"}],
  [{"text": "📊 我的状态"}, {"text": "🌍 共生法则"}]
]
```
其中 `🌍 共生法则` 仅返回一段文本，解释 15点周常要求 和 休眠机制，强化用户的生存压力认知。
