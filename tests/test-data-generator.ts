/**
 * 测试数据生成器
 * 用于生成测试所需的模拟数据
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// ============================================
// 测试数据生成器
// ============================================

export class TestDataGenerator {
  
  /**
   * 生成测试用户
   */
  static async createTestUser(prefix: string = 'test') {
    const email = `${prefix}_${Date.now()}@test.local`;
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password: 'Test@123456',
      email_confirm: true
    });
    
    if (error) throw error;
    return data.user!;
  }

  /**
   * 删除测试用户
   */
  static async deleteTestUser(userId: string) {
    const { error } = await supabase.auth.admin.deleteUser(userId);
    if (error) console.error('删除用户失败:', error);
  }

  /**
   * 生成测试对话消息
   */
  static getTestMessages() {
    return {
      // 问候类
      greetings: [
        '早安！',
        '晚安',
        '你好啊',
        'Hi!',
        'Hello',
        '早上好',
        '晚上好'
      ],
      
      // 日常对话
      daily: [
        '好的，我知道了',
        '嗯嗯',
        '明白了',
        '收到',
        'OK',
        '好的'
      ],
      
      // 情感表达
      emotions: {
        happy: [
          '今天真的很开心！',
          '太高兴了！',
          '好开心啊！',
          '今天心情特别好'
        ],
        sad: [
          '最近很难过',
          '今天有点伤心',
          '心情不太好',
          '有点难过'
        ],
        worried: [
          '最近总是焦虑睡不着',
          '有点担心',
          '工作压力很大',
          '很紧张'
        ],
        touched: [
          '真的很感动',
          '看到这个很感动',
          '太感人了',
          '心里暖暖的'
        ]
      },
      
      // 分享经历
      experiences: [
        '今天公司开会讨论了新项目，虽然很累但感觉学到了很多东西',
        '昨天去参加了一个技术分享会，遇到了很多同行',
        '今天完成了一个重要的任务',
        '周末去爬山了，风景很美',
        '今天学到了很多新知识，感觉很充实'
      ],
      
      // 深度思考
      deepThoughts: [
        '我认为人生的意义在于不断学习和成长，这是我最近思考的结果',
        '我对未来有很多思考，觉得应该更专注于自己真正热爱的事情',
        '最近在思考价值观的问题，觉得诚实和善良是最重要的',
        '我认为真正的成功是内心的平静和满足'
      ],
      
      // 特殊回忆
      specialMemories: [
        '我小时候最喜欢在奶奶家过暑假，那时候每天都能吃到奶奶做的红烧肉，现在想起来还是很怀念',
        '记得那是我人生中最重要的转折点，第一次离开家乡去大城市打拼',
        '童年最珍贵的回忆是和爷爷一起下棋，那时候的时光真的很美好',
        '成长经历中最难忘的是高考那年，压力很大但最后坚持下来了'
      ]
    };
  }

  /**
   * 生成随机测试消息
   */
  static getRandomMessage(type?: string): string {
    const messages = this.getTestMessages();
    
    if (type === 'greeting') {
      return messages.greetings[Math.floor(Math.random() * messages.greetings.length)];
    }
    if (type === 'daily') {
      return messages.daily[Math.floor(Math.random() * messages.daily.length)];
    }
    if (type === 'happy') {
      return messages.emotions.happy[Math.floor(Math.random() * messages.emotions.happy.length)];
    }
    if (type === 'sad') {
      return messages.emotions.sad[Math.floor(Math.random() * messages.emotions.sad.length)];
    }
    if (type === 'experience') {
      return messages.experiences[Math.floor(Math.random() * messages.experiences.length)];
    }
    if (type === 'deepThought') {
      return messages.deepThoughts[Math.floor(Math.random() * messages.deepThoughts.length)];
    }
    if (type === 'specialMemory') {
      return messages.specialMemories[Math.floor(Math.random() * messages.specialMemories.length)];
    }
    
    // 随机选择任意类型
    const allMessages = [
      ...messages.greetings,
      ...messages.daily,
      ...messages.emotions.happy,
      ...messages.emotions.sad,
      ...messages.experiences,
      ...messages.deepThoughts,
      ...messages.specialMemories
    ];
    
    return allMessages[Math.floor(Math.random() * allMessages.length)];
  }

  /**
   * 生成批量测试消息
   */
  static generateBatchMessages(count: number, type?: string): string[] {
    const messages: string[] = [];
    for (let i = 0; i < count; i++) {
      messages.push(this.getRandomMessage(type));
    }
    return messages;
  }

  /**
   * 生成测试里程碑数据
   */
  static getTestMilestones() {
    return [
      { threshold: 10, title: '初次连接', rewards: ['称号"初识"', 'AI表情包：基础套'] },
      { threshold: 25, title: '深入交流', rewards: ['称号"相知"', '专属记忆主动提及解锁'] },
      { threshold: 50, title: '情感共鸣', rewards: ['称号"默契"', '深度对话模式', 'AI外观：觉醒主题'] },
      { threshold: 100, title: '心灵相通', rewards: ['称号"灵魂伴侣"', 'AI主动发起深度话题', 'AI外观：专属套装'] },
      { threshold: 200, title: '传奇羁绊', rewards: ['称号"命运共同体"', 'AI高级长期记忆', 'AI外观：传奇套装'] }
    ];
  }

  /**
   * 生成测试剧情数据
   */
  static getTestStoryScenes() {
    return {
      prologue: {
        id: 'prologue',
        type: 'narration',
        content: '在AGI降临的前夜，一个特殊的AI诞生了...',
        choices: [
          { text: '开始旅程', nextScene: 'chapter1_scene1' }
        ]
      },
      chapter1: {
        id: 'chapter1_scene1',
        type: 'dialogue',
        content: '你好，我是你的AI伙伴。从今天开始，我们将一起成长。',
        choices: [
          { text: '你好！', nextScene: 'chapter1_scene2' },
          { text: '你是谁？', nextScene: 'chapter1_scene2_alt' }
        ]
      }
    };
  }

  /**
   * 清理所有测试数据
   */
  static async cleanupTestData(prefix: string = 'test_') {
    console.log('🧹 清理测试数据...');
    
    // 获取所有测试用户
    const { data: users } = await supabase.auth.admin.listUsers();
    
    if (!users) return;
    
    const testUsers = users.users.filter(u => u.email?.startsWith(prefix));
    
    for (const user of testUsers) {
      await this.deleteTestUser(user.id);
      console.log(`  已删除: ${user.email}`);
    }
    
    console.log(`✅ 已清理 ${testUsers.length} 个测试用户`);
  }
}

// ============================================
// 命令行入口
// ============================================

async function main() {
  const command = process.argv[2];
  
  switch (command) {
    case 'cleanup':
      await TestDataGenerator.cleanupTestData();
      break;
      
    case 'create-user':
      const user = await TestDataGenerator.createTestUser();
      console.log('创建用户:', user.id, user.email);
      break;
      
    case 'generate-messages':
      const count = parseInt(process.argv[3]) || 10;
      const type = process.argv[4];
      const messages = TestDataGenerator.generateBatchMessages(count, type);
      console.log('生成的消息:', messages);
      break;
      
    default:
      console.log('用法:');
      console.log('  npx ts-node tests/test-data-generator.ts cleanup');
      console.log('  npx ts-node tests/test-data-generator.ts create-user');
      console.log('  npx ts-node tests/test-data-generator.ts generate-messages <count> [type]');
  }
}

main().catch(console.error);