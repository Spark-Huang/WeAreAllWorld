/**
 * 天下一家（WeAreAll.World）- 贡献值质量判定服务
 * 
 * 核心功能：判定对话质量并计算贡献值
 * 
 * 质量类型和点数：
 * - special_memory (+8): 特殊回忆（童年、重要人生事件）
 * - deep_thinking (+5): 深度思考（观点、看法、价值观）
 * - share_experience (+4): 分享经历（今天发生的事）
 * - emotion_expression (+3): 情感表达（开心、难过、担心）
 * - daily_chat (+2): 日常对话
 * - daily_greeting (+1): 日常问候
 */

export interface QualityResult {
  qualityType: string;
  points: number;
  reason: string;
  emotionDetected: string;
  keyInfo: string | null;
  shouldCreateMemory: boolean;
  memoryContent: string | null;
  dataRarity: string;  // 数据稀缺度评级
}

export interface QualityRule {
  type: string;
  keywords: string[];
  minLength: number;
  maxLength?: number;
  points: number;
  reason: string;
  priority: number;
  dataRarity: string;  // 数据稀缺度评级
}

/**
 * 质量判定规则（按优先级排序）
 */
const QUALITY_RULES: QualityRule[] = [
  // 特殊回忆（最高优先级）
  {
    type: 'special_memory',
    keywords: ['童年', '小时候', '回忆', '记得那时', '第一次', '最重要', '最难忘', '印象最深', '成长经历', '人生转折'],
    minLength: 15,
    points: 8,
    reason: '分享了特殊回忆',
    priority: 100,
    dataRarity: '[绝版·专属生命记忆]'
  },
  
  // 深度思考
  {
    type: 'deep_thought',
    keywords: ['我认为', '我觉得', '观点', '看法', '思考', '理解', '感悟', '体会', '人生意义', '价值观', '信仰', '理想'],
    minLength: 20,
    points: 5,
    reason: '分享了深度思考',
    priority: 80,
    dataRarity: '[典藏级·人类独有思维特征]'
  },
  
  // 分享经历
  {
    type: 'experience',
    keywords: ['今天', '昨天', '前天', '工作', '学习', '发生', '遇到', '经历', '做了', '去了', '参加了'],
    minLength: 15,
    points: 4,
    reason: '分享了经历',
    priority: 60,
    dataRarity: '[珍贵·人类行为样本]'
  },
  
  // 情感表达
  {
    type: 'emotion',
    keywords: ['开心', '高兴', '难过', '伤心', '累', '疲惫', '压力', '担心', '焦虑', '害怕', '恐惧', '生气', '愤怒', '失望', '沮丧', '兴奋', '激动', '感动', '幸福', '满足'],
    minLength: 5,
    points: 3,
    reason: '表达了情感',
    priority: 40,
    dataRarity: '[稀有·真实情感图谱]'
  },
  
  // 日常对话
  {
    type: 'daily',
    keywords: [],
    minLength: 1,
    points: 2,
    reason: '日常对话',
    priority: 20,
    dataRarity: '活跃数据'
  },
  
  // 日常问候（最低优先级）
  {
    type: 'greeting',
    keywords: ['早安', '晚安', '早上好', '晚上好', '你好', '在吗', '嗨', 'hi', 'hello'],
    minLength: 1,
    maxLength: 20,
    points: 1,
    reason: '日常问候',
    priority: 10,
    dataRarity: '普通数据'
  }
];

/**
 * 情感关键词映射
 */
const EMOTION_KEYWORDS: Record<string, string[]> = {
  happy: ['开心', '高兴', '兴奋', '激动', '幸福', '满足', '快乐', '愉快', '棒', '好', '赞'],
  sad: ['难过', '伤心', '失望', '沮丧', '悲伤', '心痛', '难受'],
  worried: ['担心', '焦虑', '紧张', '压力', '害怕', '恐惧', '不安', '忧虑'],
  tired: ['累', '疲惫', '困', '想睡', '没精神', '乏力', '精疲力竭'],
  angry: ['生气', '愤怒', '恼火', '烦躁', '讨厌', '厌恶', '火大'],
  touched: ['感动', '温暖', '暖心', '感谢', '感激', '谢谢']
};

/**
 * 贡献值质量判定服务
 */
export class QualityJudgeService {
  
