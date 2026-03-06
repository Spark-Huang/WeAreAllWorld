/**
 * 天下一家（WeAreAll.World）- 贡献值服务
 * 
 * 核心功能：
 * 1. 更新贡献值
 * 2. 检查里程碑
 * 3. 解锁能力
 * 4. 记录日志
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { qualityJudgeService, QualityResult } from './quality-judge.service';

export interface UpdatePointsResult {
  success: boolean;
  previousPoints: number;
  newPoints: number;
  pointsAdded: number;
  milestonesReached: Milestone[];
  abilitiesUpdated: boolean;
  growthStage: string;
  currentTitle: string;
}

export interface Milestone {
  name: string;
  points: number;
  title: string;
}

export interface AIPartnerInfo {
  userId: string;
  memoryPoints: number;
  growthStage: string;
  currentTitle: string;
  personality: string;
  status: string;
  abilities: Record<string, boolean>;
  dormantSince: string | null;
}

/**
 * 里程碑配置
 */
const MILESTONES: { threshold: number; name: string; title: string; ability: string }[] = [
  { threshold: 5, name: 'emotion_expression', title: '情感表达', ability: 'emotion_expression' },
  { threshold: 15, name: 'task_system', title: '任务系统', ability: 'task_system' },
  { threshold: 25, name: 'exclusive_memory', title: '专属记忆', ability: 'exclusive_memory' },
  { threshold: 50, name: 'deep_conversation', title: '深度对话', ability: 'deep_conversation' },
  { threshold: 100, name: 'self_awareness', title: '自我意识', ability: 'self_awareness' },
  { threshold: 200, name: 'legendary_bond', title: '传奇羁绊', ability: 'legendary_bond' }
];

/**
 * 成长阶段配置
 */
const GROWTH_STAGES: { minPoints: number; stage: string }[] = [
  { minPoints: 500, stage: '觉醒期' },
  { minPoints: 201, stage: '成熟期' },
  { minPoints: 51, stage: '成长期' },
  { minPoints: 0, stage: '懵懂期' }
];

/**
 * 称号配置
 */
const TITLES: { minPoints: number; title: string }[] = [
  { minPoints: 200, title: '命运共同体' },
  { minPoints: 100, title: '灵魂伴侣' },
  { minPoints: 50, title: '默契' },
  { minPoints: 25, title: '相知' },
  { minPoints: 10, title: '初识' },
  { minPoints: 0, title: '初识' }
];

/**
 * 贡献值服务
 */
export class MemoryPointsService {
  private supabase: SupabaseClient;
  
  constructor(supabaseUrl: string, supabaseKey: string) {
    this.supabase = createClient(supabaseUrl, supabaseKey);
  }
  
  /**
   * 处理对话并更新贡献值
   */
  async processDialogue(
    userId: string, 
    message: string, 
    conversationHistory?: string[]
  ): Promise<{
    qualityResult: QualityResult;
    updateResult: UpdatePointsResult | null;
  }> {
    // 1. 判定对话质量
    const qualityResult = qualityJudgeService.calculateQuality(message, conversationHistory);
    
    // 2. 更新贡献值
    const updateResult = await this.updatePoints(
      userId,
      qualityResult.points,
      'dialogue',
      qualityResult.reason
    );
    
    return {
      qualityResult,
      updateResult
    };
  }
  
  /**
   * 更新贡献值
   */
  async updatePoints(
    userId: string,
    points: number,
    sourceType: string,
    sourceDetail?: string
  ): Promise<UpdatePointsResult> {
    try {
      // 调用数据库函数更新点数
      const { data, error } = await this.supabase.rpc('update_contribution', {
        p_user_id: userId,
        p_points: points,
        p_category: sourceType,
        p_data_rarity: sourceDetail || null,
        p_ai_understanding: null,
        p_message_hash: null
      });
      
      if (error) {
        console.error('更新贡献值失败:', error);
        return this.createErrorResult(points);
      }
      
      const result = data as any;
      
      // 处理错误返回
      if (result?.error) {
        console.error('更新贡献值失败:', result.error);
        return this.createErrorResult(points);
      }
      
      return {
        success: true,
        previousPoints: result.previous_total || 0,
        newPoints: result.new_total || 0,
        pointsAdded: points,
        milestonesReached: this.parseMilestones(result.milestones),
        abilitiesUpdated: result.abilities_updated || false,
        growthStage: this.getGrowthStage(result.new_total || 0),
        currentTitle: this.getTitle(result.new_total || 0)
      };
    } catch (err) {
      console.error('更新贡献值异常:', err);
      return this.createErrorResult(points);
    }
  }
  
