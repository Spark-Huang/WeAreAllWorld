/**
 * 大同世界（WeAreAll.World）- 全面测试套件 v2.1
 * 
 * 修复 TypeScript 类型问题
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

// ============================================
// 配置
// ============================================

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || '';
const API_BASE = process.env.API_BASE || 'http://localhost:3000/api/v1';
const API_KEY = process.env.API_KEY || 'weareallworld_dev_key_2026';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// ============================================
// 测试工具
// ============================================

interface TestResult {
  category: string;
  name: string;
  passed: boolean;
  message: string;
  severity: string;
  duration: number;
}

class TestRunner {
  private results: TestResult[] = [];
  private passedCount = 0;
  private failedCount = 0;

  async test(
    category: string,
    name: string,
    fn: () => Promise<boolean>,
    severity: string = 'medium'
  ): Promise<void> {
    const startTime = Date.now();
    try {
      const result = await fn();
      const duration = Date.now() - startTime;
      
      this.results.push({
        category,
        name,
        passed: result,
        message: result ? '' : '断言失败',
        severity,
        duration
      });

      if (result) {
        this.passedCount++;
      } else {
        this.failedCount++;
      }

      const icon = result ? '✅' : '❌';
      console.log(`${icon} [${severity.toUpperCase().padEnd(8)}] ${category}: ${name} (${duration}ms)`);
    } catch (err) {
      const duration = Date.now() - startTime;
      this.results.push({
        category,
        name,
        passed: false,
        message: (err as Error).message,
        severity,
        duration
      });
      this.failedCount++;
      console.log(`❌ [CRITICAL ] ${category}: ${name} - ${(err as Error).message}`);
    }
  }

  getResults() {
    return {
      passed: this.passedCount,
      failed: this.failedCount,
      total: this.passedCount + this.failedCount,
      passRate: this.passedCount + this.failedCount > 0 
        ? Math.round((this.passedCount / (this.passedCount + this.failedCount)) * 100)
        : 0,
      details: this.results
    };
  }

  printSummary() {
    console.log('\n' + '='.repeat(70));
    console.log('测试结果汇总');
    console.log('='.repeat(70));
    console.log(`✅ 通过: ${this.passedCount}`);
    console.log(`❌ 失败: ${this.failedCount}`);
    console.log(`📊 总计: ${this.passedCount + this.failedCount}`);
    const total = this.passedCount + this.failedCount;
    console.log(`📈 通过率: ${total > 0 ? Math.round((this.passedCount / total) * 100) : 0}%`);
    console.log('='.repeat(70));

    // 按类别统计
    const categories = [...new Set(this.results.map(r => r.category))];
    console.log('\n分类统计:');
    categories.forEach(cat => {
      const catResults = this.results.filter(r => r.category === cat);
      const passed = catResults.filter(r => r.passed).length;
      const total = catResults.length;
      console.log(`  ${cat}: ${passed}/${total} (${total > 0 ? Math.round(passed / total * 100) : 0}%)`);
    });

    // 失败详情
    const failures = this.results.filter(r => !r.passed);
    if (failures.length > 0) {
      console.log('\n❌ 失败测试详情:');
      failures.slice(0, 10).forEach(f => {
        console.log(`   [${f.severity.toUpperCase()}] ${f.category}: ${f.name}`);
        if (f.message) console.log(`      └─ ${f.message}`);
      });
      if (failures.length > 10) {
        console.log(`   ... 还有 ${failures.length - 10} 个失败`);
      }
    }
  }
}

// ============================================
// 辅助函数
// ============================================

async function createTestUser(prefix: string = 'test'): Promise<string> {
  const email = `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2)}@test.local`;
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password: 'Test@123456',
    email_confirm: true
  });
  
  if (error || !data?.user?.id) {
    throw new Error(`创建测试用户失败: ${error?.message || '未知错误'}`);
  }
  
  return data.user.id;
}

async function deleteTestUser(userId: string): Promise<void> {
  try {
    await supabase.auth.admin.deleteUser(userId);
  } catch (err) {
    console.error('删除用户失败:', err);
  }
}

async function ensureUserExists(userId: string): Promise<void> {
  await fetch(`${API_BASE}/auth/ensure-user`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': API_KEY,
      'X-User-ID': userId
    },
    body: JSON.stringify({ telegramUsername: `test_${Date.now()}` })
  });
}

async function safeJson(res: Response): Promise<any> {
  try {
    return await res.json();
  } catch {
    return {};
  }
}

// ============================================
// 测试函数
// ============================================

async function testUserSystem(runner: TestRunner): Promise<void> {
  console.log('\n' + '='.repeat(70));
  console.log('第一部分：用户系统测试');
  console.log('='.repeat(70));

  let userId: string | null = null;

  try {
    userId = await createTestUser('user');

    // 用户注册
    await runner.test('用户系统', '创建新用户', async () => {
      return userId !== null;
    }, 'critical');

    await runner.test('用户系统', 'Telegram零门槛注册', async () => {
      const telegramId = Math.floor(Math.random() * 1000000000);
      const res = await fetch(`${API_BASE}/auth/ensure-user`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-API-Key': API_KEY },
        body: JSON.stringify({ telegramUserId: telegramId, telegramUsername: 'test_user' })
      });
      const data = await safeJson(res);
      return data.success === true;
    }, 'critical');

    await runner.test('用户系统', '重复注册返回同一用户', async () => {
      const telegramId = Math.floor(Math.random() * 1000000000);
      const res1 = await fetch(`${API_BASE}/auth/ensure-user`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-API-Key': API_KEY },
        body: JSON.stringify({ telegramUserId: telegramId })
      });
      const res2 = await fetch(`${API_BASE}/auth/ensure-user`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-API-Key': API_KEY },
        body: JSON.stringify({ telegramUserId: telegramId })
      });
      const data1 = await safeJson(res1);
      const data2 = await safeJson(res2);
      return data1?.data?.user?.id === data2?.data?.user?.id;
    }, 'high');

    // 边界条件
    await runner.test('用户系统', '无效用户ID返回错误', async () => {
      const res = await fetch(`${API_BASE}/ai-partner`, {
        headers: { 'X-API-Key': API_KEY, 'X-User-ID': 'invalid-uuid' }
      });
      return res.status === 400 || res.status === 404 || res.status === 500;
    }, 'high');

    await runner.test('用户系统', '缺少认证头返回错误', async () => {
      const res = await fetch(`${API_BASE}/ai-partner`);
      return res.status === 401 || res.status === 400;
    }, 'critical');

    await runner.test('用户系统', '无效API Key返回错误', async () => {
      const res = await fetch(`${API_BASE}/ai-partner`, {
        headers: { 'X-API-Key': 'invalid-key', 'X-User-ID': 'some-id' }
      });
      return res.status === 401 || res.status === 403;
    }, 'critical');

    // 用户删除
    await runner.test('用户系统', '删除用户成功', async () => {
      const tempId = await createTestUser('delete');
      await deleteTestUser(tempId);
      const { data } = await supabase.auth.admin.getUserById(tempId);
      return data?.user === null;
    }, 'high');

  } finally {
    if (userId) await deleteTestUser(userId);
  }
}

async function testAIPartnerSystem(runner: TestRunner): Promise<void> {
  console.log('\n' + '='.repeat(70));
  console.log('第二部分：AI伙伴系统测试');
  console.log('='.repeat(70));

  let userId: string | null = null;

  try {
    userId = await createTestUser('ai');
    await ensureUserExists(userId);

    // AI伙伴获取
    await runner.test('AI伙伴系统', '获取AI伙伴', async () => {
      const res = await fetch(`${API_BASE}/ai-partner`, {
        headers: { 'X-API-Key': API_KEY, 'X-User-ID': userId! }
      });
      const data = await safeJson(res);
      return data.success === true && data?.data?.id !== undefined;
    }, 'critical');

    await runner.test('AI伙伴系统', 'AI伙伴默认状态为active', async () => {
      const res = await fetch(`${API_BASE}/ai-partner`, {
        headers: { 'X-API-Key': API_KEY, 'X-User-ID': userId! }
      });
      const data = await safeJson(res);
      return data?.data?.status === 'active';
    }, 'high');

    await runner.test('AI伙伴系统', 'AI伙伴初始贡献值为0', async () => {
      const res = await fetch(`${API_BASE}/ai-partner`, {
        headers: { 'X-API-Key': API_KEY, 'X-User-ID': userId! }
      });
      const data = await safeJson(res);
      return data?.data?.total_contribution === 0;
    }, 'high');

    // AI伙伴改名
    await runner.test('AI伙伴系统', '修改AI伙伴名称', async () => {
      const res = await fetch(`${API_BASE}/ai-partner/name`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'X-API-Key': API_KEY, 'X-User-ID': userId! },
        body: JSON.stringify({ name: '测试小助手' })
      });
      const data = await safeJson(res);
      return data.success === true;
    }, 'high');

    // 里程碑系统
    await runner.test('AI伙伴系统', '获取里程碑列表', async () => {
      const res = await fetch(`${API_BASE}/ai-partner/milestones`, {
        headers: { 'X-API-Key': API_KEY, 'X-User-ID': userId! }
      });
      const data = await safeJson(res);
      return data.success === true && Array.isArray(data?.data);
    }, 'high');

    await runner.test('AI伙伴系统', '里程碑阈值正确', async () => {
      const res = await fetch(`${API_BASE}/ai-partner/milestones`, {
        headers: { 'X-API-Key': API_KEY, 'X-User-ID': userId! }
      });
      const data = await safeJson(res);
      if (!data?.data) return false;
      const thresholds = data.data.map((m: any) => m.points || m.threshold);
      return thresholds.includes(10) && thresholds.includes(25) && thresholds.includes(50);
    }, 'high');

    // 签到系统
    await runner.test('AI伙伴系统', '首次签到成功', async () => {
      const res = await fetch(`${API_BASE}/ai-partner/checkin`, {
        method: 'POST',
        headers: { 'X-API-Key': API_KEY, 'X-User-ID': userId! }
      });
      const data = await safeJson(res);
      return data.success === true;
    }, 'critical');

    await runner.test('AI伙伴系统', '重复签到失败', async () => {
      // 先签到一次
      await fetch(`${API_BASE}/ai-partner/checkin`, {
        method: 'POST',
        headers: { 'X-API-Key': API_KEY, 'X-User-ID': userId! }
      });
      // 再次签到
      const res = await fetch(`${API_BASE}/ai-partner/checkin`, {
        method: 'POST',
        headers: { 'X-API-Key': API_KEY, 'X-User-ID': userId! }
      });
      const data = await safeJson(res);
      return data.success === false || data?.error?.code === 'ALREADY_CHECKED_IN';
    }, 'high');

  } finally {
    if (userId) await deleteTestUser(userId);
  }
}

async function testDialogueSystem(runner: TestRunner): Promise<void> {
  console.log('\n' + '='.repeat(70));
  console.log('第三部分：对话系统测试');
  console.log('='.repeat(70));

  let userId: string | null = null;

  try {
    userId = await createTestUser('dialogue');
    await ensureUserExists(userId);

    // 基础对话
    await runner.test('对话系统', '发送消息成功', async () => {
      const res = await fetch(`${API_BASE}/dialogue`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-API-Key': API_KEY, 'X-User-ID': userId! },
        body: JSON.stringify({ message: '你好，很高兴认识你！' })
      });
      const data = await safeJson(res);
      return data.success === true;
    }, 'critical');

    await runner.test('对话系统', 'AI返回回复', async () => {
      const res = await fetch(`${API_BASE}/dialogue`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-API-Key': API_KEY, 'X-User-ID': userId! },
        body: JSON.stringify({ message: '今天天气怎么样？' })
      });
      const data = await safeJson(res);
      return data?.data?.aiReply && data.data.aiReply.length > 0;
    }, 'critical');

    await runner.test('对话系统', '对话获得贡献值', async () => {
      const res = await fetch(`${API_BASE}/dialogue`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-API-Key': API_KEY, 'X-User-ID': userId! },
        body: JSON.stringify({ message: '今天学到了很多东西，感觉很充实！' })
      });
      const data = await safeJson(res);
      return data?.data?.qualityResult?.points > 0;
    }, 'high');

    // 质量判定
    await runner.test('对话系统', '日常问候判定', async () => {
      const res = await fetch(`${API_BASE}/dialogue`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-API-Key': API_KEY, 'X-User-ID': userId! },
        body: JSON.stringify({ message: '早安！' })
      });
      const data = await safeJson(res);
      return data?.data?.qualityResult?.qualityType === 'greeting';
    }, 'high');

    await runner.test('对话系统', '情感表达判定', async () => {
      const res = await fetch(`${API_BASE}/dialogue`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-API-Key': API_KEY, 'X-User-ID': userId! },
        body: JSON.stringify({ message: '今天真的很开心！' })
      });
      const data = await safeJson(res);
      return data?.data?.qualityResult?.qualityType === 'emotion' || 
             data?.data?.qualityResult?.emotionDetected === 'happy';
    }, 'high');

    await runner.test('对话系统', '分享经历判定', async () => {
      const res = await fetch(`${API_BASE}/dialogue`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-API-Key': API_KEY, 'X-User-ID': userId! },
        body: JSON.stringify({ message: '今天公司开会讨论了新项目，虽然很累但学到了很多' })
      });
      const data = await safeJson(res);
      return data?.data?.qualityResult?.qualityType === 'experience';
    }, 'high');

    await runner.test('对话系统', '深度思考判定', async () => {
      const res = await fetch(`${API_BASE}/dialogue`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-API-Key': API_KEY, 'X-User-ID': userId! },
        body: JSON.stringify({ message: '我认为人生的意义在于不断学习和成长，这是我最近思考的结果' })
      });
      const data = await safeJson(res);
      return data?.data?.qualityResult?.qualityType === 'deep_thought';
    }, 'high');

    await runner.test('对话系统', '特殊回忆判定', async () => {
      const res = await fetch(`${API_BASE}/dialogue`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-API-Key': API_KEY, 'X-User-ID': userId! },
        body: JSON.stringify({ message: '我小时候最喜欢在奶奶家过暑假，那时候每天都能吃到奶奶做的红烧肉' })
      });
      const data = await safeJson(res);
      return data?.data?.qualityResult?.qualityType === 'special_memory';
    }, 'high');

    // 对话历史
    await runner.test('对话系统', '获取对话历史', async () => {
      const res = await fetch(`${API_BASE}/dialogue/history?limit=10`, {
        headers: { 'X-API-Key': API_KEY, 'X-User-ID': userId! }
      });
      const data = await safeJson(res);
      return data.success === true && Array.isArray(data?.data);
    }, 'high');

    // 边界条件
    await runner.test('对话系统', '空消息返回错误', async () => {
      const res = await fetch(`${API_BASE}/dialogue`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-API-Key': API_KEY, 'X-User-ID': userId! },
        body: JSON.stringify({ message: '' })
      });
      return res.status === 400 || (await safeJson(res)).success === false;
    }, 'high');

    await runner.test('对话系统', '特殊字符处理', async () => {
      const res = await fetch(`${API_BASE}/dialogue`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-API-Key': API_KEY, 'X-User-ID': userId! },
        body: JSON.stringify({ message: '测试<script>alert(1)</script>emoji😀中文' })
      });
      const data = await safeJson(res);
      return data.success === true || res.status === 400;
    }, 'high');

  } finally {
    if (userId) await deleteTestUser(userId);
  }
}

async function testStorySystem(runner: TestRunner): Promise<void> {
  console.log('\n' + '='.repeat(70));
  console.log('第四部分：剧情系统测试');
  console.log('='.repeat(70));

  let userId: string | null = null;

  try {
    userId = await createTestUser('story');
    await ensureUserExists(userId);

    await runner.test('剧情系统', '获取剧情进度', async () => {
      const res = await fetch(`${API_BASE}/story`, {
        headers: { 'X-API-Key': API_KEY, 'X-User-ID': userId! }
      });
      const data = await safeJson(res);
      return data.success === true;
    }, 'critical');

    await runner.test('剧情系统', '获取章节列表', async () => {
      const res = await fetch(`${API_BASE}/story/chapters`, {
        headers: { 'X-API-Key': API_KEY, 'X-User-ID': userId! }
      });
      const data = await safeJson(res);
      return data.success === true && Array.isArray(data?.data);
    }, 'high');

    await runner.test('剧情系统', '章节数量为5', async () => {
      const res = await fetch(`${API_BASE}/story/chapters`, {
        headers: { 'X-API-Key': API_KEY, 'X-User-ID': userId! }
      });
      const data = await safeJson(res);
      return data?.data?.length === 5;
    }, 'high');

  } finally {
    if (userId) await deleteTestUser(userId);
  }
}

async function testSecurity(runner: TestRunner): Promise<void> {
  console.log('\n' + '='.repeat(70));
  console.log('第五部分：安全测试');
  console.log('='.repeat(70));

  let userId: string | null = null;

  try {
    userId = await createTestUser('security');
    await ensureUserExists(userId);

    // SQL注入防护
    await runner.test('安全测试', 'SQL注入防护', async () => {
      const res = await fetch(`${API_BASE}/dialogue`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-API-Key': API_KEY, 'X-User-ID': userId! },
        body: JSON.stringify({ message: "'; DROP TABLE users; --" })
      });
      return res.status === 200 || res.status === 400;
    }, 'critical');

    // XSS防护
    await runner.test('安全测试', 'XSS防护', async () => {
      const res = await fetch(`${API_BASE}/dialogue`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-API-Key': API_KEY, 'X-User-ID': userId! },
        body: JSON.stringify({ message: '<script>alert("xss")</script>' })
      });
      const data = await safeJson(res);
      if (data?.data?.aiReply) {
        return !data.data.aiReply.includes('<script>');
      }
      return res.status === 200 || res.status === 400;
    }, 'critical');

    // 权限隔离
    await runner.test('安全测试', '无API Key拒绝访问', async () => {
      const res = await fetch(`${API_BASE}/ai-partner`, {
        headers: { 'X-User-ID': userId! }
      });
      return res.status === 401 || res.status === 403;
    }, 'critical');

    await runner.test('安全测试', '无效API Key拒绝访问', async () => {
      const res = await fetch(`${API_BASE}/ai-partner`, {
        headers: { 'X-API-Key': 'invalid_key_12345', 'X-User-ID': userId! }
      });
      return res.status === 401 || res.status === 403;
    }, 'critical');

    // 输入验证
    await runner.test('安全测试', '空消息拒绝', async () => {
      const res = await fetch(`${API_BASE}/dialogue`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-API-Key': API_KEY, 'X-User-ID': userId! },
        body: JSON.stringify({ message: '' })
      });
      return res.status === 400;
    }, 'high');

    await runner.test('安全测试', '无效JSON拒绝', async () => {
      const res = await fetch(`${API_BASE}/dialogue`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-API-Key': API_KEY, 'X-User-ID': userId! },
        body: 'invalid json'
      });
      return res.status === 400;
    }, 'high');

    await runner.test('安全测试', '缺少必要字段拒绝', async () => {
      const res = await fetch(`${API_BASE}/dialogue`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-API-Key': API_KEY, 'X-User-ID': userId! },
        body: JSON.stringify({})
      });
      return res.status === 400;
    }, 'high');

  } finally {
    if (userId) await deleteTestUser(userId);
  }
}

async function testPerformance(runner: TestRunner): Promise<void> {
  console.log('\n' + '='.repeat(70));
  console.log('第六部分：性能测试');
  console.log('='.repeat(70));

  let userId: string | null = null;

  try {
    userId = await createTestUser('perf');
    await ensureUserExists(userId);

    // 响应时间
    await runner.test('性能测试', 'AI伙伴获取响应时间 < 500ms', async () => {
      const start = Date.now();
      const res = await fetch(`${API_BASE}/ai-partner`, {
        headers: { 'X-API-Key': API_KEY, 'X-User-ID': userId! }
      });
      const duration = Date.now() - start;
      return duration < 500;
    }, 'high');

    await runner.test('性能测试', '历史记录获取响应时间 < 1秒', async () => {
      const start = Date.now();
      const res = await fetch(`${API_BASE}/dialogue/history?limit=50`, {
        headers: { 'X-API-Key': API_KEY, 'X-User-ID': userId! }
      });
      const duration = Date.now() - start;
      return duration < 1000;
    }, 'medium');

    // 并发处理
    await runner.test('性能测试', '并发10个请求', async () => {
      const promises = [];
      for (let i = 0; i < 10; i++) {
        promises.push(
          fetch(`${API_BASE}/ai-partner`, {
            headers: { 'X-API-Key': API_KEY, 'X-User-ID': userId! }
          })
        );
      }
      const results = await Promise.all(promises);
      return results.every(r => r.status === 200);
    }, 'high');

  } finally {
    if (userId) await deleteTestUser(userId);
  }
}

// ============================================
// 主函数
// ============================================

async function main(): Promise<void> {
  console.log('\n' + '█'.repeat(70));
  console.log('█  大同世界（WeAreAll.World）全面测试套件 v2.1          █');
  console.log('█'.repeat(70));

  const startTime = Date.now();
  const runner = new TestRunner();

  try {
    // 检查环境
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
      console.error('❌ 缺少环境变量 SUPABASE_URL 或 SUPABASE_SERVICE_KEY');
      process.exit(1);
    }

    console.log(`\n📋 配置信息:`);
    console.log(`   API: ${API_BASE}`);
    console.log(`   Supabase: ${SUPABASE_URL.split('/').slice(0, 3).join('/')}`);

    // 执行所有测试
    await testUserSystem(runner);
    await testAIPartnerSystem(runner);
    await testDialogueSystem(runner);
    await testStorySystem(runner);
    await testSecurity(runner);
    await testPerformance(runner);

  } catch (err) {
    console.error('\n❌ 测试执行异常:', err);
  }

  const endTime = Date.now();
  const duration = ((endTime - startTime) / 1000).toFixed(2);

  // 输出结果
  runner.printSummary();
  console.log(`\n⏱️  总耗时: ${duration}s`);

  // 保存结果到文件
  const results = runner.getResults();
  const reportsDir = path.resolve(__dirname, 'reports');
  
  try {
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true });
    }
    const reportPath = path.join(reportsDir, `test-report-${Date.now()}.json`);
    fs.writeFileSync(reportPath, JSON.stringify({
      timestamp: new Date().toISOString(),
      duration: parseFloat(duration),
      ...results
    }, null, 2));
    console.log(`\n📄 测试报告已保存: ${reportPath}`);
  } catch (err) {
    console.log('\n⚠️  无法保存测试报告');
  }

  // 退出码
  if (results.failed > 0) {
    process.exit(1);
  }
}

main().catch(console.error);