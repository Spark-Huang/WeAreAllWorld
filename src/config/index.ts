/**
 * 共生世界（WeAreAll.World）- 配置服务
 */

export interface AppConfig {
  supabase: {
    url: string;
    anonKey: string;
    serviceKey?: string;
  };
  telegram: {
    botToken?: string;
  };
  openclaw: {
    apiUrl?: string;
    apiKey?: string;
  };
  llm: {
    provider: string;
    model: string;
    apiKey?: string;
    apiBase?: string;
  };
  game: {
    weeklyThreshold: number;
    decayAmount: number;
    maxWarnings: number;
  };
}

/**
 * 默认游戏配置
 */
const DEFAULT_GAME_CONFIG = {
  weeklyThreshold: 15,    // 每周最低贡献值要求
  decayAmount: 2,         // 休眠时每天衰减点数
  maxWarnings: 2          // 最大连续警告次数
};

/**
 * 加载配置
 */
export function loadConfig(): AppConfig {
  return {
    supabase: {
      url: process.env.SUPABASE_URL || '',
      anonKey: process.env.SUPABASE_ANON_KEY || '',
      serviceKey: process.env.SUPABASE_SERVICE_KEY
    },
    telegram: {
      botToken: process.env.TELEGRAM_BOT_TOKEN
    },
    openclaw: {
      apiUrl: process.env.OPENCLAW_API_URL,
      apiKey: process.env.OPENCLAW_API_KEY
    },
    llm: {
      provider: process.env.LLM_PROVIDER || 'openai',
      model: process.env.LLM_MODEL || 'gpt-4o-mini',
      apiKey: process.env.LLM_API_KEY,
      apiBase: process.env.LLM_API_BASE
    },
    game: DEFAULT_GAME_CONFIG
  };
}

/**
 * 验证配置
 */
export function validateConfig(config: AppConfig): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  
  if (!config.supabase.url) {
    errors.push('SUPABASE_URL is required');
  }
  
  if (!config.supabase.anonKey) {
    errors.push('SUPABASE_ANON_KEY is required');
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * 获取游戏配置
 */
export function getGameConfig() {
  return DEFAULT_GAME_CONFIG;
}