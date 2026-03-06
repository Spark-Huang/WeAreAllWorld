/**
 * 共生世界（WeAreAll.World）- 中央系统评估服务
 * 
 * 核心功能：
 * 1. 每周评估 - 检查用户活跃度，决定AI状态
 * 2. 休眠机制 - 不活跃AI进入休眠状态
 * 3. 点数衰减 - 休眠AI每天损失点数
 * 4. 唤醒机制 - 用户可以唤醒休眠的AI
 * 
 * 评估规则：
 * - 每周需获得 >= 15 点贡献值
 * - 连续两周不通过 → AI进入休眠
 * - 休眠期间每天 -2 点
 * - 点数归零后AI被回收（数据保留）
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

export interface EvaluationResult {
  success: boolean;
  userId: string;
  weekStart: string;
  weekEnd: string;
  achievedContribution: number;
  requiredContribution: number;
  passed: boolean;
  actionTaken: 'none' | 'warned' | 'hibernated' | 'woken_up' | 'decayed' | 'recycled';
  violationCount: number;
  statusBefore: string;
  statusAfter: string;
  message: string;
}

export interface DecayResult {
  success: boolean;
  userId: string;
  previousPower: number;
  newPower: number;
  decayAmount: number;
  reachedZero: boolean;
  status: 'hibernated' | 'recycled';
}

export interface WakeupResult {
  success: boolean;
  userId: string;
  daysHibernated: number;
  powerLost: number;
  powerReturned: number;
  newPower: number;
  usedFreeWakeup: boolean;
  message: string;
}

export interface WeeklyStats {
  weekStart: string;
  weeklyContribution: number;
  dialogueCount: number;
  signinCount: number;
  requiredContribution: number;
  progressPercent: number;
  activityLevel: 'below_target' | 'basic' | 'active' | 'deep';
}

/**
 * 中央系统评估服务
 */
export class CentralEvaluationService {
  private supabase: SupabaseClient;
  private readonly THRESHOLD = 15;  // 每周最低点数要求
  private readonly DECAY_AMOUNT = 2;  // 每天衰减点数
  
  constructor(supabaseUrl: string, supabaseKey: string) {
    this.supabase = createClient(supabaseUrl, supabaseKey);
  }
  
  /**
   * 执行单个用户的每周评估
   */
  async evaluateUser(userId: string): Promise<EvaluationResult> {
    try {
      // 调用数据库函数执行评估
      const { data, error } = await this.supabase.rpc('run_weekly_evaluation', {
        p_user_id: userId
      });
      
      if (error) {
        console.error(`评估用户 ${userId} 失败:`, error);
        return this.createErrorResult(userId, error.message);
      }
      
      const result = data as any;
      
      return {
        success: true,
        userId,
        weekStart: result.week_start,
        weekEnd: result.week_end,
        achievedContribution: result.achieved_power,
        requiredContribution: result.required_power,
        passed: result.passed,
        actionTaken: result.action_taken,
        violationCount: result.violation_count,
        statusBefore: result.status_before,
        statusAfter: result.status_after,
        message: this.generateEvaluationMessage(result)
      };
    } catch (err) {
      console.error(`评估用户 ${userId} 异常:`, err);
      return this.createErrorResult(userId, (err as Error).message);
    }
  }
  
  /**
   * 执行所有用户的每周评估
   */
  async evaluateAllUsers(): Promise<{
    total: number;
    passed: number;
    warned: number;
    hibernated: number;
    errors: number;
    results: EvaluationResult[];
  }> {
    console.log('开始执行每周评估...');
    
    // 获取所有用户
    const { data: users, error } = await this.supabase
      .from('users')
      .select('id');
    
    if (error) {
      console.error('获取用户列表失败:', error);
      throw error;
    }
    
    const results: EvaluationResult[] = [];
    let passed = 0;
    let warned = 0;
    let hibernated = 0;
    let errors = 0;
    
    // 为每个用户执行评估
    for (const user of users || []) {
      const result = await this.evaluateUser(user.id);
      results.push(result);
      
      if (result.success) {
        if (result.passed) passed++;
        else if (result.actionTaken === 'warned') warned++;
        else if (result.actionTaken === 'hibernated') hibernated++;
      } else {
        errors++;
      }
    }
    
    console.log(`每周评估完成: 通过=${passed}, 警告=${warned}, 休眠=${hibernated}, 错误=${errors}`);
    
    return {
      total: users?.length || 0,
      passed,
      warned,
      hibernated,
      errors,
      results
    };
  }
  
  /**
   * 执行单个休眠AI的点数衰减
   */
  async decayHibernatedAI(userId: string): Promise<DecayResult> {
    try {
      const { data, error } = await this.supabase.rpc('run_hibernation_decay', {
        p_user_id: userId
      });
      
      if (error) {
        console.error(`衰减用户 ${userId} 失败:`, error);
        return {
          success: false,
          userId,
          previousPower: 0,
          newPower: 0,
          decayAmount: 0,
          reachedZero: false,
          status: 'hibernated'
        };
      }
      
      const result = data as any;
      
      return {
        success: result.success,
        userId,
        previousPower: result.previous_power,
        newPower: result.new_power,
        decayAmount: result.decay_amount,
        reachedZero: result.reached_zero,
        status: result.status
      };
    } catch (err) {
      console.error(`衰减用户 ${userId} 异常:`, err);
      return {
        success: false,
        userId,
        previousPower: 0,
        newPower: 0,
        decayAmount: 0,
        reachedZero: false,
        status: 'hibernated'
      };
    }
  }
  
