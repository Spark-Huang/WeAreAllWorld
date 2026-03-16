/**
 * 性能测试脚本
 * 
 * 测试范围：
 * 1. 响应时间
 * 2. 并发处理能力
 * 3. 吞吐量
 * 4. 资源使用
 */

import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const API_BASE = process.env.API_BASE || 'http://localhost:3000/api/v1';
const API_KEY = process.env.API_KEY || 'weareallworld_dev_key_2026';

// ============================================
// 性能测试工具
// ============================================

interface PerfResult {
  name: string;
  duration: number;
  success: boolean;
  error?: string;
}

interface PerfStats {
  min: number;
  max: number;
  avg: number;
  p50: number;
  p95: number;
  p99: number;
  successRate: number;
  throughput: number;
}

function calculateStats(results: PerfResult[]): PerfStats {
  const durations = results.map(r => r.duration).sort((a, b) => a - b);
  const successCount = results.filter(r => r.success).length;
  const totalDuration = durations.reduce((a, b) => a + b, 0);
  
  return {
    min: durations[0] || 0,
    max: durations[durations.length - 1] || 0,
    avg: totalDuration / durations.length,
    p50: durations[Math.floor(durations.length * 0.5)] || 0,
    p95: durations[Math.floor(durations.length * 0.95)] || 0,
    p99: durations[Math.floor(durations.length * 0.99)] || 0,
    successRate: successCount / results.length,
    throughput: results.length / (totalDuration / 1000)
  };
}

function printStats(name: string, stats: PerfStats) {
  console.log(`\n📊 ${name} 性能统计:`);
  console.log(`   最小: ${stats.min.toFixed(0)}ms`);
  console.log(`   最大: ${stats.max.toFixed(0)}ms`);
  console.log(`   平均: ${stats.avg.toFixed(0)}ms`);
  console.log(`   P50:  ${stats.p50.toFixed(0)}ms`);
  console.log(`   P95:  ${stats.p95.toFixed(0)}ms`);
  console.log(`   P99:  ${stats.p99.toFixed(0)}ms`);
  console.log(`   成功率: ${(stats.successRate * 100).toFixed(1)}%`);
  console.log(`   吞吐量: ${stats.throughput.toFixed(2)} req/s`);
}

// ============================================
// 测试场景
// ============================================

async function testResponseTime(userId: string): Promise<PerfResult[]> {
  console.log('\n⏱️  响应时间测试 (100次请求)');
  console.log('-'.repeat(50));
  
  const results: PerfResult[] = [];
  
  for (let i = 0; i < 100; i++) {
    const start = Date.now();
    try {
      const res = await fetch(`${API_BASE}/ai-partner`, {
        headers: { 'X-API-Key': API_KEY, 'X-User-ID': userId }
      });
      const duration = Date.now() - start;
      results.push({
        name: `请求 ${i + 1}`,
        duration,
        success: res.status === 200
      });
    } catch (err) {
      results.push({
        name: `请求 ${i + 1}`,
        duration: Date.now() - start,
        success: false,
        error: (err as Error).message
      });
    }
  }
  
  const stats = calculateStats(results);
  printStats('AI伙伴获取', stats);
  
  return results;
}

async function testConcurrency(userId: string, concurrency: number): Promise<PerfResult[]> {
  console.log(`\n🔄 并发测试 (${concurrency} 并发)`);
  console.log('-'.repeat(50));
  
  const results: PerfResult[] = [];
  const start = Date.now();
  
  const promises = [];
  for (let i = 0; i < concurrency; i++) {
    promises.push(
      (async () => {
        const reqStart = Date.now();
        try {
          const res = await fetch(`${API_BASE}/ai-partner`, {
            headers: { 'X-API-Key': API_KEY, 'X-User-ID': userId }
          });
          return {
            name: `并发请求 ${i + 1}`,
            duration: Date.now() - reqStart,
            success: res.status === 200
          };
        } catch (err) {
          return {
            name: `并发请求 ${i + 1}`,
            duration: Date.now() - reqStart,
            success: false,
            error: (err as Error).message
          };
        }
      })()
    );
  }
  
  const batchResults = await Promise.all(promises);
  results.push(...batchResults);
  
  const totalDuration = Date.now() - start;
  const stats = calculateStats(results);
  printStats(`并发 ${concurrency}`, stats);
  console.log(`   总耗时: ${totalDuration}ms`);
  console.log(`   实际并发: ${(concurrency / (totalDuration / 1000)).toFixed(2)} req/s`);
  
  return results;
}

