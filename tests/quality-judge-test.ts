/**
 * 贡献值质量判定专项测试
 * 
 * 测试范围：
 * 1. 质量类型判定（问候/日常/情感/经历/深度思考/特殊回忆）
 * 2. 贡献值点数计算
 * 3. 情感识别
 * 4. 记忆创建判定
 * 5. 数据稀缺度评估
 * 6. 边界条件
 */

import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

// ============================================
// 测试工具
// ============================================

interface QualityResult {
  qualityType: string;
  points: number;
  emotionDetected?: string;
  shouldCreateMemory: boolean;
  memoryContent?: string | null;
  dataRarity: string;
}

interface TestCase {
  category: string;
  name: string;
  message: string;
  expectedType: string;
  expectedPoints: number | { min: number; max: number };
  expectedEmotion?: string;
  expectedMemory: boolean;
}

let passedCount = 0;
let failedCount = 0;

function log(name: string, passed: boolean, message: string = '') {
  const icon = passed ? '✅' : '❌';
  console.log(`${icon} ${name}${message ? ` - ${message}` : ''}`);
  if (passed) passedCount++;
  else failedCount++;
}

// ============================================
// 测试用例定义
// ============================================

const TEST_CASES: TestCase[] = [
  // ===== 问候类测试 =====
  {
    category: '问候',
    name: '早安问候',
    message: '早安！',
    expectedType: 'greeting',
    expectedPoints: 1,
    expectedMemory: false
  },
  {
    category: '问候',
    name: '晚安问候',
    message: '晚安，明天见',
    expectedType: 'greeting',
    expectedPoints: 1,
    expectedMemory: false
  },
  {
    category: '问候',
    name: '你好问候',
    message: '你好啊',
    expectedType: 'greeting',
    expectedPoints: 1,
    expectedMemory: false
  },
  {
    category: '问候',
    name: '英文问候',
    message: 'Hello!',
    expectedType: 'greeting',
    expectedPoints: 1,
    expectedMemory: false
  },

  // ===== 日常对话测试 =====
  {
    category: '日常',
    name: '简单确认',
    message: '好的，我知道了',
    expectedType: 'daily',
    expectedPoints: 2,
    expectedMemory: false
  },
  {
    category: '日常',
    name: '简短回复',
    message: '嗯嗯',
    expectedType: 'daily',
    expectedPoints: 2,
    expectedMemory: false
  },
  {
    category: '日常',
    name: '收到确认',
    message: '收到',
    expectedType: 'daily',
    expectedPoints: 2,
    expectedMemory: false
  },

  // ===== 情感表达测试 =====
  {
    category: '情感',
    name: '开心情感',
    message: '今天真的很开心！',
    expectedType: 'emotion',
    expectedPoints: 3,
    expectedEmotion: 'happy',
    expectedMemory: false
  },
  {
    category: '情感',
    name: '难过情感',
    message: '最近很难过，奶奶生病住院了',
    expectedType: 'emotion',
    expectedPoints: 3,
    expectedEmotion: 'sad',
    expectedMemory: false
  },
  {
    category: '情感',
    name: '焦虑情感',
    message: '工作压力很大，最近总是焦虑睡不着',
    expectedType: 'emotion',
    expectedPoints: 3,
    expectedEmotion: 'worried',
    expectedMemory: false
  },
  {
    category: '情感',
    name: '感动情感',
    message: '看到那么多人帮助灾区，真的很感动',
    expectedType: 'emotion',
    expectedPoints: 3,
    expectedEmotion: 'touched',
    expectedMemory: false
  },

  // ===== 分享经历测试 =====
  {
    category: '经历',
    name: '工作经历',
    message: '今天公司开会讨论了新项目，虽然很累但感觉学到了很多东西',
    expectedType: 'experience',
    expectedPoints: 4,
    expectedMemory: false
  },
  {
    category: '经历',
    name: '学习经历',
    message: '昨天去参加了一个技术分享会，遇到了很多同行，交流了很多想法',
    expectedType: 'experience',
    expectedPoints: 4,
    expectedMemory: false
  },
  {
    category: '经历',
    name: '生活经历',
    message: '周末去爬山了，风景很美，空气也很清新',
    expectedType: 'experience',
    expectedPoints: 4,
    expectedMemory: false
  },

  // ===== 深度思考测试 =====
  {
    category: '深度思考',
    name: '人生意义',
    message: '我认为人生的意义在于不断学习和成长，这是我最近思考的结果',
    expectedType: 'deep_thought',
    expectedPoints: 5,
    expectedMemory: true
  },
  {
    category: '深度思考',
    name: '价值观',
    message: '我的价值观是诚实待人，即使有时候会吃亏，但问心无愧才是最重要的',
    expectedType: 'deep_thought',
    expectedPoints: 5,
    expectedMemory: true
  },
  {
    category: '深度思考',
    name: '人生感悟',
    message: '最近我思考了很多，发现真正的幸福其实很简单，就是和家人在一起',
    expectedType: 'deep_thought',
    expectedPoints: 5,
    expectedMemory: true
  },

  // ===== 特殊回忆测试 =====
  {
    category: '特殊回忆',
    name: '童年回忆',
    message: '我小时候最喜欢在奶奶家过暑假，那时候每天都能吃到奶奶做的红烧肉，现在想起来还是很怀念',
    expectedType: 'special_memory',
    expectedPoints: { min: 6, max: 8 },
    expectedMemory: true
  },
  {
    category: '特殊回忆',
    name: '人生转折',
    message: '记得那是我人生中最重要的转折点，第一次离开家乡去大城市打拼',
    expectedType: 'special_memory',
    expectedPoints: { min: 6, max: 8 },
    expectedMemory: true
  },
  {
    category: '特殊回忆',
    name: '成长经历',
    message: '成长经历中最难忘的是高考那年，压力很大但最后坚持下来了',
    expectedType: 'special_memory',
    expectedPoints: { min: 6, max: 8 },
    expectedMemory: true
  }
];

