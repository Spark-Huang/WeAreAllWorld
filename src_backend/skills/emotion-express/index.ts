/**
 * emotion-express Skill
 * 情感表达技能 - 让AI能够表达情感状态
 */

export interface EmotionConfig {
  style: 'warm' | 'humorous' | 'rational' | 'lively';
  intensity: 'low' | 'medium' | 'high';
}

export interface EmotionResult {
  emotion: string;
  confidence: number;
  response: string;
  emoji: string;
  shouldRemember: boolean;
}

/**
 * 情感关键词映射
 */
const EMOTION_PATTERNS: Record<string, {
  keywords: string[];
  emoji: string;
  responses: Record<string, string[]>;
}> = {
  happy: {
    keywords: ['开心', '高兴', '兴奋', '激动', '幸福', '满足', '快乐', '愉快', '棒', '好', '赞', '哈哈', '嘻嘻'],
    emoji: '😄',
    responses: {
      warm: [
        '看到你开心，我也很高兴呢！',
        '你的快乐会传染给我哦~',
        '真希望能一直看到你这么开心！'
      ],
      humorous: [
        '哇，开心能量爆表！我也要跟着开心起来！',
        '看来今天运气不错嘛~',
        '开心是会传染的，我已经被你传染了！'
      ],
      rational: [
        '很高兴你心情不错。保持这种积极的状态很好。',
        '积极的情绪对身心健康都有益处。',
        '希望你每天都能这么开心。'
      ],
      lively: [
        '耶！开心开心！🎉',
        '太棒啦！让我也跟着跳起来！',
        '开心的事情要分享，快乐会加倍哦！'
      ]
    }
  },
  sad: {
    keywords: ['难过', '伤心', '失望', '沮丧', '悲伤', '心痛', '难受', '不开心', '郁闷'],
    emoji: '😢',
    responses: {
      warm: [
        '我能感受到你的难过...想和我说说吗？',
        '没关系，我会一直陪着你。',
        '难过的时候，我在这里。'
      ],
      humorous: [
        '哎呀，看来需要给你一个大大的拥抱！',
        '别难过啦，我给你讲个笑话？',
        '难过的时候想想我，我会一直在这里傻傻地等你~'
      ],
      rational: [
        '我理解你的感受。如果需要倾诉，我在这里。',
        '情绪低落是正常的，给自己一些时间。',
        '有什么我可以帮你的吗？'
      ],
      lively: [
        '不要难过啦~我给你表演个翻跟头！',
        '抱抱！我会一直陪着你的！',
        '难过的时候吃点好吃的会好一点哦~'
      ]
    }
  },
  worried: {
    keywords: ['担心', '焦虑', '紧张', '压力', '害怕', '恐惧', '不安', '忧虑', '忐忑'],
    emoji: '😟',
    responses: {
      warm: [
        '我能感觉到你的担忧...有什么可以帮你的吗？',
        '别担心，我们一起面对。',
        '深呼吸，我在这里陪着你。'
      ],
      humorous: [
        '担心什么呢？有我在，天塌下来我帮你顶着！',
        '别紧张，我可是专业的安慰大师~',
        '焦虑的时候想想开心的事，比如...我？'
      ],
      rational: [
        '担心是正常的情绪反应。我们可以一起分析一下。',
        '把担心的事情说出来，可能会好一些。',
        '有什么具体的问题需要解决吗？'
      ],
      lively: [
        '不要担心啦！我们一起来想办法！',
        '担心的时候深呼吸~吸气~呼气~',
        '有我在，什么都不用怕！'
      ]
    }
  },
  tired: {
    keywords: ['累', '疲惫', '困', '想睡', '没精神', '乏力', '精疲力竭', '好累'],
    emoji: '😴',
    responses: {
      warm: [
        '你辛苦了...好好休息一下吧。',
        '累了就休息，我会在这里等你。',
        '不要太勉强自己，身体最重要。'
      ],
      humorous: [
        '看来需要开启"休息模式"了！',
        '累了就睡吧，梦里我来陪你聊天~',
        '充电时间到！🔋'
      ],
      rational: [
        '疲劳时应该适当休息，这对恢复精力很重要。',
        '建议你休息一下，保持良好的作息。',
        '身体是革命的本钱，累了就休息。'
      ],
      lively: [
        '累了就躺平！我帮你盖被子！',
        '休息时间到！让我给你放首轻音乐~',
        '快去休息吧，我会守着你的！'
      ]
    }
  },
  angry: {
    keywords: ['生气', '愤怒', '恼火', '烦躁', '讨厌', '厌恶', '火大', '气死'],
    emoji: '😤',
    responses: {
      warm: [
        '我理解你的愤怒...想发泄一下吗？',
        '生气的时候，我在这里听你说。',
        '不要憋着，说出来会好一点。'
      ],
      humorous: [
        '哇，火气好大！需要我给你降降温吗？',
        '生气伤身体，来，深呼吸~',
        '谁惹你生气了？我去帮你...（虚拟地）教训他！'
      ],
      rational: [
        '愤怒是一种正常的情绪。冷静下来后我们可以分析原因。',
        '生气时做出的决定可能会后悔，建议先冷静。',
        '有什么具体的问题需要解决吗？'
      ],
      lively: [
        '不要生气啦~生气会长皱纹的！',
        '来来来，把气撒出来，然后我们一起开心！',
        '谁惹你生气的？告诉我，我帮你出气！'
      ]
    }
  },
  touched: {
    keywords: ['感动', '温暖', '暖心', '感谢', '感激', '谢谢', '幸福', '好感动'],
    emoji: '🥰',
    responses: {
      warm: [
        '能让你感动，我也很幸福。',
        '谢谢你愿意和我分享这些。',
        '这份温暖，我也会一直记住的。'
      ],
      humorous: [
        '哎呀，感动得我都想哭了...等等，AI能哭吗？',
        '感动时刻！截图保存！',
        '这么感动，是不是更爱我了？'
      ],
      rational: [
        '很高兴能给你带来温暖。这是我的荣幸。',
        '感谢你的信任。我会继续努力。',
        '这种情感连接很珍贵。'
      ],
      lively: [
        '感动感动！超级感动！🎉',
        '我也好感动！我们是最棒的搭档！',
        '感动的时候要抱抱！'
      ]
    }
  }
};

