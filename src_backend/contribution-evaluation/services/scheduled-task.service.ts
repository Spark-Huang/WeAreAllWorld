/**
 * 大同世界（WeAreAll.World）- 定时任务服务
 * 
 * 定时任务：
 * 1. 每周评估 - 每周一凌晨执行
 * 2. 休眠衰减 - 每天凌晨执行
 * 3. 状态通知 - 状态变化时通知用户
 */

import { CentralEvaluationService } from './central-evaluation.service';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import * as cron from 'node-cron';

export interface TaskResult {
  taskName: string;
  executedAt: Date;
  success: boolean;
  affected: number;
  details: any;
}

export interface NotificationPayload {
  telegramUserId: number;
  message: string;
  type: 'warning' | 'dormant' | 'wakeup' | 'milestone' | 'decay';
}

/**
 * 定时任务服务
 */
export class ScheduledTaskService {
  private centralEvaluation: CentralEvaluationService;
  private supabase: SupabaseClient;
  private notificationCallback?: (payload: NotificationPayload) => Promise<void>;
  
  constructor(
    supabaseUrl: string,
    supabaseKey: string,
    notificationCallback?: (payload: NotificationPayload) => Promise<void>
  ) {
    this.supabase = createClient(supabaseUrl, supabaseKey);
    this.centralEvaluation = new CentralEvaluationService(supabaseUrl, supabaseKey);
    this.notificationCallback = notificationCallback;
  }
  
  /**
   * 启动所有定时任务
   */
  startAllTasks(): void {
    console.log('启动定时任务...');
    
    // 每周评估 - 每周一凌晨2点执行
    this.startWeeklyEvaluation();
    
    // 休眠衰减 - 每天凌晨3点执行
    this.startDormantDecay();
    
    // 状态检查 - 每小时检查一次
    this.startStatusCheck();
    
    console.log('所有定时任务已启动');
  }
  
  /**
   * 每周评估任务
   * 每周一凌晨2点执行
   */
  startWeeklyEvaluation(): cron.ScheduledTask {
    const task = cron.schedule('0 2 * * 1', async () => {
      console.log('开始执行每周评估任务...');
      const startTime = Date.now();
      
      try {
        const result = await this.centralEvaluation.evaluateAllUsers();
        
        // 发送通知
        for (const evalResult of result.results) {
          if (evalResult.success && !evalResult.passed) {
            await this.sendNotification({
              telegramUserId: await this.getTelegramUserId(evalResult.userId),
              message: evalResult.message,
              type: evalResult.actionTaken === 'hibernated' ? 'dormant' : 'warning'
            });
          }
        }
        
        console.log(`每周评估完成，耗时: ${Date.now() - startTime}ms`);
      } catch (err) {
        console.error('每周评估任务失败:', err);
      }
    }, {
      timezone: 'Asia/Shanghai'
    });
    
    return task;
  }
  
  /**
   * 休眠衰减任务
   * 每天凌晨3点执行
   */
  startDormantDecay(): cron.ScheduledTask {
    const task = cron.schedule('0 3 * * *', async () => {
      console.log('开始执行休眠衰减任务...');
      const startTime = Date.now();
      
      try {
        const result = await this.centralEvaluation.decayAllDormantAIs();
        
        // 通知点数归零的用户
        for (const decayResult of result.results) {
          if (decayResult.reachedZero) {
            await this.sendNotification({
              telegramUserId: await this.getTelegramUserId(decayResult.userId),
              message: '⚠️ 你的AI伙伴因长期未互动，贡献值已归零。请尽快互动以恢复AI！',
              type: 'decay'
            });
          }
        }
        
        console.log(`休眠衰减完成，耗时: ${Date.now() - startTime}ms`);
      } catch (err) {
        console.error('休眠衰减任务失败:', err);
      }
    }, {
      timezone: 'Asia/Shanghai'
    });
    
    return task;
  }
  
