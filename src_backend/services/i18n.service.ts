/**
 * 后端国际化服务
 */

export type Language = 'en' | 'zh';

const translations = {
  en: {
    // 错误消息
    errors: {
      unauthorized: 'Unauthorized access',
      notFound: 'Not found',
      serverError: 'Server error',
      invalidInput: 'Invalid input',
      rateLimited: 'Too many requests, please try again later',
    },
    // 成功消息
    success: {
      checkin: 'Check-in successful! +{{points}} contribution',
      share: 'Share successful! +{{points}} contribution',
      saved: 'Saved successfully',
    },
    // AI 消息
    ai: {
      greeting: 'Hello! How can I help you today?',
      thinking: 'Let me think about that...',
      farewell: 'Goodbye! See you next time!',
    },
  },
  zh: {
    errors: {
      unauthorized: '未授权访问',
      notFound: '未找到',
      serverError: '服务器错误',
      invalidInput: '输入无效',
      rateLimited: '请求过于频繁，请稍后重试',
    },
    success: {
      checkin: '签到成功！+{{points}} 贡献值',
      share: '分享成功！+{{points}} 贡献值',
      saved: '保存成功',
    },
    ai: {
      greeting: '你好！今天有什么可以帮你的？',
      thinking: '让我想想...',
      farewell: '再见！下次见！',
    },
  },
};

export class I18nService {
  private lang: Language = 'en';

  setLanguage(lang: Language) {
    this.lang = lang;
  }

  getLanguage(): Language {
    return this.lang;
  }

  /**
   * 获取翻译文本
   * @param key 翻译键，如 'errors.unauthorized'
   * @param params 替换参数，如 { points: 10 }
   */
  t(key: string, params?: Record<string, string | number>): string {
    const keys = key.split('.');
    let result: unknown = translations[this.lang];
    
    for (const k of keys) {
      result = (result as Record<string, unknown>)?.[k];
    }
    
    if (typeof result !== 'string') {
      return key;
    }
    
    // 替换参数
    if (params) {
      return result.replace(/\{\{(\w+)\}\}/g, (_, name) => 
        String(params[name] ?? `{{${name}}}`)
      );
    }
    
    return result;
  }
}

export const i18nService = new I18nService();
