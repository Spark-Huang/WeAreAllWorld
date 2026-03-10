/**
 * Bot Key 管理服务
 * 每个用户可以配置自己的 Telegram Bot Token
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

export interface BotKey {
  id: string;
  user_id: string;
  bot_token: string;
  bot_username?: string;
  bot_name?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface BotKeyCreateInput {
  user_id: string;
  bot_token: string;
  bot_name?: string;
}

export interface BotKeyUpdateInput {
  bot_token?: string;
  bot_name?: string;
  is_active?: boolean;
}

export class BotKeyService {
  private supabase: SupabaseClient;

  constructor(supabaseUrl: string, supabaseKey: string) {
    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  /**
   * 创建或更新 Bot Key
   */
  async upsertBotKey(input: BotKeyCreateInput): Promise<{ success: boolean; data?: BotKey; error?: string }> {
    try {
      // 验证 Bot Token
      const botInfo = await this.validateBotToken(input.bot_token);
      if (!botInfo.valid) {
        return { success: false, error: botInfo.error || '无效的 Bot Token' };
      }

      const { data, error } = await this.supabase
        .from('bot_keys')
        .upsert({
          user_id: input.user_id,
          bot_token: input.bot_token,
          bot_username: botInfo.username,
          bot_name: input.bot_name || botInfo.first_name,
          is_active: true,
          updated_at: new Date().toISOString()
        } as never, {
          onConflict: 'user_id'
        })
        .select()
        .single();

      if (error) {
        console.error('Upsert bot key error:', error);
        return { success: false, error: '保存 Bot Key 失败' };
      }

      return { success: true, data: data as BotKey };
    } catch (err) {
      console.error('Upsert bot key error:', err);
      return { success: false, error: '保存 Bot Key 失败' };
    }
  }

  /**
   * 获取用户的 Bot Key
   */
  async getBotKey(userId: string): Promise<BotKey | null> {
    try {
      const { data, error } = await this.supabase
        .from('bot_keys')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true)
        .single();

      if (error) {
        if (error.code === 'PGRST116') return null; // 未找到
        console.error('Get bot key error:', error);
        return null;
      }

      return data as BotKey;
    } catch (err) {
      console.error('Get bot key error:', err);
      return null;
    }
  }

  /**
   * 删除用户的 Bot Key
   */
  async deleteBotKey(userId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await this.supabase
        .from('bot_keys')
        .update({ is_active: false, updated_at: new Date().toISOString() } as never)
        .eq('user_id', userId);

      if (error) {
        console.error('Delete bot key error:', error);
        return { success: false, error: '删除 Bot Key 失败' };
      }

      return { success: true };
    } catch (err) {
      console.error('Delete bot key error:', err);
      return { success: false, error: '删除 Bot Key 失败' };
    }
  }

  /**
   * 获取所有活跃的 Bot Keys
   */
  async getAllActiveBotKeys(): Promise<BotKey[]> {
    try {
      const { data, error } = await this.supabase
        .from('bot_keys')
        .select('*')
        .eq('is_active', true);

      if (error) {
        console.error('Get all bot keys error:', error);
        return [];
      }

      return (data as BotKey[]) || [];
    } catch (err) {
      console.error('Get all bot keys error:', err);
      return [];
    }
  }

  /**
   * 验证 Bot Token
   */
  async validateBotToken(token: string): Promise<{ valid: boolean; username?: string; first_name?: string; error?: string }> {
    try {
      const response = await fetch(`https://api.telegram.org/bot${token}/getMe`);
      const result = await response.json() as { ok: boolean; result?: { username?: string; first_name?: string }; description?: string };

      if (!result.ok) {
        return { valid: false, error: result.description || 'Token 无效' };
      }

      return {
        valid: true,
        username: result.result?.username,
        first_name: result.result?.first_name
      };
    } catch (err) {
      console.error('Validate bot token error:', err);
      return { valid: false, error: '验证失败，请检查网络' };
    }
  }

  /**
   * 测试 Bot 发送消息
   */
  async testBotMessage(token: string, chatId: string, message: string): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await fetch(
        `https://api.telegram.org/bot${token}/sendMessage`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            text: message
          })
        }
      );
      const result = await response.json() as { ok: boolean; description?: string };

      if (!result.ok) {
        return { success: false, error: result.description || '发送失败' };
      }

      return { success: true };
    } catch (err) {
      console.error('Test bot message error:', err);
      return { success: false, error: '发送失败' };
    }
  }
}