  /**
   * 执行所有休眠AI的点数衰减
   */
  async decayAllDormantAIs(): Promise<{
    total: number;
    success: number;
    reachedZero: number;
    errors: number;
    results: DecayResult[];
  }> {
    console.log('开始执行休眠衰减...');
    
    // 获取所有休眠中的AI
    const { data: dormantAIs, error } = await this.supabase
      .from('ai_partners')
      .select('user_id, dormant_since')
      .eq('status', 'dormant');
    
    if (error) {
      console.error('获取休眠AI列表失败:', error);
      throw error;
    }
    
    const results: DecayResult[] = [];
    let success = 0;
    let reachedZero = 0;
    let errors = 0;
    
    for (const ai of dormantAIs || []) {
      const result = await this.decayDormantAI(ai.user_id);
      results.push(result);
      
      if (result.success) {
        success++;
        if (result.reachedZero) reachedZero++;
      } else {
        errors++;
      }
    }
    
    console.log(`休眠衰减完成: 成功=${success}, 归零=${reachedZero}, 错误=${errors}`);
    
    return {
      total: dormantAIs?.length || 0,
      success,
      reachedZero,
      errors,
      results
    };
  }
  
  /**
   * 唤醒休眠的AI
   */
  async wakeupAI(userId: string): Promise<WakeupResult> {
    try {
      const { data, error } = await this.supabase.rpc('wakeup_ai', {
        p_user_id: userId
      });
      
      if (error) {
        console.error(`唤醒用户 ${userId} 失败:`, error);
        return {
          success: false,
          userId,
          daysDormant: 0,
          pointsLost: 0,
          pointsReturned: 0,
          newPoints: 0,
          message: '唤醒失败，请稍后重试'
        };
      }
      
      const result = data as any;
      
      return {
        success: result.success,
        userId,
        daysDormant: result.days_dormant,
        pointsLost: result.points_lost,
        pointsReturned: result.points_returned,
        newPoints: result.new_points,
        message: result.success 
          ? `AI已唤醒！休眠${result.days_dormant}天，返还${result.points_returned}点贡献值`
          : 'AI未处于休眠状态'
      };
    } catch (err) {
      console.error(`唤醒用户 ${userId} 异常:`, err);
      return {
        success: false,
        userId,
        daysDormant: 0,
        pointsLost: 0,
        pointsReturned: 0,
        newPoints: 0,
        message: '唤醒失败，请稍后重试'
      };
    }
  }
  
  /**
   * 获取用户本周统计
   */
  async getWeeklyStats(userId: string): Promise<WeeklyStats> {
    const { data, error } = await this.supabase.rpc('get_weekly_stats', {
      p_user_id: userId
    });
    
    if (error) {
      console.error('获取本周统计失败:', error);
      throw error;
    }
    
    const result = data as any;
    
    // 计算距离下次评估还有多少天
    const { data: user } = await this.supabase
      .from('users')
      .select('registered_at')
      .eq('id', userId)
      .single();
    
    let daysRemaining = 7;
    if (user?.registered_at) {
      const registeredDate = new Date(user.registered_at);
      const today = new Date();
      const daysSinceRegistration = Math.floor((today.getTime() - registeredDate.getTime()) / (1000 * 60 * 60 * 24));
      daysRemaining = 7 - (daysSinceRegistration % 7);
    }
    
    return {
      weekStart: result.week_start,
      pointsGrown: result.points_grown,
      dialogueCount: result.dialogue_count,
      signinCount: result.signin_count,
      threshold: result.threshold,
      progressPercent: result.progress_percent,
      daysRemaining
    };
  }
  
  /**
   * 检查用户AI是否处于休眠状态
   */
  async isAIDormant(userId: string): Promise<boolean> {
    const { data, error } = await this.supabase
      .from('ai_partners')
      .select('status')
      .eq('user_id', userId)
      .single();
    
    if (error) {
      console.error('检查AI状态失败:', error);
      return false;
    }
    
    return data?.status === 'dormant';
  }
  
  /**
   * 获取所有休眠中的AI列表
   */
  async getDormantAIs(): Promise<{
    userId: string;
    dormantSince: string;
    memoryPoints: number;
    daysDormant: number;
  }[]> {
    const { data, error } = await this.supabase
      .from('ai_partners')
      .select('user_id, dormant_since, memory_points')
      .eq('status', 'dormant');
    
    if (error) {
      console.error('获取休眠AI列表失败:', error);
      return [];
    }
    
    return (data || []).map(ai => ({
      userId: ai.user_id,
      dormantSince: ai.dormant_since,
      memoryPoints: ai.memory_points,
      daysDormant: Math.floor((Date.now() - new Date(ai.dormant_since).getTime()) / (1000 * 60 * 60 * 24))
    }));
  }
  
  /**
   * 生成评估消息
   */
  private generateEvaluationMessage(result: any): string {
    switch (result.result) {
      case 'pass':
        return `本周评估通过！获得${result.points_grown}点贡献值，继续保持！`;
      case 'warning':
        return `本周评估警告：仅获得${result.points_grown}点贡献值，需要${result.threshold}点。请多与AI互动！`;
      case 'dormant':
        return `连续两周未达标，AI已进入休眠状态。请尽快互动以唤醒AI！`;
      default:
        return '评估完成';
    }
  }
  
  /**
   * 创建错误结果
   */
  private createErrorResult(userId: string, errorMessage: string): EvaluationResult {
    return {
      success: false,
      userId,
      weekStart: '',
      weekEnd: '',
      pointsGrown: 0,
      threshold: this.THRESHOLD,
      result: 'warning',
      consecutiveWarnings: 0,
      statusBefore: '',
      statusAfter: '',
      message: `评估失败: ${errorMessage}`
    };
  }
}