  /**
   * 判定对话质量
   * @param message 用户消息
   * @param conversationHistory 对话历史（可选，用于上下文理解）
   * @returns 质量判定结果
   */
  calculateQuality(message: string, conversationHistory?: string[]): QualityResult {
    // 预处理消息
    const normalizedMessage = this.normalizeMessage(message);
    
    // 按优先级检查规则
    const sortedRules = [...QUALITY_RULES].sort((a, b) => b.priority - a.priority);
    
    for (const rule of sortedRules) {
      if (this.matchesRule(normalizedMessage, rule)) {
        const emotionDetected = this.detectEmotion(normalizedMessage);
        const keyInfo = this.extractKeyInfo(normalizedMessage, rule.type);
        const shouldCreateMemory = this.shouldCreateMemory(rule.type, normalizedMessage);
        
        return {
          qualityType: rule.type,
          points: rule.points,
          reason: rule.reason,
          emotionDetected,
          keyInfo,
          shouldCreateMemory,
          memoryContent: shouldCreateMemory ? this.generateMemoryContent(normalizedMessage, rule.type) : null,
          dataRarity: rule.dataRarity
        };
      }
    }
    
    // 默认返回日常对话
    return {
      qualityType: 'daily',
      points: 2,
      reason: '日常对话',
      emotionDetected: 'neutral',
      keyInfo: null,
      shouldCreateMemory: false,
      memoryContent: null,
      dataRarity: '活跃数据'
    };
  }
  
  /**
   * 检查消息是否匹配规则
   */
  private matchesRule(message: string, rule: QualityRule): boolean {
    const hasKeyword = rule.keywords.some(keyword => 
      message.toLowerCase().includes(keyword.toLowerCase())
    );
    
    const meetsMinLength = message.length >= rule.minLength;
    const meetsMaxLength = !rule.maxLength || message.length <= rule.maxLength;
    
    return hasKeyword && meetsMinLength && meetsMaxLength;
  }
  
  /**
   * 检测情感
   */
  private detectEmotion(message: string): string {
    for (const [emotion, keywords] of Object.entries(EMOTION_KEYWORDS)) {
      if (keywords.some(keyword => message.includes(keyword))) {
        return emotion;
      }
    }
    return 'neutral';
  }
  
  /**
   * 提取关键信息
   */
  private extractKeyInfo(message: string, qualityType: string): string | null {
    // 简化实现：返回消息的前50个字符
    if (message.length <= 50) {
      return message;
    }
    return message.substring(0, 50) + '...';
  }
  
  /**
   * 判断是否应该创建记忆
   */
  private shouldCreateMemory(qualityType: string, message: string): boolean {
    // 特殊回忆和深度思考应该创建记忆
    if (['special_memory', 'deep_thought'].includes(qualityType)) {
      return true;
    }
    
    // 分享经历且消息较长，也应该创建记忆
    if (qualityType === 'experience' && message.length >= 30) {
      return true;
    }
    
    return false;
  }
  
  /**
   * 生成记忆内容
   */
  private generateMemoryContent(message: string, qualityType: string): string {
    const typeLabels: Record<string, string> = {
      special_memory: '特殊回忆',
      deep_thinking: '深度思考',
      share_experience: '重要经历'
    };
    
    return `[${typeLabels[qualityType] || '记忆'}] ${message}`;
  }
  
  /**
   * 预处理消息
   */
  private normalizeMessage(message: string): string {
    // 移除多余空格
    return message.trim().replace(/\s+/g, ' ');
  }
  
  /**
   * 获取质量类型说明
   */
  getQualityTypeDescription(qualityType: string): string {
    const descriptions: Record<string, string> = {
      special_memory: '特殊回忆（+8点）- 分享了童年回忆或重要人生事件',
      deep_thinking: '深度思考（+5点）- 分享了观点、看法或价值观',
      share_experience: '分享经历（+4点）- 分享了今天发生的事情',
      emotion_expression: '情感表达（+3点）- 表达了情感状态',
      daily_chat: '日常对话（+2点）- 普通的日常交流',
      daily_greeting: '日常问候（+1点）- 简单的问候'
    };
    
    return descriptions[qualityType] || '未知类型';
  }
  
  /**
   * 获取所有质量规则（用于调试或展示）
   */
  getAllRules(): QualityRule[] {
    return [...QUALITY_RULES];
  }
}

// 导出单例
export const qualityJudgeService = new QualityJudgeService();