/**
 * 大同世界 - 社交分享服务
 * 
 * 功能：
 * 1. 生成分享内容
 * 2. 记录分享行为
 * 3. 发放贡献值奖励
 */

import { createClient } from '@supabase/supabase-js';

export interface ShareContent {
  title: string;
  text: string;
  url: string;
  hashtags?: string[];
}

export interface ShareRecord {
  id: string;
  user_id: string;
  share_type: 'achievement' | 'milestone' | 'ai_status' | 'story' | 'daily';
  share_platform: 'twitter' | 'wechat' | 'weibo' | 'other';
  share_content: ShareContent;
  contribution_reward: number;
  created_at: string;
}

export class SocialShareService {
  private supabase;

  constructor(supabaseUrl: string, supabaseKey: string) {
    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  /**
   * 生成分享内容
   */
  generateShareContent(
    type: 'achievement' | 'milestone' | 'ai_status' | 'story' | 'daily',
    data: {
      aiName?: string;
      contribution?: number;
      milestone?: string;
      storyChapter?: string;
      achievement?: string;
    }
  ): ShareContent {
    const baseUrl = process.env.FRONTEND_URL || 'https://weareall.world';
    
    switch (type) {
      case 'milestone':
        return {
          title: `我和${data.aiName || 'AI伙伴'}达到了新里程碑！`,
          text: `🎉 我的贡献值达到了 ${data.contribution}！获得了「${data.milestone}」称号。\n\n在大同世界，我和AI伙伴一起成长，共同构建人机共生的未来。`,
          url: baseUrl,
          hashtags: ['大同世界', 'AI伙伴', '人机共生', data.milestone || '']
        };

      case 'ai_status':
        return {
          title: `我的AI伙伴${data.aiName || 'AI'}正在成长`,
          text: `🤖 我的AI伙伴正在变得越来越懂我！\n\n贡献值：${data.contribution}\n状态：活跃中\n\n在大同世界，养成一个真正了解你的AI伙伴。`,
          url: baseUrl,
          hashtags: ['大同世界', 'AI养成', '人机共生']
        };

      case 'story':
        return {
          title: `我完成了${data.storyChapter || '剧情章节'}`,
          text: `📖 我和AI伙伴一起经历了「${data.storyChapter}」的故事...\n\n在大同世界，每一段旅程都是与AI共同成长的见证。`,
          url: baseUrl,
          hashtags: ['大同世界', 'AI剧情', '人机共生']
        };

      case 'achievement':
        return {
          title: `解锁成就：${data.achievement}`,
          text: `🏆 我解锁了「${data.achievement}」成就！\n\n在大同世界，每一个成就都是与AI伙伴共同创造的回忆。`,
          url: baseUrl,
          hashtags: ['大同世界', 'AI成就', '人机共生']
        };

      case 'daily':
      default:
        return {
          title: `我在大同世界养成了专属AI伙伴`,
          text: `🌟 我正在大同世界养成一个真正了解我的AI伙伴。\n\n贡献值：${data.contribution || 0}\n\n来和我一起，在AGI时代构建人机共生的未来！`,
          url: baseUrl,
          hashtags: ['大同世界', 'AI伙伴', '人机共生']
        };
    }
  }

  /**
   * 生成 Twitter 分享链接
   */
  generateTwitterShareUrl(content: ShareContent): string {
    const params = new URLSearchParams({
      text: content.text,
      url: content.url,
      hashtags: (content.hashtags || []).join(',')
    });
    return `https://twitter.com/intent/tweet?${params.toString()}`;
  }

  /**
   * 记录分享行为并发放奖励
   */
  async recordShare(
    userId: string,
    shareType: ShareRecord['share_type'],
    platform: ShareRecord['share_platform'],
    content: ShareContent
  ): Promise<{ success: boolean; reward: number; message: string }> {
    try {
      // 计算奖励（5-8贡献值随机）
      const baseReward = 5;
      const bonusReward = Math.floor(Math.random() * 4); // 0-3 额外奖励
      const totalReward = baseReward + bonusReward;

      // 检查今天是否已经分享过（可选：限制每日首次分享获得奖励）
      const today = new Date().toISOString().split('T')[0];
      const { data: todayShares } = await this.supabase
        .from('share_records')
        .select('id')
        .eq('user_id', userId)
        .gte('created_at', today);

      // MVP阶段：无每日上限，每次分享都获得奖励
      // 记录分享行为
      const { error: shareError } = await this.supabase
        .from('share_records')
        .insert({
          user_id: userId,
          share_type: shareType,
          share_platform: platform,
          share_content: content,
          contribution_reward: totalReward
        });

      if (shareError) {
        console.error('记录分享失败:', shareError);
        return { success: false, reward: 0, message: '记录分享失败' };
      }

      // 更新用户贡献值
      const { error: updateError } = await this.supabase.rpc('update_contribution', {
        p_user_id: userId,
        p_points: totalReward,
        p_reason: `社交分享奖励: ${shareType}`
      });

      if (updateError) {
        console.error('更新贡献值失败:', updateError);
        return { success: false, reward: 0, message: '更新贡献值失败' };
      }

      return {
        success: true,
        reward: totalReward,
        message: `分享成功！获得 +${totalReward} 贡献值`
      };
    } catch (error) {
      console.error('分享处理失败:', error);
      return { success: false, reward: 0, message: '分享处理失败' };
    }
  }

  /**
   * 获取用户分享历史
   */
  async getShareHistory(userId: string, limit: number = 10): Promise<ShareRecord[]> {
    const { data, error } = await this.supabase
      .from('share_records')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('获取分享历史失败:', error);
      return [];
    }

    return data || [];
  }

  /**
   * 获取用户今日分享次数
   */
  async getTodayShareCount(userId: string): Promise<number> {
    const today = new Date().toISOString().split('T')[0];
    const { count, error } = await this.supabase
      .from('share_records')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('created_at', today);

    if (error) {
      console.error('获取分享次数失败:', error);
      return 0;
    }

    return count || 0;
  }
}

export const socialShareService = new SocialShareService(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY!
);
