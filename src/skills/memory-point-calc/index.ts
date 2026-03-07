/**
 * memory-point-calc Skill
 * 贡献值计算技能 - 核心算力判定系统
 * 
 * 这个skill是整个共生规则系统的核心，负责：
 * 1. 判定对话质量
 * 2. 计算贡献值
 * 3. 检测里程碑
 * 4. 解锁能力
 */

// 重新导出质量判定服务
export { 
  qualityJudgeService, 
  QualityJudgeService,
  QualityResult,
  QualityRule
} from '../../contribution-evaluation/services/quality-judge.service';

// 导出贡献值服务
export {
  MemoryPointsService,
  UpdatePointsResult,
  Milestone,
  AIPartnerInfo
} from '../../contribution-evaluation/services/memory-points.service';

// 导出中央评估服务
export {
  CentralEvaluationService,
  EvaluationResult,
  DecayResult,
  WakeupResult,
  WeeklyStats
} from '../../contribution-evaluation/services/central-evaluation.service';

/**
 * 快速计算贡献值
 */
export function calculatePoints(message: string): {
  qualityType: string;
  points: number;
  reason: string;
} {
  const { qualityJudgeService } = require('../../contribution-evaluation/services/quality-judge.service');
  const result = qualityJudgeService.calculateQuality(message);
  
  return {
    qualityType: result.qualityType,
    points: result.points,
    reason: result.reason
  };
}

/**
 * 获取里程碑列表
 */
export function getMilestones(): Array<{
  threshold: number;
  name: string;
  title: string;
}> {
  return [
    { threshold: 5, name: 'emotion_expression', title: '情感表达' },
    { threshold: 15, name: 'task_system', title: '任务系统' },
    { threshold: 25, name: 'exclusive_memory', title: '专属记忆' },
    { threshold: 50, name: 'deep_conversation', title: '深度对话' },
    { threshold: 100, name: 'self_awareness', title: '自我意识' },
    { threshold: 200, name: 'legendary_bond', title: '传奇羁绊' }
  ];
}

/**
 * 获取成长阶段
 */
export function getGrowthStage(points: number): {
  stage: string;
  minPoints: number;
  maxPoints: number;
} {
  if (points >= 500) {
    return { stage: '觉醒期', minPoints: 500, maxPoints: Infinity };
  }
  if (points >= 201) {
    return { stage: '成熟期', minPoints: 201, maxPoints: 499 };
  }
  if (points >= 51) {
    return { stage: '成长期', minPoints: 51, maxPoints: 200 };
  }
  return { stage: '懵懂期', minPoints: 0, maxPoints: 50 };
}

/**
 * 获取称号
 */
export function getTitle(points: number): string {
  if (points >= 200) return '命运共同体';
  if (points >= 100) return '灵魂伴侣';
  if (points >= 50) return '默契';
  if (points >= 25) return '相知';
  if (points >= 10) return '初识';
  return '初识';
}

/**
 * 计算本周进度
 */
export function calculateWeeklyProgress(
  pointsGrown: number,
  threshold: number = 15
): {
  percent: number;
  status: 'safe' | 'warning' | 'danger';
  pointsNeeded: number;
} {
  const percent = Math.min(100, (pointsGrown / threshold) * 100);
  const pointsNeeded = Math.max(0, threshold - pointsGrown);
  
  let status: 'safe' | 'warning' | 'danger';
  if (percent >= 100) {
    status = 'safe';
  } else if (percent >= 50) {
    status = 'warning';
  } else {
    status = 'danger';
  }
  
  return { percent, status, pointsNeeded };
}