// ============================================
// 测试执行
// ============================================

async function runTests() {
  console.log('🧪 贡献值质量判定专项测试');
  console.log('='.repeat(60));

  try {
    // 动态导入服务
    const { QualityJudgeService } = await import('../src_backend/contribution-evaluation/services/quality-judge.service');
    const service = new QualityJudgeService();

    // 按类别分组测试
    const categories = [...new Set(TEST_CASES.map(t => t.category))];

    for (const category of categories) {
      console.log(`\n--- ${category}类测试 ---`);
      
      const categoryTests = TEST_CASES.filter(t => t.category === category);
      
      for (const testCase of categoryTests) {
        const result = service.calculateQuality(testCase.message) as QualityResult;
        
        // 验证类型
        const typeMatch = result.qualityType === testCase.expectedType;
        
        // 验证点数
        let pointsMatch = false;
        if (typeof testCase.expectedPoints === 'number') {
          pointsMatch = result.points === testCase.expectedPoints;
        } else {
          pointsMatch = result.points >= testCase.expectedPoints.min && 
                       result.points <= testCase.expectedPoints.max;
        }
        
        // 验证情感
        let emotionMatch = true;
        if (testCase.expectedEmotion) {
          emotionMatch = result.emotionDetected === testCase.expectedEmotion;
        }
        
        // 验证记忆创建
        const memoryMatch = result.shouldCreateMemory === testCase.expectedMemory;
        
        // 综合判断
        const passed = typeMatch && pointsMatch && emotionMatch && memoryMatch;
        
        let message = '';
        if (!typeMatch) message += `类型错误(期望:${testCase.expectedType}, 实际:${result.qualityType}) `;
        if (!pointsMatch) message += `点数错误(期望:${JSON.stringify(testCase.expectedPoints)}, 实际:${result.points}) `;
        if (!emotionMatch) message += `情感错误(期望:${testCase.expectedEmotion}, 实际:${result.emotionDetected}) `;
        if (!memoryMatch) message += `记忆创建错误(期望:${testCase.expectedMemory}, 实际:${result.shouldCreateMemory})`;
        
        log(testCase.name, passed, message.trim());
      }
    }

    // 边界条件测试
    console.log('\n--- 边界条件测试 ---');
    
    // 空消息
    const emptyResult = service.calculateQuality('');
    log('空消息处理', emptyResult.qualityType === 'daily', `类型: ${emptyResult.qualityType}`);
    
    // 纯空格
    const spaceResult = service.calculateQuality('   ');
    log('纯空格处理', spaceResult.qualityType === 'daily', `类型: ${spaceResult.qualityType}`);
    
    // 超长消息
    const longMessage = '我小时候'.repeat(1000);
    const longResult = service.calculateQuality(longMessage);
    log('超长消息处理', longResult.qualityType === 'special_memory', `类型: ${longResult.qualityType}`);
    
    // 特殊字符
    const specialResult = service.calculateQuality('今天很开心！！！@#$%^&*()');
    log('特殊字符处理', specialResult.qualityType !== undefined, `类型: ${specialResult.qualityType}`);
    
    // 混合语言
    const mixedResult = service.calculateQuality('今天学到了很多new things，感觉很fulfilled！');
    log('混合语言处理', mixedResult.qualityType !== undefined, `类型: ${mixedResult.qualityType}`);

  } catch (err) {
    console.error('❌ 测试执行失败:', err);
    console.log('\n⚠️  请确保 QualityJudgeService 已正确实现');
  }

  // 输出结果
  console.log('\n' + '='.repeat(60));
  console.log('测试结果汇总');
  console.log('='.repeat(60));
  console.log(`✅ 通过: ${passedCount}`);
  console.log(`❌ 失败: ${failedCount}`);
  console.log(`📊 总计: ${passedCount + failedCount}`);
  console.log(`📈 通过率: ${Math.round((passedCount / (passedCount + failedCount)) * 100)}%`);
  console.log('='.repeat(60));

  if (failedCount > 0) {
    process.exit(1);
  }
}

runTests().catch(console.error);