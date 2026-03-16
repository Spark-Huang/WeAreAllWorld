/**
 * API 接口测试脚本
 * 
 * 测试所有 API 端点的可用性和响应格式
 */

import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const API_BASE = process.env.API_BASE || 'http://localhost:3000/api/v1';
const API_KEY = process.env.API_KEY || 'weareallworld_dev_key_2026';

// ============================================
// 测试工具
// ============================================

interface ApiTest {
  name: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  path: string;
  body?: any;
  expectStatus: number | number[];
  expectFields?: string[];
  headers?: Record<string, string>;
}

let passedCount = 0;
let failedCount = 0;

async function testApi(test: ApiTest, userId?: string) {
  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...test.headers
    };
    
    if (userId && !headers['X-User-ID']) {
      headers['X-API-Key'] = API_KEY;
      headers['X-User-ID'] = userId;
    }
    
    const res = await fetch(`${API_BASE}${test.path}`, {
      method: test.method,
      headers,
      body: test.body ? JSON.stringify(test.body) : undefined
    });
    
    // 检查状态码
    const expectedStatuses = Array.isArray(test.expectStatus) ? test.expectStatus : [test.expectStatus];
    const statusMatch = expectedStatuses.includes(res.status);
    
    // 检查响应字段
    let fieldsMatch = true;
    let data: any = null;
    
    if (test.expectFields && res.status === 200) {
      try {
        data = await res.json();
        for (const field of test.expectFields) {
          if (data[field] === undefined) {
            fieldsMatch = false;
            break;
          }
        }
      } catch {
        fieldsMatch = false;
      }
    }
    
    const passed = statusMatch && fieldsMatch;
    const icon = passed ? '✅' : '❌';
    
    let message = `状态码: ${res.status}`;
    if (!statusMatch) message += ` (期望: ${expectedStatuses.join('/')})`;
    if (!fieldsMatch && test.expectFields) message += ` 缺少字段`;
    
    console.log(`${icon} ${test.name} - ${message}`);
    
    if (passed) passedCount++;
    else failedCount++;
    
    return { passed, data, status: res.status };
  } catch (err) {
    console.log(`❌ ${test.name} - 请求失败: ${(err as Error).message}`);
    failedCount++;
    return { passed: false, data: null, status: 0 };
  }
}

// ============================================
// 测试定义
// ============================================

async function runTests() {
  console.log('🔌 API 接口测试');
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
    
    const testEmail = `api_test_${Date.now()}@test.local`;
    const { data } = await supabase.auth.admin.createUser({
      email: testEmail,
      password: 'Test@123456',
      email_confirm: true
    });
    testUserId = data?.user?.id || null;
    
    if (testUserId) {
      // 确保用户记录存在
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
    console.log('⚠️  无法创建测试用户，部分测试将跳过');
  }

  // ===== 认证接口测试 =====
  console.log('\n--- 认证接口 ---');
  
  await testApi({
    name: 'POST /auth/ensure-user',
    method: 'POST',
    path: '/auth/ensure-user',
    body: { telegramUserId: Math.floor(Math.random() * 1000000000) },
    expectStatus: [200, 201],
    expectFields: ['success']
  });

  // ===== AI伙伴接口测试 =====
  console.log('\n--- AI伙伴接口 ---');
  
  if (testUserId) {
    await testApi({
      name: 'GET /ai-partner',
      method: 'GET',
      path: '/ai-partner',
      expectStatus: 200,
      expectFields: ['success', 'data'],
      headers: { 'X-API-Key': API_KEY, 'X-User-ID': testUserId }
    });
    
    await testApi({
      name: 'PUT /ai-partner/name',
      method: 'PUT',
      path: '/ai-partner/name',
      body: { name: '测试AI' },
      expectStatus: 200,
      headers: { 'X-API-Key': API_KEY, 'X-User-ID': testUserId }
    });
    
    await testApi({
      name: 'GET /ai-partner/milestones',
      method: 'GET',
      path: '/ai-partner/milestones',
      expectStatus: 200,
      expectFields: ['success', 'data'],
      headers: { 'X-API-Key': API_KEY, 'X-User-ID': testUserId }
    });
    
    await testApi({
      name: 'POST /ai-partner/checkin',
      method: 'POST',
      path: '/ai-partner/checkin',
      expectStatus: [200, 400], // 可能已签到
      headers: { 'X-API-Key': API_KEY, 'X-User-ID': testUserId }
    });
  }

  // ===== 对话接口测试 =====
  console.log('\n--- 对话接口 ---');
  
  if (testUserId) {
    await testApi({
      name: 'POST /dialogue',
      method: 'POST',
      path: '/dialogue',
      body: { message: '你好，很高兴认识你！' },
      expectStatus: 200,
      expectFields: ['success', 'data'],
      headers: { 'X-API-Key': API_KEY, 'X-User-ID': testUserId }
    });
    
    await testApi({
      name: 'GET /dialogue/history',
      method: 'GET',
      path: '/dialogue/history?limit=10',
      expectStatus: 200,
      expectFields: ['success', 'data'],
      headers: { 'X-API-Key': API_KEY, 'X-User-ID': testUserId }
    });
  }

  // ===== 剧情接口测试 =====
  console.log('\n--- 剧情接口 ---');
  
  if (testUserId) {
    await testApi({
      name: 'GET /story',
      method: 'GET',
      path: '/story',
      expectStatus: 200,
      expectFields: ['success', 'data'],
      headers: { 'X-API-Key': API_KEY, 'X-User-ID': testUserId }
    });
    
    await testApi({
      name: 'GET /story/chapters',
      method: 'GET',
      path: '/story/chapters',
      expectStatus: 200,
      expectFields: ['success', 'data'],
      headers: { 'X-API-Key': API_KEY, 'X-User-ID': testUserId }
    });
  }

  // ===== 错误处理测试 =====
  console.log('\n--- 错误处理 ---');
  
  await testApi({
    name: '无认证访问',
    method: 'GET',
    path: '/ai-partner',
    expectStatus: [401, 400, 403]
  });
  
  await testApi({
    name: '无效API Key',
    method: 'GET',
    path: '/ai-partner',
    expectStatus: [401, 403],
    headers: { 'X-API-Key': 'invalid_key', 'X-User-ID': 'some_id' }
  });
  
  await testApi({
    name: '无效用户ID',
    method: 'GET',
    path: '/ai-partner',
    expectStatus: [400, 404, 500],
    headers: { 'X-API-Key': API_KEY, 'X-User-ID': 'invalid-uuid' }
  });

  // 清理测试用户
  if (testUserId) {
    try {
      const { createClient } = await import('@supabase/supabase-js');
      const supabase = createClient(
        process.env.SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_KEY!
      );
      await supabase.auth.admin.deleteUser(testUserId);
    } catch {}
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