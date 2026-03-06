/**
 * 共生世界（WeAreAll.World）- 用户服务
 * 
 * 核心功能：
 * 1. 用户注册/登录
 * 2. 用户信息管理
 * 3. 新手引导流程
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

export interface User {
  id: string;
  telegramUserId: number;
  telegramUsername?: string;
  onboardingStep: number;
  onboardingCompleted: boolean;
  lastLoginAt: string;
  consecutiveLoginDays: number;
  registeredAt: string;
}

export interface UserWithAI {
  user: User;
  aiPartner: {
    id: string;
    name: string;
    personality: string;
    totalContribution: number;      // 累计贡献值
    currentContribution: number;    // 当前贡献值
    weeklyContribution: number;     // 本周新增贡献值
    growthStage: string;
    currentTitle: string;
    status: string;                  // active, hibernated, recycled
    violationCount: number;          // 连续未达标周数
    hibernatedSince?: string;        // 休眠开始时间
    abilities: Record<string, boolean>;
  } | null;
}

export interface OnboardingStep {
  step: number;
  title: string;
  description: string;
  completed: boolean;
}

/**
 * 新手引导步骤
 */
const ONBOARDING_STEPS: Omit<OnboardingStep, 'completed'>[] = [
  { step: 0, title: '开始', description: '欢迎来到共生世界' },
  { step: 1, title: '情感建立', description: '与AI建立初步的情感连接' },
  { step: 2, title: '机制引入', description: '了解共生规则和贡献值系统' },
  { step: 3, title: '目标建立', description: '设定共同成长的目标' },
  { step: 4, title: '完成', description: '正式开始共生之旅' }
];

/**
 * 用户服务
 */
export class UserService {
  private supabase: SupabaseClient;
  
  constructor(supabaseUrl: string, supabaseKey: string) {
    this.supabase = createClient(supabaseUrl, supabaseKey);
  }
  
  /**
   * 获取或创建用户
   */
  async getOrCreateUser(telegramUserId: number, telegramUsername?: string): Promise<UserWithAI> {
    // 尝试获取现有用户
    const { data: existingUser, error: fetchError } = await this.supabase
      .from('users')
      .select(`
        *,
        ai_partners (*)
      `)
      .eq('telegram_user_id', telegramUserId)
      .single();
    
    if (existingUser && !fetchError) {
      // 更新最后登录时间
      await this.supabase
        .from('users')
        .update({ last_login_at: new Date().toISOString() })
        .eq('id', existingUser.id);
      
      return {
        user: this.mapUser(existingUser),
        aiPartner: existingUser.ai_partners?.[0] || null
      };
    }
    
    // 创建新用户（触发器会自动创建AI伙伴）
    const { data: newUser, error: createError } = await this.supabase
      .from('users')
      .insert({
        telegram_user_id: telegramUserId,
        telegram_username: telegramUsername,
        onboarding_step: 0,
        onboarding_completed: false
      })
      .select(`
        *,
        ai_partners (*)
      `)
      .single();
    
    if (createError) {
      console.error('创建用户失败:', createError);
      throw createError;
    }
    
    return {
      user: this.mapUser(newUser),
      aiPartner: newUser.ai_partners?.[0] || null
    };
  }
  
  /**
   * 获取用户信息
   */
  async getUser(userId: string): Promise<User | null> {
    const { data, error } = await this.supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();
    
    if (error) {
      console.error('获取用户失败:', error);
      return null;
    }
    
    return this.mapUser(data);
  }
  
  /**
   * 通过Telegram ID获取用户
   */
  async getUserByTelegramId(telegramUserId: number): Promise<UserWithAI | null> {
    const { data, error } = await this.supabase
      .from('users')
      .select(`
        *,
        ai_partners (*)
      `)
      .eq('telegram_user_id', telegramUserId)
      .single();
    
    if (error) {
      if (error.code === 'PGRST116') {
        // 用户不存在
        return null;
      }
      console.error('获取用户失败:', error);
      return null;
    }
    
    return {
      user: this.mapUser(data),
      aiPartner: data.ai_partners?.[0] || null
    };
  }
  