async function testDialoguePerformance(userId: string): Promise<PerfResult[]> {
  console.log('\n💬 对话性能测试 (50次对话)');
  console.log('-'.repeat(50));
  
  const results: PerfResult[] = [];
  const messages = [
    '你好', '今天天气怎么样', '我很开心', '工作很累',
    '分享一个童年回忆', '思考人生的意义', '早安', '晚安'
  ];
  
  for (let i = 0; i < 50; i++) {
    const message = messages[i % messages.length];
    const start = Date.now();
    try {
      const res = await fetch(`${API_BASE}/dialogue`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': API_KEY,
          'X-User-ID': userId
        },
        body: JSON.stringify({ message })
      });
      const duration = Date.now() - start;
      results.push({
        name: `对话 ${i + 1}`,
        duration,
        success: res.status === 200
      });
    } catch (err) {
      results.push({
        name: `对话 ${i + 1}`,
        duration: Date.now() - start,
        success: false,
        error: (err as Error).message
      });
    }
  }
  
  const stats = calculateStats(results);
  printStats('对话', stats);
  
  return results;
}

async function testThroughput(userId: string, duration: number): Promise<void> {
  console.log(`\n🚀 吞吐量测试 (${duration}秒)`);
  console.log('-'.repeat(50));
  
  const results: PerfResult[] = [];
  const endTime = Date.now() + duration * 1000;
  let count = 0;
  
  while (Date.now() < endTime) {
    const start = Date.now();
    try {
      const res = await fetch(`${API_BASE}/ai-partner`, {
        headers: { 'X-API-Key': API_KEY, 'X-User-ID': userId }
      });
      results.push({
        name: `吞吐量测试 ${++count}`,
        duration: Date.now() - start,
        success: res.status === 200
      });
    } catch (err) {
      results.push({
        name: `吞吐量测试 ${++count}`,
        duration: Date.now() - start,
        success: false,
        error: (err as Error).message
      });
    }
  }
  
  const stats = calculateStats(results);
  printStats('吞吐量', stats);
  console.log(`   总请求: ${results.length}`);
  console.log(`   成功请求: ${results.filter(r => r.success).length}`);
}

// ============================================
// 主函数
// ============================================

async function main() {
  console.log('⚡ 性能测试套件');
  console.log('='.repeat(60));
  console.log(`API 地址: ${API_BASE}`);
  console.log('='.repeat(60));

  // 创建测试用户
  let testUserId: string | null = null;
  
  try {
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!
    );
    
    const testEmail = `perf_test_${Date.now()}@test.local`;
    const { data } = await supabase.auth.admin.createUser({
      email: testEmail,
      password: 'Test@123456',
      email_confirm: true
    });
    testUserId = data?.user?.id || null;
    
    if (testUserId) {
      await fetch(`${API_BASE}/auth/ensure-user`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': API_KEY,
          'X-User-ID': testUserId
        },
        body: JSON.stringify({ telegramUsername: testEmail.split('@')[0] })
      });
    }
  } catch (err) {
    console.error('❌ 无法创建测试用户:', err);
    process.exit(1);
  }

  if (!testUserId) {
    console.error('❌ 测试用户创建失败');
    process.exit(1);
  }

  try {
    // 运行性能测试
    await testResponseTime(testUserId);
    await testConcurrency(testUserId, 10);
    await testConcurrency(testUserId, 50);
    await testConcurrency(testUserId, 100);
    await testDialoguePerformance(testUserId);
    await testThroughput(testUserId, 10);
    
    console.log('\n' + '='.repeat(60));
    console.log('✅ 性能测试完成');
    console.log('='.repeat(60));
    
  } finally {
    // 清理
    try {
      const { createClient } = await import('@supabase/supabase-js');
      const supabase = createClient(
        process.env.SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_KEY!
      );
      await supabase.auth.admin.deleteUser(testUserId);
      console.log('🧹 已清理测试用户');
    } catch {}
  }
}

main().catch(console.error);