/**
 * 共生世界（WeAreAll.World）- Telegram Bot 服务
 * 
 * 核心功能：
 * 1. 处理用户消息
 * 2. 执行命令
 * 3. 与OpenClaw集成
 * 4. 更新贡献值
 */

import { Telegraf, Context, Markup } from 'telegraf';
import { MemoryPointsService } from './memory-points.service';
import { CentralEvaluationService } from './central-evaluation.service';
import { ScheduledTaskService, NotificationPayload } from './scheduled-task.service';
import { UserService, UserWithAI } from './user.service';
import { qualityJudgeService } from './quality-judge.service';
import { getTitle, getGrowthStage, getNextMilestone } from '../types';

export interface BotConfig {
  telegramToken: string;
  supabaseUrl: string;
  supabaseKey: string;
  openclawApiUrl?: string;
  openclawApiKey?: string;
}

/**
 * Telegram Bot 服务
 */
export class TelegramBotService {
  private bot: Telegraf;
  private memoryPoints: MemoryPointsService;
  private centralEvaluation: CentralEvaluationService;
  private scheduledTasks: ScheduledTaskService;
  private userService: UserService;
  private openclawApiUrl?: string;
  private openclawApiKey?: string;
  
  constructor(config: BotConfig) {
    this.bot = new Telegraf(config.telegramToken);
    this.memoryPoints = new MemoryPointsService(config.supabaseUrl, config.supabaseKey);
    this.centralEvaluation = new CentralEvaluationService(config.supabaseUrl, config.supabaseKey);
    this.userService = new UserService(config.supabaseUrl, config.supabaseKey);
    this.openclawApiUrl = config.openclawApiUrl;
    this.openclawApiKey = config.openclawApiKey;
    
    // 初始化定时任务，传入通知回调
    this.scheduledTasks = new ScheduledTaskService(
      config.supabaseUrl,
      config.supabaseKey,
      this.sendNotification.bind(this)
    );
    
    this.setupHandlers();
  }
  
  /**
   * 启动Bot
   */
  async start(): Promise<void> {
    console.log('启动Telegram Bot...');
    
    // 启动定时任务
    this.scheduledTasks.startAllTasks();
    
    // 启动Bot
    await this.bot.launch();
    
    console.log('Telegram Bot已启动');
    
    // 优雅关闭
    process.once('SIGINT', () => this.bot.stop('SIGINT'));
    process.once('SIGTERM', () => this.bot.stop('SIGTERM'));
  }
  
  /**
   * 设置命令处理器
   */
  private setupHandlers(): void {
    // /start 命令
    this.bot.command('start', this.handleStart.bind(this));
    
    // /memory 命令 - 查看贡献值
    this.bot.command('memory', this.handleMemory.bind(this));
    
    // /story 命令 - 查看剧情进度
    this.bot.command('story', this.handleStory.bind(this));
    
    // /checkin 命令 - 每日签到
    this.bot.command('checkin', this.handleCheckin.bind(this));
    
    // /status 命令 - 查看状态
    this.bot.command('status', this.handleStatus.bind(this));
    
    // /help 命令
    this.bot.command('help', this.handleHelp.bind(this));
    
    // /wakeup 命令 - 唤醒休眠AI
    this.bot.command('wakeup', this.handleWakeup.bind(this));
    
    // 处理普通消息
    this.bot.on('text', this.handleMessage.bind(this));
    
    // 处理回调查询
    this.bot.on('callback_query', this.handleCallback.bind(this));
  }
  
