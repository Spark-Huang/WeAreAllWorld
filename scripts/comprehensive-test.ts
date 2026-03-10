/**
 * 天下一家 - 全面测试套件
 * 包含：功能测试 + 性能测试 + 回归测试
 * 
 * 运行方式：npx tsx scripts/comprehensive-test.ts
 */

import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { resolve } from 'path'

config({ path: resolve(__dirname, '../.env') })

// Supabase 客户端
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY!
)

// 测试结果
interface TestResult {
  category: string
  name: string
  passed: boolean
  duration: number
  error?: string
  details?: any
}

const results: TestResult[] = []

// 测试工具函数
async function test(category: string, name: string, fn: () => Promise<any>) {
  const start = Date.now()
  try {
    const result = await fn()
    const duration = Date.now() - start
    results.push({ category, name, passed: true, duration, details: result })
    console.log(`✅ [${category}] ${name} (${duration}ms)`)
    return result
  } catch (error: any) {
    const duration = Date.now() - start
    results.push({ category, name, passed: false, duration, error: error.message })
    console.log(`❌ [${category}] ${name}: ${error.message}`)
    return null
  }
}

// 性能测试工具
async function perfTest(
  category: string,
  name: string,
  fn: () => Promise<any>,
  iterations: number = 10
) {
  const times: number[] = []
  let success = 0
  
  for (let i = 0; i < iterations; i++) {
    const start = Date.now()
    try {
      await fn()
      times.push(Date.now() - start)
      success++
    } catch (e) {
      // 忽略错误，只统计成功次数
    }
  }
  
  const avgTime = times.length > 0 ? times.reduce((a, b) => a + b, 0) / times.length : 0
  const minTime = times.length > 0 ? Math.min(...times) : 0
  const maxTime = times.length > 0 ? Math.max(...times) : 0
  const p95Time = times.length > 0 ? times.sort((a, b) => a - b)[Math.floor(times.length * 0.95)] : 0
  
  const passed = success >= iterations * 0.8 && avgTime < 1000
  
  results.push({
    category,
    name,
    passed,
    duration: avgTime,
    details: { iterations, success, avgTime, minTime, maxTime, p95Time }
  })
  
  console.log(`${passed ? '✅' : '❌'} [${category}] ${name}: avg=${avgTime.toFixed(0)}ms, p95=${p95Time}ms, success=${success}/${iterations}`)
  
  return { avgTime, p95Time, success }
}

