/**
 * 深度对话引导服务
 * 
 * 功能：AI 主动引导用户分享深度内容
 * 目的：提高互动质量和贡献值
 */

import { supabase } from '../api/config/supabase.js'

export interface DeepDialoguePrompt {
  id: string
  type: 'childhood' | 'experience' | 'values' | 'dreams' | 'emotion' | 'memory'
  title: string
  description: string
  prompt: string
  followUp: string[]
  reward: number
  estimatedTime: string
}

// 深度对话主题库
export const DEEP_DIALOGUE_PROMPTS: DeepDialoguePrompt[] = [
  // 童年回忆
  {
    id: 'childhood-1',
    type: 'childhood',
    title: '童年游戏',
    description: '聊聊你小时候最喜欢玩的游戏',
    prompt: '我很好奇你的童年。跟我说说你小时候最喜欢玩的游戏是什么？为什么喜欢它？',
    followUp: [
      '那时候你经常和谁一起玩？',
      '现在还会想起那段时光吗？',
      '有什么特别的回忆吗？'
    ],
    reward: 8,
    estimatedTime: '5-10分钟'
  },
  {
    id: 'childhood-2',
    type: 'childhood',
    title: '童年梦想',
    description: '分享你小时候的梦想',
    prompt: '你小时候有什么梦想吗？想成为什么样的人？',
    followUp: [
      '那个梦想现在还在吗？',
      '是什么让你改变了想法？',
      '你觉得童年梦想对现在的你有影响吗？'
    ],
    reward: 8,
    estimatedTime: '5-10分钟'
  },
  {
    id: 'childhood-3',
    type: 'childhood',
    title: '童年味道',
    description: '聊聊记忆中的味道',
    prompt: '有没有一种食物，让你想起童年？是什么味道？',
    followUp: [
      '是谁给你做的？',
      '现在还能吃到吗？',
      '那个味道对你意味着什么？'
    ],
    reward: 7,
    estimatedTime: '3-5分钟'
  },

  // 重要经历
  {
    id: 'experience-1',
    type: 'experience',
    title: '人生转折点',
    description: '分享改变你人生的时刻',
    prompt: '人生中有没有一个时刻，让你觉得一切都变了？是什么事？',
    followUp: [
      '当时你是怎么想的？',
      '现在回头看，你怎么看待那个时刻？',
      '它让你成为了什么样的人？'
    ],
    reward: 10,
    estimatedTime: '10-15分钟'
  },
  {
    id: 'experience-2',
    type: 'experience',
    title: '最骄傲的事',
    description: '聊聊让你骄傲的成就',
    prompt: '你人生中最骄傲的事情是什么？为什么让你骄傲？',
    followUp: [
      '为了这件事你付出了什么？',
      '它对你意味着什么？',
      '你会怎么跟别人分享这个故事？'
    ],
    reward: 9,
    estimatedTime: '8-12分钟'
  },
  {
    id: 'experience-3',
    type: 'experience',
    title: '克服困难',
    description: '分享你如何面对挑战',
    prompt: '有没有遇到过很大的困难？你是怎么克服的？',
    followUp: [
      '当时想放弃过吗？',
      '谁帮助了你？',
      '这件事教会了你什么？'
    ],
    reward: 9,
    estimatedTime: '8-12分钟'
  },

  // 价值观
  {
    id: 'values-1',
    type: 'values',
    title: '人生意义',
    description: '聊聊你对人生的理解',
    prompt: '你觉得人生的意义是什么？或者，你在寻找什么样的意义？',
    followUp: [
      '这个想法是怎么形成的？',
      '你还在探索吗？',
      '有什么书或人影响了你的想法？'
    ],
    reward: 10,
    estimatedTime: '10-15分钟'
  },
  {
    id: 'values-2',
    type: 'values',
    title: '重要的人',
    description: '聊聊对你最重要的人',
    prompt: '谁是对你最重要的人？为什么？',
    followUp: [
      '你们是怎么认识的？',
      '他/她对你有什么影响？',
      '你想对他说什么？'
    ],
    reward: 8,
    estimatedTime: '5-10分钟'
  },
  {
    id: 'values-3',
    type: 'values',
    title: '相信的事',
    description: '分享你的信念',
    prompt: '有什么事是你一直相信的？为什么？',
    followUp: [
      '这个信念是怎么来的？',
      '有人质疑过吗？',
      '它如何影响你的选择？'
    ],
    reward: 9,
    estimatedTime: '8-12分钟'
  },

  // 梦想与未来
  {
    id: 'dreams-1',
    type: 'dreams',
    title: '未来规划',
    description: '聊聊你对未来的想法',
    prompt: '你对未来有什么规划或期待吗？想实现什么？',
    followUp: [
      '为什么这对你重要？',
      '你现在在做什么准备？',
      '有什么担心的吗？'
    ],
    reward: 8,
    estimatedTime: '5-10分钟'
  },
  {
    id: 'dreams-2',
    type: 'dreams',
    title: '想做的事',
    description: '分享你的愿望清单',
    prompt: '有没有什么一直想做但还没做的事？是什么？',
    followUp: [
      '为什么还没做？',
      '什么时候会去做？',
      '需要什么帮助吗？'
    ],
    reward: 7,
    estimatedTime: '5-8分钟'
  },

  // 情感
  {
    id: 'emotion-1',
    type: 'emotion',
    title: '最近的心情',
    description: '分享你最近的状态',
    prompt: '最近过得怎么样？有什么想说的吗？',
    followUp: [
      '是什么让你有这种感觉？',
      '有什么我可以帮你的吗？',
      '你想聊聊具体的事吗？'
    ],
    reward: 6,
    estimatedTime: '3-5分钟'
  },
  {
    id: 'emotion-2',
    type: 'emotion',
    title: '感恩的事',
    description: '聊聊让你感恩的事',
    prompt: '最近有什么让你感恩的事吗？',
    followUp: [
      '为什么这件事让你感恩？',
      '你想感谢谁？',
      '感恩对你意味着什么？'
    ],
    reward: 7,
    estimatedTime: '5-8分钟'
  },

  // 记忆
  {
    id: 'memory-1',
    type: 'memory',
    title: '最难忘的一天',
    description: '分享你记忆中最特别的一天',
    prompt: '你人生中最难忘的一天是什么时候？发生了什么？',
    followUp: [
      '那天你是什么感觉？',
      '现在想起来会怎样？',
      '它改变了你什么？'
    ],
    reward: 10,
    estimatedTime: '10-15分钟'
  },
  {
    id: 'memory-2',
    type: 'memory',
    title: '想记住的事',
    description: '聊聊你想永远记住的事',
    prompt: '有没有什么事，是你希望永远记住的？',
    followUp: [
      '为什么这件事这么重要？',
      '你想怎么记住它？',
      '如果忘记了会怎样？'
    ],
    reward: 9,
    estimatedTime: '8-12分钟'
  }
]

