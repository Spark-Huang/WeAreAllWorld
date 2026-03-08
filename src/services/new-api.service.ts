/**
 * 天下一家（WeAreAll.World）- New API 网关服务
 * 
 * 功能：
 * 1. 用户自动同步到 New API
 * 2. API Token 自动生成和管理
 * 3. 额度查询和充值链接生成
 * 4. SSO 单点登录支持
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

export interface NewApiConfig {
  baseUrl: string;
  adminToken: string;
  initialQuota: number;
  ssoSecret: string;
}

export interface NewApiUser {
  id: number;
  username: string;
  email: string;
  quota: number;
  status: number;
}

export interface NewApiToken {
  id: number;
  name: string;
  key: string;
  status: number;
  remain_quota: number;
  expired_time: number;
}

export interface QuotaInfo {
  quota: number;        // 剩余额度
  usedQuota: number;    // 已使用额度
  totalQuota: number;   // 总额度
}

export interface SyncResult {
  success: boolean;
  newApiUserId?: number;
  newApiToken?: string;
  error?: string;
}

/**
 * New API 服务类
 */
export class NewApiService {
  private config: NewApiConfig;
  private supabase: SupabaseClient;
  
  constructor(
    config: NewApiConfig,
    supabaseUrl: string,
    supabaseKey: string
  ) {
    this.config = config;
    this.supabase = createClient(supabaseUrl, supabaseKey);
  }
  
  /**
   * 同步用户到 New API
   * 如果用户还没有 New API 账户，自动创建并生成 Token
   */
  async syncUser(params: {
    userId: string;
    email?: string;
  }): Promise<SyncResult> {
    const { userId, email } = params;
    
    try {
      // 1. 检查用户是否已有 New API Token
      const { data: existingUser, error: fetchError } = await this.supabase
        .from('users')
        .select('new_api_user_id, new_api_token')
        .eq('id', userId)
        .single();
      
      // 如果用户不存在于 public.users 表，先创建
      if (fetchError && fetchError.code === 'PGRST116') {
        console.log('用户不存在于 public.users，创建记录...');
        const { error: createError } = await this.supabase
          .from('users')
          .insert({
            id: userId,
            new_api_quota: 0
          });
        
        if (createError) {
          console.error('创建用户记录失败:', createError);
          return { success: false, error: '创建用户记录失败' };
        }
      } else if (fetchError) {
        console.error('查询用户失败:', fetchError);
        return { success: false, error: '查询用户失败' };
      }
      
      // 如果已有 Token，直接返回
      if (existingUser?.new_api_token) {
        return {
          success: true,
          newApiUserId: existingUser.new_api_user_id,
          newApiToken: existingUser.new_api_token
        };
      }
      
      // 2. 在 New API 创建用户
      // 用户名限制：最大 20 字符
      const username = `wa_${userId.substring(0, 12)}`;
      const userEmail = email || `${username}@weareallworld.local`;
      
      const newUser = await this.createApiUser({
        username,
        email: userEmail
      });
      
      if (!newUser) {
        return { success: false, error: '创建 API 用户失败' };
      }
      
      // 3. 为用户生成 API Token
      const token = await this.createApiToken({
        userId: newUser.id,
        name: 'Auto-generated for WeAreAllWorld'
      });
      
      if (!token) {
        return { success: false, error: '创建 API Token 失败' };
      }
      
      // 4. 更新本地数据库
      const { error: updateError } = await this.supabase
        .from('users')
        .update({
          new_api_user_id: newUser.id,
          new_api_token: token.key,
          new_api_quota: this.config.initialQuota,
          new_api_created_at: new Date().toISOString()
        })
        .eq('id', userId);
      
      if (updateError) {
        console.error('更新用户失败:', updateError);
        return { success: false, error: '更新用户数据失败' };
      }
      
      return {
        success: true,
        newApiUserId: newUser.id,
        newApiToken: token.key
      };
    } catch (error) {
      console.error('同步用户失败:', error);
      return { success: false, error: '同步用户失败' };
    }
  }
  
  /**
   * 在 New API 创建用户
   * 使用管理员 session 认证
   */
  private async createApiUser(params: {
    username: string;
    email: string;
  }): Promise<NewApiUser | null> {
    try {
      // 使用管理员登录获取 session
      const loginResponse = await fetch(`${this.config.baseUrl}/api/user/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          username: 'admin',
          password: process.env.NEW_API_ADMIN_PASSWORD || 'Admin@123456'
        })
      });
      
      if (!loginResponse.ok) {
        console.error('管理员登录失败');
        return null;
      }
      
      // 获取 session cookie
      const setCookie = loginResponse.headers.get('set-cookie');
      if (!setCookie) {
        return null;
      }
      
      const sessionMatch = setCookie.match(/session=([^;]+)/);
      if (!sessionMatch) {
        return null;
      }
      
      const session = sessionMatch[1];
      
      // 创建用户
      const response = await fetch(`${this.config.baseUrl}/api/user/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': `session=${session}`,
          'New-Api-User': '1'
        },
        body: JSON.stringify({
          username: params.username,
          email: params.email,
          password: this.generateRandomPassword(),
          group: 'default'
        })
      });
      