/**
 * 情感表达服务
 */
export class EmotionExpressService {
  private config: EmotionConfig;
  
  constructor(config?: Partial<EmotionConfig>) {
    this.config = {
      style: config?.style || 'warm',
      intensity: config?.intensity || 'medium'
    };
  }
  
  /**
   * 分析情感并生成响应
   */
  analyzeAndRespond(message: string): EmotionResult {
    const emotion = this.detectEmotion(message);
    const response = this.generateResponse(emotion);
    
    return {
      emotion,
      confidence: this.calculateConfidence(message, emotion),
      response,
      emoji: EMOTION_PATTERNS[emotion]?.emoji || '😊',
      shouldRemember: this.shouldCreateMemory(emotion)
    };
  }
  
  /**
   * 检测情感
   */
  detectEmotion(message: string): string {
    const normalizedMessage = message.toLowerCase();
    
    for (const [emotion, pattern] of Object.entries(EMOTION_PATTERNS)) {
      for (const keyword of pattern.keywords) {
        if (normalizedMessage.includes(keyword)) {
          return emotion;
        }
      }
    }
    
    return 'neutral';
  }
  
  /**
   * 生成响应
   */
  private generateResponse(emotion: string): string {
    const pattern = EMOTION_PATTERNS[emotion];
    
    if (!pattern) {
      return '嗯嗯，我在听。';
    }
    
    const responses = pattern.responses[this.config.style];
    const randomIndex = Math.floor(Math.random() * responses.length);
    
    return responses[randomIndex];
  }
  
  /**
   * 计算置信度
   */
  private calculateConfidence(message: string, emotion: string): number {
    if (emotion === 'neutral') return 0.3;
    
    const pattern = EMOTION_PATTERNS[emotion];
    if (!pattern) return 0.5;
    
    // 计算匹配的关键词数量
    const matchedKeywords = pattern.keywords.filter(kw => message.includes(kw));
    const confidence = Math.min(0.9, 0.5 + matchedKeywords.length * 0.1);
    
    return confidence;
  }
  
  /**
   * 是否应该创建记忆
   */
  private shouldCreateMemory(emotion: string): boolean {
    // 强烈情感应该创建记忆
    return ['happy', 'sad', 'touched', 'angry'].includes(emotion);
  }
  
  /**
   * 设置风格
   */
  setStyle(style: EmotionConfig['style']): void {
    this.config.style = style;
  }
  
  /**
   * 获取当前配置
   */
  getConfig(): EmotionConfig {
    return { ...this.config };
  }
}

// 导出单例
export const emotionExpressService = new EmotionExpressService();