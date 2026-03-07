/**
 * 天下一家（WeAreAll.World）- 异步质量评估服务
 * 
 * 功能：
 * 1. 每15分钟批量评估对话质量
 * 2. 使用 LLM 智能判断
 * 3. 记录评估结果，补偿贡献值差异
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { llmQualityJudgeService } from './llm-quality-judge.service';

export interface DialogueSession {
  id: string;
  userId: string;
  startedAt: string;
  endedAt: string | null;
  messageCount: number;
  totalQuickPoints: number;
  totalLlmPoints: number;
  llmEvaluated: boolean;
}

export interface AsyncEvaluationResult {
  sessionId: string;
  userId: string;
  messageCount: number;
  totalQuickPoints: number;
  totalLlmPoints: number;
  pointsDiff: number;
  evaluatedAt: string;
}

/**
 * 异步质量评估服务
 */
export class AsyncQualityEvaluationService {
  private supabase: SupabaseClient;
  private isRunning: boolean = false;
  private intervalId: NodeJS.Timeout | null = null;
  private sessionCheckIntervalId: NodeJS.Timeout | null = null;
  
  // 评估间隔（毫秒）
  private readonly EVALUATION_INTERVAL = 15 * 60 * 1000; // 15分钟
  // 会话超时时间（毫秒）
  private readonly SESSION_TIMEOUT = 5 * 60 * 1000; // 5分钟
  
  constructor(supabaseUrl: string, supabaseKey: string) {
    this.supabase = createClient(supabaseUrl, supabaseKey);
  }
  
  /**
   * 启动定时评估任务
   */
  start(): void {
    if (this.isRunning) {
      console.log('异步质量评估服务已在运行');
      return;
    }
    
    this.isRunning = true;
    console.log(`🚀 异步质量评估服务已启动，间隔: ${this.EVALUATION_INTERVAL / 60000} 分钟`);
    
    // 立即执行一次（检查超时会话 + 评估）
    this.checkAndEndTimeoutSessions().catch(err => {
      console.error('检查超时会话失败:', err);
    });
    this.runEvaluation().catch(err => {
      console.error('初始评估失败:', err);
    });
    
    // 设置定时任务（每15分钟评估）
    this.intervalId = setInterval(() => {
      this.runEvaluation().catch(err => {
        console.error('定时评估失败:', err);
      });
    }, this.EVALUATION_INTERVAL);
    
    // 设置会话检查任务（每1分钟检查超时会话）
    this.sessionCheckIntervalId = setInterval(() => {
      this.checkAndEndTimeoutSessions().catch(err => {
        console.error('检查超时会话失败:', err);
      });
    }, 60000); // 1分钟
  }
  
  /**
   * 停止定时评估任务
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    if (this.sessionCheckIntervalId) {
      clearInterval(this.sessionCheckIntervalId);
      this.sessionCheckIntervalId = null;
    }
    this.isRunning = false;
    console.log('⏹️ 异步质量评估服务已停止');
  }
  
  /**
   * 检查并结束超时会话
   */
  async checkAndEndTimeoutSessions(): Promise<number> {
    const timeoutThreshold = new Date(Date.now() - this.SESSION_TIMEOUT).toISOString();
    
    // 查找超时的会话（started_at 超过5分钟且未结束）
    const { data: timeoutSessions, error } = await this.supabase
      .from('dialogue_sessions')
      .select('id, user_id')
      .is('ended_at', null)
      .lt('started_at', timeoutThreshold);
    
    if (error) {
      console.error('查询超时会话失败:', error);
      return 0;
    }
    
    if (!timeoutSessions || timeoutSessions.length === 0) {
      return 0;
    }
    
    console.log(`发现 ${timeoutSessions.length} 个超时会话，正在结束...`);
    
    // 结束每个超时会话
    for (const session of timeoutSessions) {
      await this.endSession(session.id);
    }
    
    return timeoutSessions.length;
  }
  
  /**
   * 执行一次评估
   */
  async runEvaluation(): Promise<AsyncEvaluationResult[]> {
    console.log('📊 开始异步质量评估...');
    
    try {
      // 1. 获取待评估的会话
      const pendingSessions = await this.getPendingSessions();
      
      if (pendingSessions.length === 0) {
        console.log('没有待评估的会话');
        return [];
      }
      
      console.log(`发现 ${pendingSessions.length} 个待评估会话`);
      
      // 2. 逐个评估
      const results: AsyncEvaluationResult[] = [];
      
      for (const session of pendingSessions) {
        try {
          const result = await this.evaluateSession(session);
          results.push(result);
          
          // 避免请求过快
          await this.sleep(1500);
        } catch (err) {
          console.error(`评估会话 ${session.id} 失败:`, err);
        }
      }
      
      console.log(`✅ 完成评估 ${results.length} 个会话`);
      return results;
    } catch (err) {
      console.error('异步评估失败:', err);
      throw err;
    }
  }
  
  /**
   * 获取待评估的会话
   */
  private async getPendingSessions(): Promise<DialogueSession[]> {
    // 获取已结束但未评估的会话
    const { data: sessions, error } = await this.supabase
      .from('dialogue_sessions')
      .select('*')
      .not('ended_at', 'is', null)
      .eq('llm_evaluated', false)
      .order('ended_at', { ascending: true })
      .limit(10);
    
    if (error) {
      console.error('获取待评估会话失败:', error);
      return [];
    }
    
    return sessions || [];
  }
  
