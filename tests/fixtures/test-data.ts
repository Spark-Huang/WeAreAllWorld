/**
 * 测试数据 fixtures
 */

export const TEST_DIALOGUES = [
  {
    message: '你好！很高兴认识你！',
    expectedQuality: 'greeting',
    minPoints: 1,
  },
  {
    message: '今天天气真好，我想和你聊聊我的心情。',
    expectedQuality: 'emotion',
    minPoints: 2,
  },
  {
    message: '我在思考人生的意义，你能给我一些建议吗？',
    expectedQuality: 'deep_thinking',
    minPoints: 5,
  },
  {
    message: '这是我第一次和你聊天，感觉非常特别！',
    expectedQuality: 'special_memory',
    minPoints: 10,
  },
];

export const TEST_MILESTONES = [
  { contribution: 0, reward: 'AI苏醒', unlocked: true },
  { contribution: 25, reward: '基础对话', unlocked: false },
  { contribution: 50, reward: '情感理解', unlocked: false },
  { contribution: 100, reward: '深度思考', unlocked: false },
  { contribution: 200, reward: '灵魂共鸣', unlocked: false },
];

export const TEST_STORY_CHAPTERS = [
  { id: 0, name: '序章', requiredContribution: 0 },
  { id: 1, name: '初遇', requiredContribution: 0 },
  { id: 2, name: '相知', requiredContribution: 25 },
  { id: 3, name: '默契', requiredContribution: 50 },
  { id: 4, name: '灵魂伴侣', requiredContribution: 100 },
  { id: 5, name: '命运共同体', requiredContribution: 200 },
];
