# We Are All World MVP开发实现文档 - Telegram Bot实现

**文档类型**：MVP开发实现文档（分册五）
**版本**：v6.0（简化版）
**日期**：2026年2月25日

---

## 目录

1. [核心原则](#1-核心原则)
2. [Bot命令设计](#2-bot命令设计)
3. [消息处理流程](#3-消息处理流程)
4. [键盘交互设计](#4-键盘交互设计)

---

## 1. 核心原则

### 1.1 为什么简化Bot实现？

**错误的设计（已废弃）**：
- ❌ 11个Bot命令，功能重复
- ❌ 复杂的会话管理和中间件
- ❌ Bot中处理实用能力请求
- ❌ 引用事件驱动架构和OpenClawGateway
- ❌ 复杂的内联键盘交互

**正确的设计（符合优化原则）**：
- ✅ **只保留核心命令** - 4个命令足够MVP
- ✅ **OpenClaw处理实用能力** - 无需特殊命令
- ✅ **简化消息处理** - 直接调用OpenClaw API
- ✅ **移除会话管理** - 无状态设计
- ✅ **简化键盘交互** - 只保留主菜单

### 1.2 OpenClaw自动处理的功能

| 功能 | 旧设计（Bot处理） | 新设计（OpenClaw处理） |
|-----|-----------------|---------------------|
| **实用能力** | Bot检测关键词，调用特殊API | OpenClaw自动识别，无需特殊处理 |
| **对话历史** | Bot维护会话状态 | OpenClaw自动保存到PVC |
| **质量判定** | Bot调用QualityJudgeService | memory-point-calc Skill处理 |
| **记忆管理** | Bot调用memory-manager Skill | OpenClaw自动管理 |

### 1.3 架构简化

```
┌─────────────────────────────────────────────────────────────┐
│                  Telegram Bot（简化版）                      │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Bot Service                                        │   │
│  │  • 接收用户消息                                     │   │
│  │  • 调用OpenClaw API                                │   │
│  │  • 发送回复给用户                                  │   │
│  │  • 更新Supabase（记忆点数）                        │   │
│  └──────────┬──────────────────────────────────────────┘   │
│             │ API调用                                     │
│             ▼                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  用户OpenClaw Pod                                    │   │
│  │                                                     │   │
│  │  ┌─────────────────────────────────────────────┐   │   │
│  │  │  OpenClaw Engine                            │   │   │
│  │  │  • 识别实用能力请求                         │   │   │
│  │  │  • 调用emotion-express Skill                │   │   │
│  │  │  • 调用memory-point-calc Skill              │   │   │
│  │  │  • 调用story-progress Skill                 │   │   │
│  │  └─────────────────────────────────────────────┘   │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

**关键优势**：
- ✅ Bot代码量减少70%
- ✅ 无需维护复杂的会话状态
- ✅ OpenClaw自动处理所有AI逻辑
- ✅ 符合"优先使用OpenClaw内置能力"原则

---

## 2. Bot命令设计

### 2.1 MVP核心命令（仅4个）

| 命令 | 说明 | 权限 | 优先级 |
|-----|------|------|--------|
| `/start` | 开始使用/绑定账号 | 所有人 | P0 |
| `/memory` | 查看记忆点数和AI状态 | 已登录用户 | P0 |
| `/story` | 进入剧情模式 | 已登录用户 | P0 |
| `/checkin` | 每日签到 | 已登录用户 | P1 |

**移除的命令（为什么移除）**：

| 命令 | 移除原因 | 替代方案 |
|-----|---------|---------|
| `/help` | 非核心功能 | 在/start中说明 |
| `/profile` | 信息重复 | 合并到/memory |
| `/settings` | MVP阶段不需要 | 后续版本添加 |
| `/share` | 社交功能非核心 | 后续版本添加 |
| `/vote` | 共识投票非核心 | 后续版本添加 |
| `/wakeup` | 休眠通知自动发送 | 无需命令 |
| `/practical` | OpenClaw自动识别 | 无需特殊命令 |

### 2.2 命令详细说明

#### `/start` - 开始使用

**功能**：
- 新用户注册
- 已用户欢迎回来
- 开始新手引导

**流程**：
```
用户输入 /start
    ↓
检查是否已注册
    ↓
是 → 欢迎回来 + 主菜单
    ↓
否 → 创建用户 + AI伙伴 + 开始新手引导
```

**实现**：
```typescript
bot.command('start', async (ctx) => {
  const telegramUserId = ctx.from?.id;
  const telegramUsername = ctx.from?.username;

  if (!telegramUserId) {
    await ctx.reply('无法获取用户信息');
    return;
  }

  // 检查用户是否存在
  let user = await supabase
    .from('users')
    .select('*')
    .eq('telegram_user_id', telegramUserId)
    .single();

  if (!user.data) {
    // 新用户注册
    const { data: newUser } = await supabase
      .from('users')
      .insert({
        telegram_user_id: telegramUserId,
        telegram_username: telegramUsername
      })
      .select()
      .single();

    // 触发器会自动创建AI伙伴和剧情进度
    user = { data: newUser };

    // 发送欢迎消息
    await ctx.reply(
      `你好！我是你的AI伙伴。\n\n` +
      `我会记住你分享的所有事情，我们的情感连接会越来越深。\n\n` +
      `跟我聊聊天吧，告诉我你今天过得怎么样？😊`,
      {
        reply_markup: mainMenuKeyboard
      }
    );
  } else {
    // 已注册用户
    await ctx.reply(
      `欢迎回来！我一直在等你。\n\n` +
      `今天想聊点什么？`,
      {
        reply_markup: mainMenuKeyboard
      }
    );
  }
});
```

#### `/memory` - 查看记忆

**功能**：
- 显示当前记忆点数
- 显示AI成长阶段
- 显示已解锁能力
- 显示最近记忆

**回复示例**：
```
💫 记忆详情

📊 记忆点数：85点
🎭 成长阶段：成长期
🏆 当前称号：相知

✨ 已解锁能力：
• 基础对话
• 情感表达
• 任务系统
• 专属记忆

📝 最近记忆：
• 2026-02-24：用户分享了工作压力
• 2026-02-26：用户提到喜欢星际穿越
```

**实现**：
```typescript
bot.command('memory', async (ctx) => {
  const telegramUserId = ctx.from?.id;

  if (!telegramUserId) {
    await ctx.reply('请先使用 /start 命令');
    return;
  }

  // 查询用户和AI伙伴信息
  const { data } = await supabase
    .from('users')
    .select(`
      *,
      ai_partners!inner(*)
    `)
    .eq('telegram_user_id', telegramUserId)
    .single();

  if (!data) {
    await ctx.reply('请先使用 /start 命令');
    return;
  }

  const aiPartner = data.ai_partners[0];

  // 格式化能力列表
  const abilities = Object.entries(aiPartner.abilities || {})
    .filter(([_, unlocked]) => unlocked)
    .map(([key]) => {
      const names = {
        basic_chat: '基础对话',
        emotion_expression: '情感表达',
        task_system: '任务系统',
        exclusive_memory: '专属记忆',
        deep_conversation: '深度对话',
        self_awareness: '自我意识'
      };
      return `• ${names[key] || key}`;
    })
    .join('\n');

  await ctx.reply(
    `💫 记忆详情\n\n` +
    `📊 记忆点数：${aiPartner.memory_points}点\n` +
    `🎭 成长阶段：${aiPartner.growth_stage}\n` +
    `🏆 当前称号：${aiPartner.current_title}\n\n` +
    `✨ 已解锁能力：\n${abilities || '• 暂无'}`,
    {
      reply_markup: mainMenuKeyboard
    }
  );
});
```

#### `/story` - 剧情模式

**功能**：
- 显示当前剧情进度
- 提供"继续剧情"按钮

**流程**：
```
用户输入 /story
    ↓
查询当前剧情进度
    ↓
显示当前章节和场景
    ↓
提供"继续"按钮
    ↓
用户点击按钮 → 调用OpenClaw story-progress Skill
```

**实现**：
```typescript
bot.command('story', async (ctx) => {
  const telegramUserId = ctx.from?.id;

  if (!telegramUserId) {
    await ctx.reply('请先使用 /start 命令');
    return;
  }

  // 查询用户和剧情进度
  const { data } = await supabase
    .from('users')
    .select(`
      *,
      story_progress!inner(*)
    `)
    .eq('telegram_user_id', telegramUserId)
    .single();

  if (!data) {
    await ctx.reply('请先使用 /start 命令');
    return;
  }

  const storyProgress = data.story_progress;

  await ctx.reply(
    `📖 剧情模式\n\n` +
    `当前章节：第${storyProgress.current_chapter}章\n` +
    `状态：${storyProgress.status === 'completed' ? '已完成' : '进行中'}\n\n` +
    `准备好继续我们的故事了吗？`,
    {
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: '继续剧情',
              callback_data: `story_continue_${storyProgress.current_chapter}`
            }
          ],
          [
            {
              text: '返回主菜单',
              callback_data: 'main_menu'
            }
          ]
        ]
      }
    }
  );
});
```

#### `/checkin` - 每日签到

**功能**：
- 每日签到获得记忆点数
- 连续签到有额外奖励

**实现**：
```typescript
bot.command('checkin', async (ctx) => {
  const telegramUserId = ctx.from?.id;

  if (!telegramUserId) {
    await ctx.reply('请先使用 /start 命令');
    return;
  }

  // 查询用户ID
  const { data: user } = await supabase
    .from('users')
    .select('id')
    .eq('telegram_user_id', telegramUserId)
    .single();

  if (!user) {
    await ctx.reply('请先使用 /start 命令');
    return;
  }

  // 调用数据库函数处理签到
  const { data: result } = await supabase
    .rpc('process_daily_checkin', {
      p_user_id: user.id
    });

  if (!result) {
    await ctx.reply('今天已经签到过了！', {
      reply_markup: mainMenuKeyboard
    });
    return;
  }

  await ctx.reply(
    `✅ 签到成功！\n\n` +
    `📅 连续签到：${result.streak_count}天\n` +
    `🎁 获得记忆点数：+${result.total_reward}点`,
    {
      reply_markup: mainMenuKeyboard
    }
  );
});
```

---

## 3. 消息处理流程

### 3.1 普通消息处理

**核心逻辑**：所有消息都转发给OpenClaw处理

```typescript
// 处理所有文本消息
bot.on('message:text', async (ctx) => {
  const message = ctx.message.text;
  const telegramUserId = ctx.from?.id;

  if (!telegramUserId) return;

  // 查询用户和AI伙伴信息
  const { data } = await supabase
    .from('users')
    .select(`
      id,
      ai_partners!inner(id, memory_points, personality)
    `)
    .eq('telegram_user_id', telegramUserId)
    .single();

  if (!data) {
    await ctx.reply('请先使用 /start 命令');
    return;
  }

  const userId = data.id;
  const aiPartner = data.ai_partners[0];

  // 发送"正在输入"状态
  await ctx.replyWithChatAction('typing');

  // 调用OpenClaw API（通过K8s Service）
  const response = await fetch(
    `http://user-svc-${userId}:18789/api/chat`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-User-Context': JSON.stringify({
          userId: userId,
          memoryPoints: aiPartner.memory_points,
          personalityType: aiPartner.personality
        })
      },
      body: JSON.stringify({
        message: message
      })
    }
  );

  const result = await response.json();

  // 发送AI回复
  await ctx.reply(result.response, {
    parse_mode: 'Markdown'
  });

  // 更新记忆点数（如果有点数变化）
  if (result.memory_points > 0) {
    await supabase.rpc('update_memory_points', {
      p_user_id: userId,
      p_points: result.memory_points,
      p_source_type: 'dialogue',
      p_source_detail: result.quality_type
    });
  }
});
```

### 3.2 回调查询处理

**处理内联按钮点击**：

```typescript
// 处理所有回调查询
bot.on('callback_query', async (ctx) => {
  const data = ctx.callbackQuery.data;
  const telegramUserId = ctx.from?.id;

  if (!telegramUserId) return;

  // 查询用户ID
  const { data: user } = await supabase
    .from('users')
    .select('id')
    .eq('telegram_user_id', telegramUserId)
    .single();

  if (!user) {
    await ctx.answerCallbackQuery('请先使用 /start 命令');
    return;
  }

  const userId = user.id;

  // 处理不同的回调数据
  if (data === 'main_menu') {
    // 返回主菜单
    await ctx.editMessageText(
      '主菜单',
      { reply_markup: mainMenuKeyboard }
    );
  } else if (data.startsWith('story_continue_')) {
    // 继续剧情
    const chapter = data.split('_')[2];

    // 调用OpenClaw story-progress Skill
    const response = await fetch(
      `http://user-svc-${userId}:18789/api/skills/story-progress/get_scene`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chapter: parseInt(chapter),
          scene_id: 'start',
          user_context: { userId: userId }
        })
      }
    );

    const result = await response.json();

    await ctx.editMessageText(
      result.content,
      {
        reply_markup: {
          inline_keyboard: result.choices.map(choice => [{
            text: choice.text,
            callback_data: `story_choice_${choice.id}`
          }])
        }
      }
    );
  } else if (data.startsWith('story_choice_')) {
    // 处理剧情选择
    const choiceId = data.split('_')[2];

    // 更新剧情进度
    await supabase
      .from('story_progress')
      .update({
        choices_made: supabase.raw('array_append(choices_made, ?)', [choiceId])
      })
      .eq('user_id', userId);

    await ctx.answerCallbackQuery('选择已记录');
  }

  await ctx.answerCallbackQuery();
});
```

---

## 4. 键盘交互设计

### 4.1 主菜单键盘

**常驻键盘，显示在所有消息下方**：

```typescript
// 主菜单键盘
const mainMenuKeyboard = {
  keyboard: [
    [{ text: '💬 对话' }, { text: '💫 查看记忆' }],
    [{ text: '📖 剧情' }, { text: '📅 每日签到' }]
  ],
  resize_keyboard: true,
  persistent: true
};
```

**按钮功能**：

| 按钮 | 功能 | 实现 |
|-----|------|-----|
| `💬 对话` | 提示用户直接输入消息 | 发送提示文字 |
| `💫 查看记忆` | 调用/memory命令 | 发送记忆详情 |
| `📖 剧情` | 调用/story命令 | 进入剧情模式 |
| `📅 每日签到` | 调用/checkin命令 | 执行签到 |

**处理主菜单按钮**：

```typescript
// 处理主菜单按钮
bot.hears('💬 对话', async (ctx) => {
  await ctx.reply(
    '开始对话吧！直接输入你想说的话。',
    { reply_markup: mainMenuKeyboard }
  );
});