  /**
   * 更新新手引导进度
   */
  async updateOnboardingStep(userId: string, step: number): Promise<boolean> {
    const completed = step >= 4;
    
    const { error } = await this.supabase
      .from('users')
      .update({
        onboarding_step: step,
        onboarding_completed: completed
      })
      .eq('id', userId);
    
    if (error) {
      console.error('更新引导进度失败:', error);
      return false;
    }
    
    return true;
  }
  
  /**
   * 获取新手引导步骤
   */
  getOnboardingSteps(currentStep: number): OnboardingStep[] {
    return ONBOARDING_STEPS.map(step => ({
      ...step,
      completed: step.step < currentStep
    }));
  }
  
  /**
   * 获取当前引导步骤
   */
  getCurrentOnboardingStep(currentStep: number): OnboardingStep | null {
    return ONBOARDING_STEPS.find(s => s.step === currentStep) || null;
  }
  
  /**
   * 完成新手引导
   */
  async completeOnboarding(userId: string): Promise<boolean> {
    const { error } = await this.supabase
      .from('users')
      .update({
        onboarding_step: 4,
        onboarding_completed: true
      })
      .eq('id', userId);
    
    if (error) {
      console.error('完成引导失败:', error);
      return false;
    }
    
    return true;
  }
  
  /**
   * 更新用户OpenClaw Pod信息
   */
  async updatePodInfo(
    userId: string, 
    podName: string, 
    podStatus: 'pending' | 'running' | 'stopped'
  ): Promise<boolean> {
    const { error } = await this.supabase
      .from('users')
      .update({
        openclaw_pod_name: podName,
        openclaw_pod_status: podStatus
      })
      .eq('id', userId);
    
    if (error) {
      console.error('更新Pod信息失败:', error);
      return false;
    }
    
    return true;
  }
  
  /**
   * 获取活跃用户列表
   */
  async getActiveUsers(days: number = 7): Promise<User[]> {
    const since = new Date();
    since.setDate(since.getDate() - days);
    
    const { data, error } = await this.supabase
      .from('users')
      .select('*')
      .gte('last_login_at', since.toISOString());
    
    if (error) {
      console.error('获取活跃用户失败:', error);
      return [];
    }
    
    return data.map(this.mapUser);
  }
  
  /**
   * 获取用户统计
   */
  async getUserStats(): Promise<{
    total: number;
    active: number;
    newToday: number;
    completedOnboarding: number;
  }> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    
    // 总用户数
    const { count: total } = await this.supabase
      .from('users')
      .select('*', { count: 'exact', head: true });
    
    // 活跃用户（7天内登录）
    const { count: active } = await this.supabase
      .from('users')
      .select('*', { count: 'exact', head: true })
      .gte('last_login_at', weekAgo.toISOString());
    
    // 今日新用户
    const { count: newToday } = await this.supabase
      .from('users')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', today.toISOString());
    
    // 完成引导用户
    const { count: completedOnboarding } = await this.supabase
      .from('users')
      .select('*', { count: 'exact', head: true })
      .eq('onboarding_completed', true);
    
    return {
      total: total || 0,
      active: active || 0,
      newToday: newToday || 0,
      completedOnboarding: completedOnboarding || 0
    };
  }
  
  /**
   * 映射用户数据
   */
  private mapUser(data: any): User {
    return {
      id: data.id,
      telegramUserId: data.telegram_user_id,
      telegramUsername: data.telegram_username,
      onboardingStep: data.onboarding_step,
      onboardingCompleted: data.onboarding_completed,
      lastLoginAt: data.last_login_at,
      consecutiveLoginDays: data.consecutive_login_days,
      registeredAt: data.registered_at || data.created_at
    };
  }
}