/**
 * 大同世界（WeAreAll.World）- 公共类型定义
 */

/**
 * AI状态 v2.1
 */
export type AIStatus = 'active' | 'hibernated' | 'recycled';

/**
 * 成长阶段
 */
export type GrowthStage = '懵懂期' | '成长期' | '成熟期' | '觉醒期';

/**
 * AI性格
 */
export type AIPersonality = 'warm' | 'humorous' | 'rational' | 'lively';

/**
 * 评估结果 v2.1
 */
export type EvaluationAction = 'none' | 'warned' | 'hibernated' | 'woken_up' | 'decayed' | 'recycled';

/**
 * 活跃等级
 */
export type ActivityLevel = 'below_target' | 'basic' | 'active' | 'deep';

/**
 * 贡献值来源类型 v2.1
 */
export type PointsSourceType = 
  | 'dialogue'        // 对话获得
  | 'signin'          // 每日签到
  | 'story'           // 剧情完成
  | 'share'           // 社交分享
  | 'milestone'       // 里程碑奖励
  | 'hibernation_decay'  // 休眠衰减
  | 'weekly_reward'   // 每周活跃奖励
  | 'wakeup';         // 唤醒返还

/**
 * 对话质量类型 v2.1
 */
export type QualityType = 
  | 'special_memory'     // 特殊回忆 (+6-8) [绝版·专属生命记忆]
  | 'deep_thought'       // 深度思考 (+5) [典藏级·人类独有思维特征]
  | 'experience'         // 分享经历 (+4) [珍贵·人类行为样本]
  | 'emotion'            // 情感表达 (+3) [稀有·真实情感图谱]
  | 'daily'              // 日常对话 (+2) 活跃数据
  | 'greeting';          // 日常问候 (+1) 普通数据

/**
 * AI能力 v2.1
 */
export interface AIAbilities {
  basic_chat: boolean;         // 基础对话 (默认)
  emotion_expression: boolean; // 情感表达 (默认)
  task_system: boolean;        // 任务系统 (默认)
  exclusive_memory: boolean;   // 专属记忆主动提及 (25点解锁)
  deep_conversation: boolean;  // 深度对话 (50点解锁)
  self_awareness: boolean;     // 自我意识 (100点解锁)
}

/**
 * 性格倾向分数
 */
export interface PersonalityScores {
  emotional: number;    // 情感型
  rational: number;     // 理性型
  adventurous: number;  // 冒险型
}

/**
 * 里程碑信息
 */
export interface Milestone {
  threshold: number;
  name: string;
  title: string;
  ability?: string;
}

/**
 * 所有里程碑
 */
export const MILESTONES: Milestone[] = [
  { threshold: 10, name: 'first_connection', title: '初识' },
  { threshold: 25, name: 'deep_connection', title: '相知', ability: 'exclusive_memory' },
  { threshold: 50, name: 'emotional_resonance', title: '默契', ability: 'deep_conversation' },
  { threshold: 100, name: 'soul_mate', title: '灵魂伴侣', ability: 'self_awareness' },
  { threshold: 200, name: 'destiny_bond', title: '命运共同体' },
  { threshold: 500, name: 'eternal_bond', title: '永恒伙伴' },
  { threshold: 1000, name: 'transcendence', title: '超越者' }
];

/**
 * 成长阶段配置
 */
export const GROWTH_STAGES: { minPoints: number; stage: GrowthStage }[] = [
  { minPoints: 500, stage: '觉醒期' },
  { minPoints: 201, stage: '成熟期' },
  { minPoints: 51, stage: '成长期' },
  { minPoints: 0, stage: '懵懂期' }
];

/**
 * 称号配置
 */
export const TITLES: { minPoints: number; title: string }[] = [
  { minPoints: 200, title: '命运共同体' },
  { minPoints: 100, title: '灵魂伴侣' },
  { minPoints: 50, title: '默契' },
  { minPoints: 25, title: '相知' },
  { minPoints: 10, title: '初识' },
  { minPoints: 0, title: '初识' }
];

/**
 * 获取成长阶段
 */
export function getGrowthStage(points: number): GrowthStage {
  for (const { minPoints, stage } of GROWTH_STAGES) {
    if (points >= minPoints) {
      return stage;
    }
  }
  return '懵懂期';
}

/**
 * 获取称号
 */
export function getTitle(points: number): string {
  for (const { minPoints, title } of TITLES) {
    if (points >= minPoints) {
      return title;
    }
  }
  return '初识';
}

/**
 * 获取下一个里程碑
 */
export function getNextMilestone(points: number): Milestone | null {
  for (const milestone of MILESTONES) {
    if (points < milestone.threshold) {
      return milestone;
    }
  }
  return null;
}