      // 无论 API 返回什么，都尝试获取用户
      // 因为用户可能已存在
      const user = await this.getApiUserByUsernameWithSession(params.username, session);
      if (user) {
        return user;
      }
      
      // 如果 API 调用成功但用户不存在，等待一下再查询
      if (response.ok) {
        await new Promise(resolve => setTimeout(resolve, 500));
        return await this.getApiUserByUsernameWithSession(params.username, session);
      }
      
      console.error('创建 API 用户失败:', await response.text());
      return null;
    } catch (error) {
      console.error('创建 API 用户异常:', error);
      return null;
    }
  }
  
  /**
   * 使用已有 session 获取用户
   */
  private async getApiUserByUsernameWithSession(username: string, session: string): Promise<NewApiUser | null> {
    try {
      const response = await fetch(`${this.config.baseUrl}/api/user/`, {
        method: 'GET',
        headers: {
          'Cookie': `session=${session}`,
          'New-Api-User': '1'
        }
      });
      
      if (!response.ok) return null;
      
      const data = await response.json() as { data?: { items?: NewApiUser[] } };
      const users = data.data?.items || [];
      return users.find(u => u.username === username) || null;
    } catch (error) {
      console.error('获取 API 用户异常:', error);
      return null;
    }
  }
  
  /**
   * 通过用户名获取 API 用户
   * 使用管理员 session 认证
   */
  private async getApiUserByUsername(username: string): Promise<NewApiUser | null> {
    try {
      // 使用管理员登录获取 session
      const loginResponse = await fetch(`${this.config.baseUrl}/api/user/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          username: 'admin',
          password: process.env.NEW_API_ADMIN_PASSWORD || 'Admin@123456'
        })
      });
      
      if (!loginResponse.ok) {
        console.error('管理员登录失败');
        return null;
      }
      
      // 获取 session cookie
      const setCookie = loginResponse.headers.get('set-cookie');
      if (!setCookie) {
        return null;
      }
      
      const sessionMatch = setCookie.match(/session=([^;]+)/);
      if (!sessionMatch) {
        return null;
      }
      
      const session = sessionMatch[1];
      
      // 使用 session 获取用户列表
      const response = await fetch(`${this.config.baseUrl}/api/user/`, {
        method: 'GET',
        headers: {
          'Cookie': `session=${session}`,
          'New-Api-User': '1'
        }
      });
      
      if (!response.ok) return null;
      
      const data = await response.json() as { data?: { items?: NewApiUser[] } };
      const users = data.data?.items || [];
      return users.find(u => u.username === username) || null;
    } catch (error) {
      console.error('获取 API 用户异常:', error);
      return null;
    }
  }
  
  /**
   * 为用户创建 API Token
   * 使用管理员 session 认证
   */
  private async createApiToken(params: {
    userId: number;
    name: string;
  }): Promise<NewApiToken | null> {
    try {
      // 使用管理员登录获取 session
      const loginResponse = await fetch(`${this.config.baseUrl}/api/user/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          username: 'admin',
          password: process.env.NEW_API_ADMIN_PASSWORD || 'Admin@123456'
        })
      });
      
      if (!loginResponse.ok) {
        console.error('管理员登录失败');
        return null;
      }
      
      // 获取 session cookie
      const setCookie = loginResponse.headers.get('set-cookie');
      if (!setCookie) {
        return null;
      }
      
      const sessionMatch = setCookie.match(/session=([^;]+)/);
      if (!sessionMatch) {
        return null;
      }
      
      const session = sessionMatch[1];
      
      const response = await fetch(`${this.config.baseUrl}/api/token/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': `session=${session}`,
          'New-Api-User': '1'
        },
        body: JSON.stringify({
          user_id: params.userId,
          name: params.name,
          remain_quota: this.config.initialQuota,
          expired_time: -1, // 永不过期
          unlimited_quota: false
        })
      });
      
      if (!response.ok) {
        const error = await response.text();
        console.error('创建 API Token 失败:', error);
        return null;
      }
      
      // New API 创建 token 后返回 { success: true }，需要查询获取 key
      const result = await response.json() as { success?: boolean; data?: NewApiToken };
      
      if (result.success) {
        // 查询获取 token key
        const tokensResponse = await fetch(`${this.config.baseUrl}/api/token/?user_id=${params.userId}`, {
          headers: {
            'Cookie': `session=${session}`,
            'New-Api-User': '1'
          }
        });
        
        if (tokensResponse.ok) {
          const tokensData = await tokensResponse.json() as { data?: { items?: NewApiToken[] } };
          const tokens = tokensData.data?.items || [];
          // 返回最新的 token
          return tokens[0] || null;
        }
      }
      
      return result.data || null;
    } catch (error) {
      console.error('创建 API Token 异常:', error);
      return null;
    }
  }
  
  /**
   * 获取用户额度信息
   */
  async getQuota(userId: string): Promise<QuotaInfo | null> {
    try {
      // 从本地缓存获取
      const { data: user, error } = await this.supabase
        .from('users')
        .select('new_api_token, new_api_quota')
        .eq('id', userId)
        .single();
      
      if (error || !user?.new_api_token) {
        return null;
      }
      
      // 从 New API 获取实时额度
      const response = await fetch(`${this.config.baseUrl}/api/token/`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.config.adminToken}`
        }
      });
      
      if (!response.ok) {
        // 返回本地缓存
        return {
          quota: user.new_api_quota || 0,
          usedQuota: 0,
          totalQuota: user.new_api_quota || 0
        };
      }
      
      // 更新本地缓存
      // TODO: 解析实际额度并更新
      
      return {
        quota: user.new_api_quota || 0,
        usedQuota: 0,
        totalQuota: user.new_api_quota || 0
      };
    } catch (error) {
      console.error('获取额度失败:', error);
      return null;
    }
  }
  
  /**
   * 检查用户额度是否足够
   */
  async checkQuota(userId: string, requiredQuota: number = 1000): Promise<{
    sufficient: boolean;
    quota: number;
  }> {
    const quotaInfo = await this.getQuota(userId);
    
    if (!quotaInfo) {
      return { sufficient: false, quota: 0 };
    }
    
    return {
      sufficient: quotaInfo.quota >= requiredQuota,
      quota: quotaInfo.quota
    };
  }
  
  /**
   * 生成充值链接（带 SSO）
   */
  async getRechargeUrl(userId: string): Promise<string> {
    // 生成 SSO Token
    const ssoToken = await this.generateSSOToken(userId);
    
    // 返回充值链接
    return `${this.config.baseUrl}/login?sso=${encodeURIComponent(ssoToken)}&redirect=/topup`;
  }
  
  /**
   * 生成 SSO Token
   * 使用 Supabase Auth 的 JWT
   */
  private async generateSSOToken(userId: string): Promise<string> {
    // 使用 Supabase 生成 JWT
    // 这里简化处理，实际应该使用 Supabase Admin API
    const payload = {
      sub: userId,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 300, // 5分钟有效
      aud: 'new-api-sso'
    };
    
    // 使用 ssoSecret 签名
    // 实际实现应该使用 JWT 库
    return Buffer.from(JSON.stringify(payload)).toString('base64url');
  }
  
  /**
   * 获取用户的 API Token（用于调用 LLM）
   */
  async getUserToken(userId: string): Promise<string | null> {
    try {
      const { data: user, error } = await this.supabase
        .from('users')
        .select('new_api_token')
        .eq('id', userId)
        .single();
      
      if (error || !user?.new_api_token) {
        // 尝试同步用户
        const syncResult = await this.syncUser({ userId });
        return syncResult.success ? syncResult.newApiToken || null : null;
      }
      
      return user.new_api_token;
    } catch (error) {
      console.error('获取用户 Token 失败:', error);
      return null;
    }
  }
  
  /**
   * 更新用户额度缓存
   */
  async updateQuotaCache(userId: string, quota: number): Promise<boolean> {
    try {
      const { error } = await this.supabase
        .from('users')
        .update({ new_api_quota: quota })
        .eq('id', userId);
      
      return !error;
    } catch (error) {
      console.error('更新额度缓存失败:', error);
      return false;
    }
  }
  
  /**
   * 生成随机密码
   */
  private generateRandomPassword(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%';
    let password = '';
    for (let i = 0; i < 16; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
  }
}

// 默认实例
let defaultInstance: NewApiService | null = null;

export function getNewApiService(): NewApiService | null {
  if (!defaultInstance) {
    const baseUrl = process.env.NEW_API_BASE_URL;
    const adminToken = process.env.NEW_API_ADMIN_TOKEN;
    
    if (!baseUrl || !adminToken) {
      console.warn('New API 配置不完整，功能将不可用');
      return null;
    }
    
    defaultInstance = new NewApiService(
      {
        baseUrl,
        adminToken,
        initialQuota: parseInt(process.env.NEW_API_INITIAL_QUOTA || '100000'),
        ssoSecret: process.env.NEW_API_SSO_SECRET || 'default-sso-secret'
      },
      process.env.SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY || ''
    );
  }
  
  return defaultInstance;
}