// 主测试函数
async function runTests() {
  console.log('\n' + '='.repeat(60))
  console.log('  天下一家 - 全面测试套件')
  console.log('  ' + new Date().toISOString())
  console.log('='.repeat(60) + '\n')

  // ============================================
  // 1. 数据库连接测试
  // ============================================
  console.log('\n📦 1. 数据库连接测试\n')

  await test('数据库', '连接测试', async () => {
    const { data, error } = await supabase.from('users').select('count').limit(1)
    if (error) throw error
    return { connected: true }
  })

  await test('数据库', '用户表查询', async () => {
    const { data, error } = await supabase.from('users').select('id').limit(1)
    if (error) throw error
    return { count: data?.length || 0 }
  })

  await test('数据库', 'AI伙伴表查询', async () => {
    const { data, error } = await supabase.from('ai_partners').select('id').limit(1)
    if (error) throw error
    return { count: data?.length || 0 }
  })

  // ============================================
  // 2. 核心功能测试
  // ============================================
  console.log('\n🔧 2. 核心功能测试\n')

  // 创建测试用户
  let testUserId: string | null = null

  await test('核心功能', '创建测试用户', async () => {
    const { data, error } = await supabase
      .from('users')
      .insert({
        telegram_user_id: Math.floor(Math.random() * 1000000000),
        telegram_username: `test_user_${Date.now()}`
      })
      .select()
      .single()
    
    if (error) throw error
    testUserId = data.id
    return { userId: data.id }
  })

  await test('核心功能', '创建AI伙伴', async () => {
    if (!testUserId) throw new Error('No test user')
    
    const { data, error } = await supabase
      .from('ai_partners')
      .insert({
        user_id: testUserId,
        name: '测试AI',
        personality: 'warm'
      })
      .select()
      .single()
    
    if (error) throw error
    return { partnerId: data.id, name: data.name }
  })

  await test('核心功能', '更新贡献值', async () => {
    if (!testUserId) throw new Error('No test user')
    
    const { data, error } = await supabase.rpc('update_contribution', {
      p_user_id: testUserId,
      p_points: 10,
      p_reason: '测试贡献值'
    })
    
    if (error) throw error
    return { result: data }
  })

  await test('核心功能', '查询AI伙伴状态', async () => {
    if (!testUserId) throw new Error('No test user')
    
    const { data, error } = await supabase
      .from('ai_partners')
      .select('*')
      .eq('user_id', testUserId)
      .single()
    
    if (error) throw error
    return { 
      contribution: data.current_contribution,
      status: data.status,
      personality: data.personality
    }
  })

  // ============================================
  // 3. 情感冲击功能测试
  // ============================================
  console.log('\n💜 3. 情感冲击功能测试\n')

  await test('情感冲击', '创建AI记忆', async () => {
    if (!testUserId) throw new Error('No test user')
    
    const { data, error } = await supabase
      .from('ai_memories')
      .insert({
        user_id: testUserId,
        type: 'emotional',
        content: '这是一条测试记忆'
      })
      .select()
      .single()
    
    if (error) throw error
    return { memoryId: data.id }
  })

  await test('情感冲击', '创建贡献值详情', async () => {
    if (!testUserId) throw new Error('No test user')
    
    const { data, error } = await supabase
      .from('contribution_details')
      .insert({
        user_id: testUserId,
        points: 5,
        rating: 'rare',
        reason: '测试贡献值详情'
      })
      .select()
      .single()
    
    if (error) throw error
    return { detailId: data.id }
  })

  await test('情感冲击', '创建濒危警告', async () => {
    if (!testUserId) throw new Error('No test user')
    
    const { data, error } = await supabase
      .from('danger_warnings')
      .insert({
        user_id: testUserId,
        partner_name: '测试AI',
        contribution: 10,
        warning_level: 'low',
        message: '测试警告消息'
      })
      .select()
      .single()
    
    if (error) throw error
    return { warningId: data.id }
  })

  await test('情感冲击', '查询濒危状态视图', async () => {
    const { data, error } = await supabase
      .from('user_danger_status')
      .select('*')
      .limit(5)
    
    if (error) throw error
    return { count: data?.length || 0 }
  })

  // ============================================
  // 4. 用户粘性功能测试
  // ============================================
  console.log('\n🔥 4. 用户粘性功能测试\n')

  await test('用户粘性', '创建登录记录', async () => {
    if (!testUserId) throw new Error('No test user')
    
    const { data, error } = await supabase
      .from('login_records')
      .insert({
        user_id: testUserId,
        login_date: new Date().toISOString().split('T')[0],
        streak_at_login: 1,
        points_earned: 15
      })
      .select()
      .single()
    
    if (error) throw error
    return { recordId: data.id }
  })

  await test('用户粘性', '创建深度对话记录', async () => {
    if (!testUserId) throw new Error('No test user')
    
    const { data, error } = await supabase
      .from('deep_dialogue_records')
      .insert({
        user_id: testUserId,
        prompt_id: 'childhood-1',
        started_at: new Date().toISOString(),
        completed: false
      })
      .select()
      .single()
    
    if (error) throw error
    return { recordId: data.id }
  })

  await test('用户粘性', '查询登录统计视图', async () => {
    const { data, error } = await supabase
      .from('user_login_stats')
      .select('*')
      .limit(5)
    
    if (error) throw error
    return { count: data?.length || 0 }
  })

  await test('用户粘性', '查询记忆统计视图', async () => {
    const { data, error } = await supabase
      .from('memory_stats')
      .select('*')
      .limit(5)
    
    if (error) throw error
    return { count: data?.length || 0 }
  })

  // ============================================
  // 5. Telegram 支持测试
  // ============================================
  console.log('\n📱 5. Telegram 支持测试\n')

  await test('Telegram', '查询Telegram用户视图', async () => {
    const { data, error } = await supabase
      .from('telegram_users')
      .select('*')
      .limit(5)
    
    if (error) throw error
    return { count: data?.length || 0 }
  })

  await test('Telegram', '创建签到记录', async () => {
    if (!testUserId) throw new Error('No test user')
    
    const { data, error } = await supabase
      .from('checkin_records')
      .insert({
        user_id: testUserId,
        checkin_date: new Date().toISOString().split('T')[0],
        points_earned: 10,
        streak_at_checkin: 1
      })
      .select()
      .single()
    
    if (error) throw error
    return { recordId: data.id }
  })

  // ============================================
  // 6. 性能测试
  // ============================================
  console.log('\n⚡ 6. 性能测试\n')

  await perfTest('性能', '用户查询', async () => {
    await supabase.from('users').select('*').limit(10)
  }, 20)

  await perfTest('性能', 'AI伙伴查询', async () => {
    await supabase.from('ai_partners').select('*').limit(10)
  }, 20)

  await perfTest('性能', '贡献值更新', async () => {
    if (!testUserId) return
    await supabase.rpc('update_contribution', {
      p_user_id: testUserId,
      p_points: 1,
      p_reason: '性能测试'
    })
  }, 10)

  await perfTest('性能', '记忆查询', async () => {
    await supabase.from('ai_memories').select('*').limit(20)
  }, 20)

  await perfTest('性能', '复杂视图查询', async () => {
    await supabase.from('user_danger_status').select('*').limit(10)
  }, 15)

  // ============================================
  // 7. 数据完整性测试
  // ============================================
  console.log('\n🔒 7. 数据完整性测试\n')

  await test('数据完整性', '外键约束测试', async () => {
    // 尝试插入无效外键
    const { error } = await supabase
      .from('ai_partners')
      .insert({
        user_id: '00000000-0000-0000-0000-000000000000',
        name: '无效用户'
      })
    
    // 应该失败
    if (!error) throw new Error('外键约束未生效')
    return { constraintWorking: true }
  })

  await test('数据完整性', '唯一约束测试', async () => {
    if (!testUserId) throw new Error('No test user')
    
    // 尝试重复插入
    const { error } = await supabase
      .from('ai_partners')
      .insert({
        user_id: testUserId,
        name: '重复伙伴'
      })
    
    // 应该失败
    if (!error) throw new Error('唯一约束未生效')
    return { constraintWorking: true }
  })

  await test('数据完整性', 'CHECK约束测试', async () => {
    // 尝试插入无效状态
    const { error } = await supabase
      .from('ai_partners')
      .update({ status: 'invalid_status' })
      .eq('user_id', testUserId || '')
    
    // 应该失败
    if (!error) throw new Error('CHECK约束未生效')
    return { constraintWorking: true }
  })

  // ============================================
  // 8. 清理测试数据
  // ============================================
  console.log('\n🧹 8. 清理测试数据\n')

  await test('清理', '删除测试用户', async () => {
    if (!testUserId) throw new Error('No test user')
    
    const { error } = await supabase
      .from('users')
      .delete()
      .eq('id', testUserId)
    
    if (error) throw error
    return { deleted: true }
  })

  // ============================================
  // 测试报告
  // ============================================
  console.log('\n' + '='.repeat(60))
  console.log('  测试报告')
  console.log('='.repeat(60) + '\n')

  const passed = results.filter(r => r.passed).length
  const failed = results.filter(r => !r.passed).length
  const totalDuration = results.reduce((sum, r) => sum + r.duration, 0)

  console.log(`总计: ${results.length} 个测试`)
  console.log(`✅ 通过: ${passed}`)
  console.log(`❌ 失败: ${failed}`)
  console.log(`⏱️  总耗时: ${totalDuration}ms`)
  console.log(`📊 通过率: ${((passed / results.length) * 100).toFixed(1)}%`)

  // 分类统计
  const categories = [...new Set(results.map(r => r.category))]
  console.log('\n分类统计:')
  for (const cat of categories) {
    const catResults = results.filter(r => r.category === cat)
    const catPassed = catResults.filter(r => r.passed).length
    console.log(`  ${cat}: ${catPassed}/${catResults.length} 通过`)
  }

  // 性能统计
  const perfResults = results.filter(r => r.category === '性能' && r.passed)
  if (perfResults.length > 0) {
    console.log('\n性能统计:')
    for (const r of perfResults) {
      if (r.details) {
        console.log(`  ${r.name}: avg=${r.details.avgTime?.toFixed(0)}ms, p95=${r.details.p95Time}ms`)
      }
    }
  }

  // 失败详情
  const failedTests = results.filter(r => !r.passed)
  if (failedTests.length > 0) {
    console.log('\n❌ 失败测试详情:')
    for (const t of failedTests) {
      console.log(`  [${t.category}] ${t.name}: ${t.error}`)
    }
  }

  // 退出码
  process.exit(failed > 0 ? 1 : 0)
}

// 运行测试
runTests().catch(console.error)