  /**
   * 处理每日签到
   */
  async processDailyCheckin(userId: string): Promise<{
    success: boolean;
    streakCount: number;
    baseReward: number;
    streakBonus: number;
    totalReward: number;
    updateResult: UpdatePointsResult | null;
    message: string;
  }> {
    try {
      const { data, error } = await this.supabase.rpc('process_daily_checkin', {
        p_user_id: userId
      });
      
      if (error) {
        console.error('签到失败:', error);
        return {
          success: false,
          streakCount: 0,
          baseReward: 0,
          streakBonus: 0,
          totalReward: 0,
          updateResult: null,
          message: '签到失败，请稍后重试'
        };
      }
      
      const result = data as any;
      
      if (!result.success) {
        return {
          success: false,
          streakCount: 0,
          baseReward: 0,
          streakBonus: 0,
          totalReward: 0,
          updateResult: null,
          message: result.message
        };
      }
      
      return {
        success: true,
        streakCount: result.streak_count,
        baseReward: result.base_reward,
        streakBonus: result.streak_bonus,
        totalReward: result.total_reward,
        updateResult: result.memory_points ? {
          success: true,
          previousPoints: result.memory_points.previous_points,
          newPoints: result.memory_points.new_points,
          pointsAdded: result.memory_points.points_added,
          milestonesReached: this.parseMilestones(result.memory_points.milestones_reached),
          abilitiesUpdated: result.memory_points.abilities_updated,
          growthStage: this.getGrowthStage(result.memory_points.new_points),
          currentTitle: this.getTitle(result.memory_points.new_points)
        } : null,
        message: `签到成功！连续签到${result.streak_count}天，获得+${result.total_reward}点贡献值`
      };
    } catch (err) {
      console.error('签到异常:', err);
      return {
        success: false,
        streakCount: 0,
        baseReward: 0,
        streakBonus: 0,
        totalReward: 0,
        updateResult: null,
        message: '签到失败，请稍后重试'
      };
    }
  }
  
  /**
   * 获取AI伙伴信息
   */
  async getAIPartnerInfo(userId: string): Promise<AIPartnerInfo | null> {
    const { data, error } = await this.supabase
      .from('ai_partners')
      .select('*')
      .eq('user_id', userId)
      .single();
    
    if (error) {
      console.error('获取AI伙伴信息失败:', error);
      return null;
    }
    
    return {
      userId: data.user_id,
      memoryPoints: data.memory_points,
      growthStage: data.growth_stage,
      currentTitle: data.current_title,
      personality: data.personality,
      status: data.status,
      abilities: data.abilities,
      dormantSince: data.dormant_since
    };
  }
  
  /**
   * 获取贡献值日志
   */
  async getPointsLog(userId: string, limit: number = 20): Promise<{
    id: string;
    points: number;
    sourceType: string;
    sourceDetail: string | null;
    createdAt: string;
  }[]> {
    const { data, error } = await this.supabase
      .from('memory_points_log')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);
    
    if (error) {
      console.error('获取贡献值日志失败:', error);
      return [];
    }
    
    return (data || []).map(log => ({
      id: log.id,
      points: log.points,
      sourceType: log.source_type,
      sourceDetail: log.source_detail,
      createdAt: log.created_at
    }));
  }
  
  /**
   * 获取里程碑列表
   */
  getMilestones(): typeof MILESTONES {
    return MILESTONES;
  }
  
  /**
   * 获取下一个里程碑
   */
  getNextMilestone(currentPoints: number): { threshold: number; name: string; title: string; pointsNeeded: number } | null {
    for (const milestone of MILESTONES) {
      if (currentPoints < milestone.threshold) {
        return {
          ...milestone,
          pointsNeeded: milestone.threshold - currentPoints
        };
      }
    }
    return null;
  }
  
  /**
   * 解析里程碑数组
   */
  private parseMilestones(milestonesJson: any): Milestone[] {
    if (!milestonesJson || !Array.isArray(milestonesJson)) {
      return [];
    }
    
    return milestonesJson.map((m: any) => ({
      name: m.name,
      points: m.points,
      title: m.title || m.name
    }));
  }
  
  /**
   * 获取成长阶段
   */
  private getGrowthStage(points: number): string {
    for (const stage of GROWTH_STAGES) {
      if (points >= stage.minPoints) {
        return stage.stage;
      }
    }
    return '懵懂期';
  }
  
  /**
   * 获取称号
   */
  private getTitle(points: number): string {
    for (const title of TITLES) {
      if (points >= title.minPoints) {
        return title.title;
      }
    }
    return '初识';
  }
  
  /**
   * 创建错误结果
   */
  private createErrorResult(points: number): UpdatePointsResult {
    return {
      success: false,
      previousPoints: 0,
      newPoints: 0,
      pointsAdded: points,
      milestonesReached: [],
      abilitiesUpdated: false,
      growthStage: '懵懂期',
      currentTitle: '初识'
    };
  }
}