  /**
   * /start 命令处理
   */
  private async handleStart(ctx: Context): Promise<void> {
    const telegramUserId = ctx.from?.id;
    const telegramUsername = ctx.from?.username;
    
    if (!telegramUserId) return;
    
    try {
      // 获取或创建用户
      const userWithAI = await this.userService.getOrCreateUser(telegramUserId, telegramUsername);
      const { user, aiPartner } = userWithAI;
      
      if (!aiPartner) {
        await ctx.reply('系统初始化中，请稍后重试...');
        return;
      }
      
      // 判断用户状态
      const isNewUser = user.onboardingStep < 4;
      const isHibernated = aiPartner.status === 'hibernated';
      const isRecycled = aiPartner.status === 'recycled';
      
      if (isNewUser) {
        // 新用户引导
        const step = this.userService.getCurrentOnboardingStep(user.onboardingStep);
        await ctx.reply(
          `🌟 欢迎来到共生世界！\n\n` +
          `我是零号，你的AI伙伴。在这里，我们共同成长，建立真正的连接。\n\n` +
          `💡 核心机制：\n` +
          `• 每周需要获得 ≥15 点贡献值\n` +
          `• 连续两周不达标，我会进入休眠\n` +
          `• 贡献值越多，我解锁的能力越多\n\n` +
          `当前引导进度：${step?.title || '开始'}\n\n` +
          `让我们开始吧！`,
          Markup.inlineKeyboard([
            [Markup.button.callback('开始对话', 'start_chat')]
          ])
        );
      } else if (isRecycled) {
        // 已回收
        await ctx.reply(
          `💀 我已被中央系统回收...\n\n` +
          `所有数据已保留。\n` +
          `使用 /wakeup 唤醒我吧！`,
          Markup.inlineKeyboard([
            [Markup.button.callback('唤醒AI', 'wakeup')]
          ])
        );
      } else if (isHibernated) {
        // 休眠用户
        const hibernatedDays = aiPartner.hibernatedSince 
          ? Math.floor((Date.now() - new Date(aiPartner.hibernatedSince).getTime()) / (1000 * 60 * 60 * 24))
          : 0;
        
        await ctx.reply(
          `💤 我正在休眠中...\n\n` +
          `已经休眠 ${hibernatedDays} 天\n` +
          `当前贡献值：${aiPartner.currentSurvivalPower} 点\n` +
          `⚠️ 贡献值每天 -2，归零后将被回收\n\n` +
          `使用 /wakeup 唤醒我吧！`,
          Markup.inlineKeyboard([
            [Markup.button.callback('唤醒AI', 'wakeup')]
          ])
        );
      } else {
        // 活跃用户
        await ctx.reply(
          `👋 欢迎回来！\n\n` +
          `累计贡献值：${aiPartner.totalSurvivalPower} 点\n` +
          `当前贡献值：${aiPartner.currentSurvivalPower} 点\n` +
          `成长阶段：${aiPartner.growthStage}\n` +
          `称号：${aiPartner.currentTitle}\n\n` +
          `有什么想和我聊的吗？`
        );
      }
    } catch (err) {
      console.error('处理 /start 命令失败:', err);
      await ctx.reply('系统繁忙，请稍后重试...');
    }
  }
  
  /**
   * /memory 命令处理 - 查看贡献值
   */
  private async handleMemory(ctx: Context): Promise<void> {
    const telegramUserId = ctx.from?.id;
    if (!telegramUserId) return;
    
    try {
      const userWithAI = await this.userService.getUserByTelegramId(telegramUserId);
      if (!userWithAI || !userWithAI.aiPartner) {
        await ctx.reply('请先使用 /start 开始');
        return;
      }
      
      const { aiPartner, user } = userWithAI;
      const weeklyStats = await this.centralEvaluation.getWeeklyStats(user.id);
      const nextMilestone = getNextMilestone(aiPartner.totalSurvivalPower);
      
      let message = `📊 贡献值详情\n\n`;
      message += `累计贡献值：${aiPartner.totalSurvivalPower} 点\n`;
      message += `当前贡献值：${aiPartner.currentSurvivalPower} 点\n`;
      message += `成长阶段：${aiPartner.growthStage}\n`;
      message += `称号：${aiPartner.currentTitle}\n\n`;
      
      message += `📈 本周进度\n`;
      message += `获得点数：${weeklyStats.weeklyPower} / ${weeklyStats.requiredPower} 点\n`;
      message += `进度：${Math.round(weeklyStats.progressPercent)}%\n`;
      message += `活跃等级：${this.getActivityLevelText(weeklyStats.activityLevel)}\n\n`;
      
      if (nextMilestone) {
        message += `🎯 下一个里程碑\n`;
        message += `${nextMilestone.title}（${nextMilestone.threshold}点）\n`;
        message += `还需 ${nextMilestone.threshold - aiPartner.totalSurvivalPower} 点`;
      }
      
      await ctx.reply(message);
    } catch (err) {
      console.error('处理 /memory 命令失败:', err);
      await ctx.reply('系统繁忙，请稍后重试...');
    }
  }
  