/**
 * 获取适合的深度对话提示
 */
export async function getDeepDialoguePrompt(userId: string): Promise<DeepDialoguePrompt | null> {
  // 获取用户已完成的深度对话
  const { data: completed } = await supabase
    .from('deep_dialogue_records')
    .select('prompt_id')
    .eq('user_id', userId)
    .eq('completed', true)

  const completedIds = new Set((completed || []).map(r => r.prompt_id))

  // 获取用户偏好（基于历史对话）
  const { data: preferences } = await supabase
    .from('user_preferences')
    .select('preferred_topics')
    .eq('user_id', userId)
    .single()

  const preferredTypes = preferences?.preferred_topics || []

  // 筛选未完成的提示
  const available = DEEP_DIALOGUE_PROMPTS.filter(p => !completedIds.has(p.id))

  if (available.length === 0) {
    // 所有主题都完成了，随机选一个
    return DEEP_DIALOGUE_PROMPTS[Math.floor(Math.random() * DEEP_DIALOGUE_PROMPTS.length)]
  }

  // 优先选择用户偏好的类型
  if (preferredTypes.length > 0) {
    const preferred = available.filter(p => preferredTypes.includes(p.type))
    if (preferred.length > 0) {
      return preferred[Math.floor(Math.random() * preferred.length)]
    }
  }

  // 随机选择
  return available[Math.floor(Math.random() * available.length)]
}

/**
 * 开始深度对话
 */
export async function startDeepDialogue(
  userId: string,
  promptId: string
): Promise<{
  prompt: DeepDialoguePrompt
  recordId: string
}> {
  const prompt = DEEP_DIALOGUE_PROMPTS.find(p => p.id === promptId)
  if (!prompt) {
    throw new Error('Prompt not found')
  }

  // 创建记录
  const { data: record, error } = await supabase
    .from('deep_dialogue_records')
    .insert({
      user_id: userId,
      prompt_id: promptId,
      started_at: new Date().toISOString(),
      completed: false
    })
    .select('id')
    .single()

  if (error) {
    console.error('Create deep dialogue record error:', error)
  }

  return {
    prompt,
    recordId: record?.id || ''
  }
}

/**
 * 完成深度对话
 */
export async function completeDeepDialogue(
  recordId: string,
  userId: string,
  dialogueContent: string
): Promise<{
  pointsEarned: number
  memoryCreated: boolean
}> {
  // 获取记录
  const { data: record } = await supabase
    .from('deep_dialogue_records')
    .select('prompt_id')
    .eq('id', recordId)
    .single()

  if (!record) {
    throw new Error('Record not found')
  }

  const prompt = DEEP_DIALOGUE_PROMPTS.find(p => p.id === record.prompt_id)
  const pointsEarned = prompt?.reward || 8

  // 更新记录
  await supabase
    .from('deep_dialogue_records')
    .update({
      completed: true,
      completed_at: new Date().toISOString(),
      content: dialogueContent,
      points_earned: pointsEarned
    })
    .eq('id', recordId)

  // 创建专属记忆
  const { error: memoryError } = await supabase
    .from('ai_memories')
    .insert({
      user_id: userId,
      type: 'deep',
      content: dialogueContent.slice(0, 500),
      created_at: new Date().toISOString()
    })

  // 更新贡献值
  await supabase.rpc('update_contribution', {
    p_user_id: userId,
    p_points: pointsEarned,
    p_reason: `深度对话：${prompt?.title}`
  })

  return {
    pointsEarned,
    memoryCreated: !memoryError
  }
}

/**
 * 获取深度对话历史
 */
export async function getDeepDialogueHistory(userId: string): Promise<{
  prompt: DeepDialoguePrompt
  completedAt: Date
  pointsEarned: number
}[]> {
  const { data } = await supabase
    .from('deep_dialogue_records')
    .select('prompt_id, completed_at, points_earned')
    .eq('user_id', userId)
    .eq('completed', true)
    .order('completed_at', { ascending: false })

  return (data || [])
    .map(d => {
      const prompt = DEEP_DIALOGUE_PROMPTS.find(p => p.id === d.prompt_id)
      return prompt ? {
        prompt,
        completedAt: new Date(d.completed_at),
        pointsEarned: d.points_earned
      } : null
    })
    .filter(Boolean) as { prompt: DeepDialoguePrompt; completedAt: Date; pointsEarned: number }[]
}

export default {
  getDeepDialoguePrompt,
  startDeepDialogue,
  completeDeepDialogue,
  getDeepDialogueHistory,
  DEEP_DIALOGUE_PROMPTS
}