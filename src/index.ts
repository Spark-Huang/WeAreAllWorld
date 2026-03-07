/**
 * 天下一家（WeAreAll.World）- 主入口
 */

import 'dotenv/config';
import { TelegramBotService } from './services/telegram-bot.service';
import { ScheduledTaskService } from './contribution-evaluation/services/scheduled-task.service';
import { createClient } from '@supabase/supabase-js';
import { app } from './api';

// 环境变量
const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY!;
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!;
const API_PORT = parseInt(process.env.API_PORT || '3000');

/**
 * 应用主类
 */
class Application {
  private botService?: TelegramBotService;
  private taskService?: ScheduledTaskService;
  
  /**
   * 启动应用
   */
  async start(): Promise<void> {
    console.log('========================================');
    console.log('  天下一家 (WeAreAll.World)');
    console.log('  版本: MVP v1.0');
    console.log('========================================\n');
    
    // 检查环境变量
    this.checkEnvironment();
    
    // 启动 REST API
    this.startApiServer();
    
    // 初始化定时任务服务
    console.log('初始化定时任务服务...');
    this.taskService = new ScheduledTaskService(
      SUPABASE_URL,
      SUPABASE_KEY,
      this.sendNotification.bind(this)
    );
    
    // 如果配置了Telegram Bot Token，启动Bot
    if (TELEGRAM_BOT_TOKEN) {
      console.log('启动Telegram Bot...');
      this.botService = new TelegramBotService({
        telegramToken: TELEGRAM_BOT_TOKEN,
        supabaseUrl: SUPABASE_URL,
        supabaseKey: SUPABASE_KEY
      });
      
      await this.botService.start();
    } else {
      console.log('⚠️  未配置TELEGRAM_BOT_TOKEN，跳过Bot启动');
      console.log('   仅运行API服务...\n');
    }
    
    // 启动定时任务
    this.taskService.startAllTasks();
    
    console.log('\n✅ 应用启动成功！');
    console.log('   - REST API: http://localhost:' + API_PORT);
    console.log('   - Supabase: 已连接');
    console.log('   - Telegram Bot: ' + (TELEGRAM_BOT_TOKEN ? '已启动' : '未配置'));
    console.log('   - 定时任务: 已启动\n');
  }
  
  /**
   * 启动 REST API 服务器
   */
  private startApiServer(): void {
    app.listen(API_PORT, () => {
      console.log(`🚀 REST API 服务已启动: http://localhost:${API_PORT}`);
      console.log(`   - 健康检查: http://localhost:${API_PORT}/health`);
      console.log(`   - API 文档: http://localhost:${API_PORT}/api/v1`);
    });
  }
  
  /**
   * 检查环境变量
   */
  private checkEnvironment(): void {
    const required = ['SUPABASE_URL', 'SUPABASE_ANON_KEY'];
    const missing = required.filter(key => !process.env[key]);
    
    if (missing.length > 0) {
      console.error('❌ 缺少必要的环境变量:', missing.join(', '));
      process.exit(1);
    }
    
    console.log('环境检查通过 ✓');
  }
  
  /**
   * 发送通知（由定时任务调用）
   */
  private async sendNotification(payload: {
    telegramUserId: number;
    message: string;
    type: string;
  }): Promise<void> {
    if (this.botService) {
      // Bot服务会处理通知
      return;
    }
    
    // 如果没有Bot服务，直接使用Telegram API
    if (!TELEGRAM_BOT_TOKEN || !payload.telegramUserId) {
      return;
    }
    
    try {
      const response = await fetch(
        `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: payload.telegramUserId,
            text: payload.message
          })
        }
      );
      
      if (!response.ok) {
        console.error('发送通知失败:', await response.text());
      }
    } catch (err) {
      console.error('发送通知异常:', err);
    }
  }
}

// 启动应用
const appInstance = new Application();
appInstance.start().catch(err => {
  console.error('应用启动失败:', err);
  process.exit(1);
});

// 优雅关闭
process.on('SIGINT', () => {
  console.log('\n正在关闭...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n正在关闭...');
  process.exit(0);
});