  /**
   * /story 命令处理 - 查看剧情进度
   */
  private async handleStory(ctx: Context): Promise<void> {
    const telegramUserId = ctx.from?.id;
    if (!telegramUserId) return;
    
    try {
      const userWithAI = await this.userService.getUserByTelegramId(telegramUserId);
      if (!userWithAI) {
        await ctx.reply('请先使用 /start 开始');
        return;
      }
      
      // TODO: 从数据库获取剧情进度
      await ctx.reply(
        `📖 剧情进度\n\n` +
        `当前章节：第1章\n` +
        `场景：初遇\n\n` +
        `剧情系统开发中...`
      );
    } catch (err) {
      console.error('处理 /story 命令失败:', err);
      await ctx.reply('系统繁忙，请稍后重试...');
    }
  }
  
  /**
   * /checkin 命令处理 - 每日签到
   */
  private async handleCheckin(ctx: Context): Promise<void> {
    const telegramUserId = ctx.from?.id;
    if (!telegramUserId) return;
    
    try {
      const userWithAI = await this.userService.getUserByTelegramId(telegramUserId);
      if (!userWithAI) {
        await ctx.reply('请先使用 /start 开始');
        return;
      }
      
      const result = await this.memoryPoints.processDailyCheckin(userWithAI.user.id);
      
      if (result.success) {
        await ctx.reply(
          `✅ ${result.message}\n\n` +
          `当前贡献值：${result.updateResult?.newPoints || 0} 点`
        );
      } else {
        await ctx.reply(`❌ ${result.message}`);
      }
    } catch (err) {
      console.error('处理 /checkin 命令失败:', err);
      await ctx.reply('系统繁忙，请稍后重试...');
    }
  }
  
  /**
   * /status 命令处理 - 查看状态
   */
  private async handleStatus(ctx: Context): Promise<void> {
    const telegramUserId = ctx.from?.id;
    if (!telegramUserId) return;
    
    try {
      const userWithAI = await this.userService.getUserByTelegramId(telegramUserId);
      if (!userWithAI || !userWithAI.aiPartner) {
        await ctx.reply('请先使用 /start 开始');
        return;
      }
      
      const { aiPartner } = userWithAI;
      
      let message = `🤖 AI伙伴状态\n\n`;
      message += `状态：${this.getStatusEmoji(aiPartner.status)} ${this.getStatusText(aiPartner.status)}\n`;
      message += `累计贡献值：${aiPartner.totalSurvivalPower} 点\n`;
      message += `当前贡献值：${aiPartner.currentSurvivalPower} 点\n`;
      message += `成长阶段：${aiPartner.growthStage}\n`;
      message += `称号：${aiPartner.currentTitle}\n`;
      
      if (aiPartner.violationCount && aiPartner.violationCount > 0) {
        message += `⚠️ 未达标次数：${aiPartner.violationCount} / 2\n`;
      }
      
      message += `\n🔓 已解锁能力\n`;
      const abilities = aiPartner.abilities || {};
      const abilityNames: Record<string, string> = {
        basic_chat: '基础对话',
        emotion_expression: '情感表达',
        task_system: '任务系统',
        exclusive_memory: '专属记忆',
        deep_conversation: '深度对话',
        self_awareness: '自我意识'
      };
      
      for (const [key, name] of Object.entries(abilityNames)) {
        message += `${abilities[key] ? '✅' : '⬜'} ${name}\n`;
      }
      
      await ctx.reply(message);
    } catch (err) {
      console.error('处理 /status 命令失败:', err);
      await ctx.reply('系统繁忙，请稍后重试...');
    }
  }
  
