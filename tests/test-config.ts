/**
 * 测试配置
 */

export const TEST_CONFIG = {
  // API 配置
  API_BASE: process.env.API_BASE || 'http://localhost:3000/api/v1',
  API_KEY: process.env.API_KEY || 'weareallworld_dev_key_2026',
  
  // Supabase 配置
  SUPABASE_URL: process.env.SUPABASE_URL!,
  SUPABASE_SERVICE_KEY: process.env.SUPABASE_SERVICE_KEY!,
  
  // 测试用户配置
  TEST_USER_PREFIX: 'test_',
  TEST_USER_PASSWORD: 'Test@123456',
  
  // 超时配置
  DEFAULT_TIMEOUT: 30000,
  DIALOGUE_TIMEOUT: 60000,
  
  // 清理配置
  CLEANUP_AFTER_TEST: true,
};

// 测试工具函数
export function generateTestEmail(): string {
  return `test_${Date.now()}_${Math.random().toString(36).slice(2, 7)}@test.local`;
}

export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function log(message: string, type: 'info' | 'success' | 'error' = 'info'): void {
  const prefix = {
    info: 'ℹ️',
    success: '✅',
    error: '❌'
  }[type];
  console.log(`${prefix} ${message}`);
}