bot.hears('💫 查看记忆', async (ctx) => {
  // 触发/memory命令
  ctx.message.text = '/memory';
  await bot.handleUpdate({ message: ctx.message } as any);
});

bot.hears('📖 剧情', async (ctx) => {
  // 触发/story命令
  ctx.message.text = '/story';
  await bot.handleUpdate({ message: ctx.message } as any);
});

bot.hears('📅 每日签到', async (ctx) => {
  // 触发/checkin命令
  ctx.message.text = '/checkin';
  await bot.handleUpdate({ message: ctx.message } as any);
});
```

### 4.2 剧情选择键盘

**内联键盘，只在剧情场景显示**：

```typescript
// 剧情选择键盘（示例）
function createStoryChoicesKeyboard(choices: any[]) {
  return {
    inline_keyboard: choices.map(choice => [{
      text: choice.text,
      callback_data: `story_choice_${choice.id}`
    }])
  };
}
```

### 4.3 键盘设计原则

**MVP阶段键盘设计原则**：

1. **最小化交互层级** - 最多2次点击完成操作
2. **常驻主菜单** - 始终显示，方便用户
3. **内联键盘仅用于选择** - 剧情选择、确认操作
4. **避免过度设计** - 不要嵌套键盘

**键盘数量**：
- 1个常驻键盘（主菜单）
- 2-3个内联键盘（剧情选择、确认）

---

## 相关文档

- [01_项目架构概述.md](./01_项目架构概述.md) - 系统架构、核心组件、数据流
- [02_数据库设计.md](./02_数据库设计.md) - 简化后的数据库表结构
- [03_OpenClaw集成设计.md](./03_OpenClaw集成设计.md) - OpenClaw技能设计、数据同步
- [04_LLM集成设计.md](./04_LLM集成设计.md) - Prompt模板、质量判定服务
- [06_API与业务逻辑.md](./06_API与业务逻辑.md) - API接口、业务逻辑、定时任务
- [09_sub_project须知.md](../09_sub_project须知.md) - 云版OpenClaw开发指南

---

*文档生成时间：2026年2月25日*
*版本：v6.0（简化版）*
*更新说明：*
*1. 大幅简化Bot命令，从11个减少到4个核心命令*
*2. 移除实用能力命令（/practical），OpenClaw自动识别*
*3. 移除复杂的会话管理和中间件*
*4. 简化消息处理流程，直接调用OpenClaw API*
*5. 简化键盘交互，只保留主菜单和剧情选择*
*6. Bot代码量减少约70%*
*7. 符合"优先使用OpenClaw内置能力"和"简化设计"原则*