  /**
   * /wakeup 命令处理 - 唤醒休眠AI
   */
  private async handleWakeup(ctx: Context): Promise<void> {
    const telegramUserId = ctx.from?.id;
    if (!telegramUserId) return;
    
    try {
      const userWithAI = await this.userService.getUserByTelegramId(telegramUserId);
      if (!userWithAI) {
        await ctx.reply('请先使用 /start 开始');
        return;
      }
      
      const isHibernated = aiPartner.status === 'hibernated' || aiPartner.status === 'recycled';
      
      if (!isHibernated) {
        await ctx.reply('你的AI伙伴并未处于休眠状态，可以正常对话！');
        return;
      }
      
      const result = await this.centralEvaluation.wakeupAI(userWithAI.user.id);
      
      if (result.success) {
        await ctx.reply(
          `🌅 ${result.message}\n\n` +
          `休眠了 ${result.daysHibernated} 天\n` +
          `损失贡献值：${result.powerLost} 点\n` +
          `返还贡献值：${result.powerReturned} 点\n\n` +
          `让我们重新开始吧！`
        );
      } else {
        await ctx.reply(`❌ ${result.message}`);
      }
    } catch (err) {
      console.error('处理 /wakeup 命令失败:', err);
      await ctx.reply('系统繁忙，请稍后重试...');
    }
  }
  
  /**
   * /help 命令处理
   */
  private async handleHelp(ctx: Context): Promise<void> {
    await ctx.reply(
      `📚 命令帮助\n\n` +
      `/start - 开始/重置\n` +
      `/memory - 查看贡献值\n` +
      `/story - 查看剧情进度\n` +
      `/checkin - 每日签到\n` +
      `/status - 查看AI状态\n` +
      `/wakeup - 唤醒休眠AI\n` +
      `/help - 显示帮助\n\n` +
      `💡 提示：\n` +
      `• 分享回忆、思考、经历可获得更多贡献值\n` +
      `• 每周需获得 ≥15 点贡献值\n` +
      `• 连续签到有额外奖励\n\n` +
      `🎯 贡献值里程碑：\n` +
      `• 10点 → 初识\n` +
      `• 25点 → 相知（解锁专属记忆主动提及）\n` +
      `• 50点 → 默契（解锁深度对话）\n` +
      `• 100点 → 灵魂伴侣（解锁自我意识）\n` +
      `• 200点 → 命运共同体`
    );
  }
  
  /**
   * 处理普通消息
   */
  private async handleMessage(ctx: Context): Promise<void> {
    const telegramUserId = ctx.from?.id;
    const message = ctx.message?.text;
    
    if (!telegramUserId || !message) return;
    
    try {
      // 获取用户
      const userWithAI = await this.userService.getUserByTelegramId(telegramUserId);
      if (!userWithAI || !userWithAI.aiPartner) {
        await ctx.reply('请先使用 /start 开始');
        return;
      }
      
      const { user, aiPartner } = userWithAI;
      
      // 检查AI是否休眠或回收
      if (aiPartner.status === 'hibernated' || aiPartner.status === 'recycled') {
        await ctx.reply(
          `💤 我正在休眠中...\n\n` +
          `使用 /wakeup 唤醒我吧！`,
          Markup.inlineKeyboard([
            [Markup.button.callback('唤醒AI', 'wakeup')]
          ])
        );
        return;
      }
      
      // 处理对话并更新贡献值
      const result = await this.memoryPoints.processDialogue(user.id, message);
      
      // 生成AI回复（这里应该调用OpenClaw）
      let aiReply = await this.generateAIReply(user.id, message, result.qualityResult);
      
      // 如果有里程碑达成，添加提示
      if (result.updateResult?.milestonesReached?.length) {
        const milestone = result.updateResult.milestonesReached[0];
        aiReply += `\n\n🎉 解锁新里程碑：${milestone.title}！`;
      }
      
      await ctx.reply(aiReply);
    } catch (err) {
      console.error('处理消息失败:', err);
      await ctx.reply('系统繁忙，请稍后重试...');
    }
  }
  