  /**
   * 评估单个会话
   */
  private async evaluateSession(session: DialogueSession): Promise<AsyncEvaluationResult> {
    console.log(`评估会话 ${session.id}，用户 ${session.userId}，消息数 ${session.messageCount}`);
    
    // 1. 获取会话中的所有消息
    const { data: logs, error } = await this.supabase
      .from('interaction_logs')
      .select('*')
      .eq('session_id', session.id)
      .order('created_at', { ascending: true });
    
    if (error || !logs || logs.length === 0) {
      throw new Error(`获取会话消息失败: ${error?.message || '无消息'}`);
    }
    
    // 2. 使用 LLM 批量评估
    let totalLlmPoints = 0;
    
    for (const log of logs) {
      try {
        const rawMessage = log.raw_message || log.ai_understanding?.userMessage || '';
        
        if (!rawMessage) continue;
        
        // 调用 LLM 评估
        const llmResult = await llmQualityJudgeService.calculateQuality(rawMessage);
        
        // 更新单条记录
        await this.supabase
          .from('interaction_logs')
          .update({
            llm_evaluated: true,
            llm_quality_type: llmResult.qualityType,
            llm_points: llmResult.points,
            llm_evaluated_at: new Date().toISOString()
          })
          .eq('id', log.id);
        
        totalLlmPoints += llmResult.points;
        
        // 避免请求过快
        await this.sleep(1500);
      } catch (err) {
        console.error(`评估消息 ${log.id} 失败:`, err);
      }
    }
    
    // 3. 计算差异并补偿
    const pointsDiff = totalLlmPoints - session.totalQuickPoints;
    
    if (pointsDiff > 0) {
      // LLM 判定更高，补偿差异
      console.log(`补偿用户 ${session.userId} 点数: +${pointsDiff}`);
      
      await this.supabase.rpc('update_contribution', {
        p_user_id: session.userId,
        p_points: pointsDiff,
        p_category: 'llm_adjustment',
        p_data_rarity: 'LLM异步评估补偿',
        p_ai_understanding: {
          sessionId: session.id,
          quickPoints: session.totalQuickPoints,
          llmPoints: totalLlmPoints,
          diff: pointsDiff
        },
        p_message_hash: null
      });
    }
    
    // 4. 更新会话状态
    await this.supabase
      .from('dialogue_sessions')
      .update({
        llm_evaluated: true,
        llm_evaluated_at: new Date().toISOString(),
        total_llm_points: totalLlmPoints
      })
      .eq('id', session.id);
    
    return {
      sessionId: session.id,
      userId: session.userId,
      messageCount: session.messageCount,
      totalQuickPoints: session.totalQuickPoints,
      totalLlmPoints: totalLlmPoints,
      pointsDiff,
      evaluatedAt: new Date().toISOString()
    };
  }
  
  /**
   * 创建新会话
   */
  async createSession(userId: string): Promise<string> {
    const { data, error } = await this.supabase
      .from('dialogue_sessions')
      .insert({
        user_id: userId,
        started_at: new Date().toISOString()
      })
      .select('id')
      .single();
    
    if (error) {
      console.error('创建会话失败:', error);
      throw error;
    }
    
    return data.id;
  }
  
  /**
   * 结束会话
   */
  async endSession(sessionId: string): Promise<void> {
    // 1. 更新会话结束时间
    const { error: updateError } = await this.supabase
      .from('dialogue_sessions')
      .update({
        ended_at: new Date().toISOString()
      })
      .eq('id', sessionId);
    
    if (updateError) {
      console.error('结束会话失败:', updateError);
      return;
    }
    
    // 2. 计算会话统计
    const { data: logs } = await this.supabase
      .from('interaction_logs')
      .select('quick_points')
      .eq('session_id', sessionId);
    
    const messageCount = logs?.length || 0;
    const totalQuickPoints = logs?.reduce((sum, log) => sum + (log.quick_points || 0), 0) || 0;
    
    // 3. 更新会话统计
    await this.supabase
      .from('dialogue_sessions')
      .update({
        message_count: messageCount,
        total_quick_points: totalQuickPoints
      })
      .eq('id', sessionId);
    
    // 4. 创建异步评估任务（15分钟后执行）
    await this.supabase
      .from('async_evaluation_queue')
      .insert({
        user_id: (await this.supabase
          .from('dialogue_sessions')
          .select('user_id')
          .eq('id', sessionId)
          .single()).data?.user_id,
        session_id: sessionId,
        scheduled_at: new Date(Date.now() + this.EVALUATION_INTERVAL).toISOString()
      });
    
    console.log(`会话 ${sessionId} 已结束，消息数: ${messageCount}，快速点数: ${totalQuickPoints}`);
  }
  
  /**
   * 获取用户当前活跃会话
   */
  async getActiveSession(userId: string): Promise<string | null> {
    const { data } = await this.supabase
      .from('dialogue_sessions')
      .select('id')
      .eq('user_id', userId)
      .is('ended_at', null)
      .order('started_at', { ascending: false })
      .limit(1)
      .single();
    
    return data?.id || null;
  }
  
  /**
   * 辅助函数：休眠
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// 导出单例
export const asyncQualityEvaluationService = new AsyncQualityEvaluationService(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY!
);