  /**
   * 状态检查任务
   * 每小时执行一次，检查是否有需要通知的状态变化
   */
  startStatusCheck(): cron.ScheduledTask {
    const task = cron.schedule('0 * * * *', async () => {
      // 检查即将进入休眠的用户（连续警告1次）
      const { data: warnedUsers, error } = await this.supabase
        .from('ai_partners')
        .select('user_id, consecutive_warnings')
        .eq('consecutive_warnings', 1)
        .neq('status', 'dormant');
      
      if (!error && warnedUsers) {
        for (const user of warnedUsers) {
          const stats = await this.centralEvaluation.getWeeklyStats(user.user_id);
          
          // 如果进度低于50%，发送提醒
          if (stats.progressPercent < 50) {
            await this.sendNotification({
              telegramUserId: await this.getTelegramUserId(user.user_id),
              message: `⚠️ 本周贡献值进度仅${Math.round(stats.progressPercent)}%！请多与AI互动！`,
              type: 'warning'
            });
          }
        }
      }
    }, {
      timezone: 'Asia/Shanghai'
    });
    
    return task;
  }
  
  /**
   * 手动执行每周评估
   */
  async runWeeklyEvaluationNow(): Promise<TaskResult> {
    const startTime = Date.now();
    
    try {
      const result = await this.centralEvaluation.evaluateAllUsers();
      
      return {
        taskName: 'weekly_evaluation',
        executedAt: new Date(),
        success: true,
        affected: result.total,
        details: result
      };
    } catch (err) {
      return {
        taskName: 'weekly_evaluation',
        executedAt: new Date(),
        success: false,
        affected: 0,
        details: { error: (err as Error).message }
      };
    }
  }
  
  /**
   * 手动执行休眠衰减
   */
  async runDormantDecayNow(): Promise<TaskResult> {
    const startTime = Date.now();
    
    try {
      const result = await this.centralEvaluation.decayAllDormantAIs();
      
      return {
        taskName: 'dormant_decay',
        executedAt: new Date(),
        success: true,
        affected: result.total,
        details: result
      };
    } catch (err) {
      return {
        taskName: 'dormant_decay',
        executedAt: new Date(),
        success: false,
        affected: 0,
        details: { error: (err as Error).message }
      };
    }
  }
  
  /**
   * 获取任务状态
   */
  async getTaskStatus(): Promise<{
    lastWeeklyEvaluation: Date | null;
    lastDormantDecay: Date | null;
    dormantAICount: number;
    warningUserCount: number;
  }> {
    // 获取最后一次评估时间
    const { data: lastEval } = await this.supabase
      .from('weekly_evaluations')
      .select('evaluated_at')
      .order('evaluated_at', { ascending: false })
      .limit(1)
      .single();
    
    // 获取最后一次衰减时间
    const { data: lastDecay } = await this.supabase
      .from('memory_points_log')
      .select('created_at')
      .eq('source_type', 'dormant_decay')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    
    // 获取休眠AI数量
    const { count: dormantCount } = await this.supabase
      .from('ai_partners')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'dormant');
    
    // 获取警告用户数量
    const { count: warningCount } = await this.supabase
      .from('ai_partners')
      .select('*', { count: 'exact', head: true })
      .eq('consecutive_warnings', 1)
      .neq('status', 'dormant');
    
    return {
      lastWeeklyEvaluation: lastEval?.evaluated_at ? new Date(lastEval.evaluated_at) : null,
      lastDormantDecay: lastDecay?.created_at ? new Date(lastDecay.created_at) : null,
      dormantAICount: dormantCount || 0,
      warningUserCount: warningCount || 0
    };
  }
  
  /**
   * 发送通知
   */
  private async sendNotification(payload: NotificationPayload): Promise<void> {
    if (this.notificationCallback && payload.telegramUserId) {
      try {
        await this.notificationCallback(payload);
      } catch (err) {
        console.error('发送通知失败:', err);
      }
    }
  }
  
  /**
   * 获取Telegram用户ID
   */
  private async getTelegramUserId(userId: string): Promise<number> {
    const { data } = await this.supabase
      .from('users')
      .select('telegram_user_id')
      .eq('id', userId)
      .single();
    
    return data?.telegram_user_id || 0;
  }
}