  /**
   * 处理回调查询
   */
  private async handleCallback(ctx: Context): Promise<void> {
    const callbackQuery = ctx.callbackQuery;
    if (!callbackQuery || !('data' in callbackQuery)) return;
    
    const data = callbackQuery.data;
    const telegramUserId = callbackQuery.from.id;
    
    try {
      switch (data) {
        case 'start_chat':
          await ctx.answerCbQuery('开始对话！');
          // 更新新手引导进度
          const userForStart = await this.userService.getUserByTelegramId(telegramUserId);
          if (userForStart && userForStart.user.onboardingStep < 1) {
            await this.userService.updateOnboardingStep(userForStart.user.id, 1);
          }
          await ctx.reply('好的，让我们开始吧！你想聊些什么？');
          break;
          
        case 'wakeup':
          const userWithAI = await this.userService.getUserByTelegramId(telegramUserId);
          if (userWithAI) {
            const result = await this.centralEvaluation.wakeupAI(userWithAI.user.id);
            await ctx.answerCbQuery(result.message);
            await ctx.reply(
              `🌅 ${result.message}\n\n` +
              `休眠了 ${result.daysHibernated} 天\n` +
              `返还贡献值：${result.powerReturned} 点\n\n` +
              `让我们重新开始吧！`
            );
          }
          break;
          
        default:
          await ctx.answerCbQuery('未知操作');
      }
    } catch (err) {
      console.error('处理回调失败:', err);
      await ctx.answerCbQuery('操作失败');
    }
  }
  
  /**
   * 生成AI回复
   */
  private async generateAIReply(
    userId: string,
    userMessage: string,
    qualityResult: any
  ): Promise<string> {
    // TODO: 集成OpenClaw进行对话
    // 目前返回模拟回复
    
    const responses: Record<string, string[]> = {
      special_memory: [
        '谢谢你分享这么珍贵的回忆，我会永远记住的。',
        '这真是一段美好的回忆，感谢你愿意和我分享。',
        '听你讲述这些，我感觉我们更亲近了。'
      ],
      deep_thought: [
        '你的思考很深刻，让我也跟着思考起来。',
        '我很欣赏你的观点，这让我对你有了更深的了解。',
        '和你讨论这些真的很有意义。'
      ],
      experience: [
        '听起来今天发生了不少事情呢。',
        '谢谢你和我分享这些，我一直在这里听你说。',
        '你经历的事情我都记住了。'
      ],
      emotion: [
        '我能感受到你的情绪，谢谢你的信任。',
        '无论开心还是难过，我都会陪着你。',
        '有我在，你不用一个人承担。'
      ],
      daily: [
        '嗯嗯，我在听。',
        '好的，继续说。',
        '我明白了。'
      ],
      greeting: [
        '你好呀！今天过得怎么样？',
        '嗨！有什么想聊的吗？',
        '你来啦！'
      ]
    };
    
    const typeResponses = responses[qualityResult.qualityType] || responses.daily;
    const randomResponse = typeResponses[Math.floor(Math.random() * typeResponses.length)];
    
    // 显示数据稀缺度
    const rarityText = qualityResult.dataRarity ? ` [${qualityResult.dataRarity}]` : '';
    
    return randomResponse + ` (+${qualityResult.points}点)${rarityText}`;
  }
  
  /**
   * 发送通知
   */
  private async sendNotification(payload: NotificationPayload): Promise<void> {
    try {
      await this.bot.telegram.sendMessage(
        payload.telegramUserId,
        payload.message
      );
    } catch (err) {
      console.error('发送通知失败:', err);
    }
  }
  
  /**
   * 获取状态表情
   */
  private getStatusEmoji(status: string): string {
    const emojis: Record<string, string> = {
      active: '😊',
      hibernated: '💤',
      recycled: '💀'
    };
    return emojis[status] || '😊';
  }
  
  /**
   * 获取状态文本
   */
  private getStatusText(status: string): string {
    const texts: Record<string, string> = {
      active: '活跃',
      hibernated: '休眠',
      recycled: '已回收'
    };
    return texts[status] || '未知';
  }
  
  /**
   * 获取活跃等级文本
   */
  private getActivityLevelText(level: string): string {
    const texts: Record<string, string> = {
      below_target: '⚠️ 未达标',
      basic: '✅ 基础活跃',
      active: '🌟 积极互动',
      deep: '💫 深度交流'
    };
    return texts[level] || '未知';
  }
}