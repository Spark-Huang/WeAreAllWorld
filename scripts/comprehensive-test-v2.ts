/**
 * 天下一家 - 完整测试套件 v2.0
 * 包含：功能测试 + 边界测试 + 性能测试 + 安全测试 + 回归测试
 * 
 * 运行方式：npx tsx scripts/comprehensive-test-v2.ts
 */

import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { resolve } from 'path'

config({ path: resolve(__dirname, '../.env') })

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY!
)

interface TestResult {
  suite: string
  name: string
  passed: boolean
  duration: number
  error?: string
  details?: any
}

const results: TestResult[] = []
let testUserId: string | null = null

async function test(suite: string, name: string, fn: () => Promise<any>) {
  const start = Date.now()
  try {
    const result = await fn()
    const duration = Date.now() - start
    results.push({ suite, name, passed: true, duration, details: result })
    console.log(`✅ [${suite}] ${name} (${duration}ms)`)
    return result
  } catch (error: any) {
    const duration = Date.now() - start
    results.push({ suite, name, passed: false, duration, error: error.message })
    console.log(`❌ [${suite}] ${name}: ${error.message}`)
    return null
  }
}

async function perfTest(suite: string, name: string, fn: () => Promise<any>, iterations: number = 20) {
  const times: number[] = []
  let success = 0
  
  for (let i = 0; i < iterations; i++) {
    const start = Date.now()
    try {
      await fn()
      times.push(Date.now() - start)
      success++
    } catch (e) {}
  }
  
  const avgTime = times.length > 0 ? times.reduce((a, b) => a + b, 0) / times.length : 0
  const p50Time = times.length > 0 ? times.sort((a, b) => a - b)[Math.floor(times.length * 0.5)] : 0
  const p95Time = times.length > 0 ? times.sort((a, b) => a - b)[Math.floor(times.length * 0.95)] : 0
  
  const passed = success >= iterations * 0.8 && avgTime < 1000
  
  results.push({
    suite, name, passed, duration: avgTime,
    details: { iterations, success, avgTime, p50Time, p95Time }
  })
  
  console.log(`${passed ? '✅' : '❌'} [${suite}] ${name}: avg=${avgTime.toFixed(0)}ms, p50=${p50Time}ms, p95=${p95Time}ms, success=${success}/${iterations}`)
}

async function runTests() {
  console.log('\n' + '='.repeat(70))
  console.log('  天下一家 - 完整测试套件 v2.0')
  console.log('  ' + new Date().toISOString())
  console.log('='.repeat(70) + '\n')

  // 1. 数据库连接测试 (5个)
  console.log('\n📦 1. 数据库连接测试\n')
  
  await test('数据库连接', '基础连接', async () => {
    const { error } = await supabase.from('users').select('count').limit(1)
    if (error) throw error
    return { connected: true }
  })
  
  await test('数据库连接', '用户表可访问', async () => {
    const { error } = await supabase.from('users').select('id').limit(1)
    if (error) throw error
    return { accessible: true }
  })
  
  await test('数据库连接', 'AI伙伴表可访问', async () => {
    const { error } = await supabase.from('ai_partners').select('id').limit(1)
    if (error) throw error
    return { accessible: true }
  })
  
  await test('数据库连接', '交互日志表可访问', async () => {
    const { error } = await supabase.from('interaction_logs').select('id').limit(1)
    if (error) throw error
    return { accessible: true }
  })
  
  await test('数据库连接', 'AI记忆表可访问', async () => {
    const { error } = await supabase.from('ai_memories').select('id').limit(1)
    if (error) throw error
    return { accessible: true }
  })

  // 2. 用户注册测试 (8个)
  console.log('\n👤 2. 用户注册测试\n')
  
  await test('用户注册', '创建新用户', async () => {
    const { data, error } = await supabase
      .from('users')
      .insert({
        telegram_user_id: Math.floor(Math.random() * 1000000000),
        telegram_username: `test_${Date.now()}`
      })
      .select()
      .single()
    if (error) throw error
    testUserId = data.id
    return { userId: data.id }
  })
  
  await test('用户注册', 'AI伙伴自动创建', async () => {
    if (!testUserId) throw new Error('No test user')
    await new Promise(r => setTimeout(r, 500))
    const { data, error } = await supabase
      .from('ai_partners')
      .select('*')
      .eq('user_id', testUserId)
      .single()
    if (error) throw error
    return { partnerId: data.id, name: data.name, status: data.status }
  })
  
  await test('用户注册', '重复Telegram ID拒绝', async () => {
    const { data: existing } = await supabase.from('users').select('telegram_user_id').limit(1).single()
    if (!existing) throw new Error('No existing user')
    const { error } = await supabase
      .from('users')
      .insert({ telegram_user_id: existing.telegram_user_id, telegram_username: 'duplicate' })
    if (!error) throw new Error('应该拒绝重复Telegram ID')
    return { rejected: true }
  })
  
  await test('用户注册', '空用户名处理', async () => {
    const { data, error } = await supabase
      .from('users')
      .insert({ telegram_user_id: Math.floor(Math.random() * 1000000000) })
      .select()
      .single()
    if (error) throw error
    await supabase.from('users').delete().eq('id', data.id)
    return { created: true }
  })
  
  await test('用户注册', '极长用户名处理', async () => {
    const { data, error } = await supabase
      .from('users')
      .insert({
        telegram_user_id: Math.floor(Math.random() * 1000000000),
        telegram_username: 'a'.repeat(200)
      })
      .select()
      .single()
    if (error) throw error
    await supabase.from('users').delete().eq('id', data.id)
    return { created: true }
  })
  
  await test('用户注册', '特殊字符用户名', async () => {
    const { data, error } = await supabase
      .from('users')
      .insert({
        telegram_user_id: Math.floor(Math.random() * 1000000000),
        telegram_username: '测试_用户-123!@#'
      })
      .select()
      .single()
    if (error) throw error
    await supabase.from('users').delete().eq('id', data.id)
    return { created: true }
  })
  
  await test('用户注册', '负数Telegram ID', async () => {
    const { data, error } = await supabase
      .from('users')
      .insert({ telegram_user_id: -123456789 })
      .select()
      .single()
    if (error) throw error
    await supabase.from('users').delete().eq('id', data.id)
    return { created: true }
  })
  
  await test('用户注册', '极大Telegram ID', async () => {
    const { data, error } = await supabase
      .from('users')
      .insert({ telegram_user_id: Number.MAX_SAFE_INTEGER })
      .select()
      .single()
    if (error) throw error
    await supabase.from('users').delete().eq('id', data.id)
    return { created: true }
  })

  // 3. AI伙伴测试 (10个)
  console.log('\n🤖 3. AI伙伴测试\n')
  
  await test('AI伙伴', '查询详情', async () => {
    if (!testUserId) throw new Error('No test user')
    const { data, error } = await supabase
      .from('ai_partners')
      .select('*')
      .eq('user_id', testUserId)
      .single()
    if (error) throw error
    return { name: data.name, status: data.status, personality: data.personality }
  })
  
  await test('AI伙伴', '更新名称', async () => {
    if (!testUserId) throw new Error('No test user')
    const { data, error } = await supabase
      .from('ai_partners')
      .update({ name: '测试小虾米' })
      .eq('user_id', testUserId)
      .select()
      .single()
    if (error) throw error
    return { name: data.name }
  })
  
  await test('AI伙伴', '更新性格', async () => {
    if (!testUserId) throw new Error('No test user')
    const { data, error } = await supabase
      .from('ai_partners')
      .update({ personality: 'humorous' })
      .eq('user_id', testUserId)
      .select()
      .single()
    if (error) throw error
    return { personality: data.personality }
  })
  
  await test('AI伙伴', '无效性格拒绝', async () => {
    if (!testUserId) throw new Error('No test user')
    const { error } = await supabase
      .from('ai_partners')
      .update({ personality: 'invalid' })
      .eq('user_id', testUserId)
    if (!error) throw new Error('应该拒绝无效性格')
    return { rejected: true }
  })
  
  await test('AI伙伴', '无效状态拒绝', async () => {
    if (!testUserId) throw new Error('No test user')
    const { error } = await supabase
      .from('ai_partners')
      .update({ status: 'invalid' })
      .eq('user_id', testUserId)
    if (!error) throw new Error('应该拒绝无效状态')
    return { rejected: true }
  })
  
  await test('AI伙伴', '贡献值增加', async () => {
    if (!testUserId) throw new Error('No test user')
    const { data: before } = await supabase
      .from('ai_partners')
      .select('current_contribution, total_contribution')
      .eq('user_id', testUserId)
      .single()
    const { data, error } = await supabase
      .from('ai_partners')
      .update({
        current_contribution: (before?.current_contribution || 0) + 10,
        total_contribution: (before?.total_contribution || 0) + 10
      })
      .eq('user_id', testUserId)
      .select()
      .single()
    if (error) throw error
    return { contribution: data.current_contribution }
  })
  
  await test('AI伙伴', '负数贡献值拒绝', async () => {
    if (!testUserId) throw new Error('No test user')
    const { error } = await supabase
      .from('ai_partners')
      .update({ current_contribution: -10 })
      .eq('user_id', testUserId)
    if (!error) throw new Error('应该拒绝负数贡献值')
    return { rejected: true }
  })
  
  await test('AI伙伴', '休眠状态切换', async () => {
    if (!testUserId) throw new Error('No test user')
    const { data, error } = await supabase
      .from('ai_partners')
      .update({ status: 'hibernated', hibernated_since: new Date().toISOString() })
      .eq('user_id', testUserId)
      .select()
      .single()
    if (error) throw error
    await supabase
      .from('ai_partners')
      .update({ status: 'active', hibernated_since: null })
      .eq('user_id', testUserId)
    return { status: data.status }
  })
  
  await test('AI伙伴', '能力解锁更新', async () => {
    if (!testUserId) throw new Error('No test user')
    const { data, error } = await supabase
      .from('ai_partners')
      .update({
        abilities: {
          basic_chat: true,
          emotion_expression: true,
          task_system: false,
          exclusive_memory: false,
          deep_conversation: false,
          self_awareness: false
        }
      })
      .eq('user_id', testUserId)
      .select()
      .single()
    if (error) throw error
    return { abilities: data.abilities }
  })
  
  await test('AI伙伴', '性格分数更新', async () => {
    if (!testUserId) throw new Error('No test user')
    const { data, error } = await supabase
      .from('ai_partners')
      .update({ personality_scores: { emotional: 10, rational: 5, adventurous: 3 } })
      .eq('user_id', testUserId)
      .select()
      .single()
    if (error) throw error
    return { scores: data.personality_scores }
  })

  // 4. 情感冲击功能测试 (12个)
  console.log('\n💜 4. 情感冲击功能测试\n')
  
  const memoryTypes = ['first', 'emotional', 'important', 'deep', 'shared']
  for (const type of memoryTypes) {
    await test('情感冲击', `创建AI记忆-${type}`, async () => {
      if (!testUserId) throw new Error('No test user')
      const { data, error } = await supabase
        .from('ai_memories')
        .insert({ user_id: testUserId, type, content: `测试${type}记忆` })
        .select()
        .single()
      if (error) throw error
      return { memoryId: data.id }
    })
  }
  
  await test('情感冲击', '查询所有记忆', async () => {
    if (!testUserId) throw new Error('No test user')
    const { data, error } = await supabase
      .from('ai_memories')
      .select('*')
      .eq('user_id', testUserId)
    if (error) throw error
    return { count: data?.length || 0 }
  })
  
  const ratings = [
    { rating: 'common', points: 1, reason: '日常问候' },
    { rating: 'active', points: 2, reason: '日常对话' },
    { rating: 'rare', points: 3, reason: '情感表达' },
    { rating: 'precious', points: 5, reason: '深度思考' },
    { rating: 'legendary', points: 8, reason: '特殊回忆' }
  ]
  
  for (const { rating, points, reason } of ratings) {
    await test('情感冲击', `贡献值详情-${rating}`, async () => {
      if (!testUserId) throw new Error('No test user')
      const { data, error } = await supabase
        .from('contribution_details')
        .insert({ user_id: testUserId, points, rating, reason })
        .select()
        .single()
      if (error) throw error
      return { detailId: data.id }
    })
  }
  
  await test('情感冲击', '濒危警告', async () => {
    if (!testUserId) throw new Error('No test user')
    const { data, error } = await supabase
      .from('danger_warnings')
      .insert({
        user_id: testUserId,
        partner_name: '测试AI',
        contribution: 10,
        warning_level: 'low',
        message: '测试警告'
      })
      .select()
      .single()
    if (error) throw error
    return { warningId: data.id }
  })

  // 5. 用户粘性功能测试 (10个)
  console.log('\n🔥 5. 用户粘性功能测试\n')
  
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
  
  await test('用户粘性', '重复登录日期拒绝', async () => {
    if (!testUserId) throw new Error('No test user')
    const { error } = await supabase
      .from('login_records')
      .insert({
        user_id: testUserId,
        login_date: new Date().toISOString().split('T')[0],
        streak_at_login: 1,
        points_earned: 15
      })
    if (!error) throw new Error('应该拒绝重复登录日期')
    return { rejected: true }
  })
  
  await test('用户粘性', '深度对话记录', async () => {
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
  
  await test('用户粘性', '完成深度对话', async () => {
    if (!testUserId) throw new Error('No test user')
    const { data, error } = await supabase
      .from('deep_dialogue_records')
      .update({
        completed: true,
        completed_at: new Date().toISOString(),
        content: '测试内容',
        points_earned: 8
      })
      .eq('user_id', testUserId)
      .eq('completed', false)
      .select()
      .single()
    if (error) throw error
    return { pointsEarned: data.points_earned }
  })
  
  await test('用户粘性', '登录统计视图', async () => {
    const { data, error } = await supabase.from('user_login_stats').select('*').limit(5)
    if (error) throw error
    return { count: data?.length || 0 }
  })
  
  await test('用户粘性', '记忆统计视图', async () => {
    const { data, error } = await supabase.from('memory_stats').select('*').limit(5)
    if (error) throw error
    return { count: data?.length || 0 }
  })
  
  await test('用户粘性', '签到记录', async () => {
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
  
  await test('用户粘性', '用户偏好更新', async () => {
    if (!testUserId) throw new Error('No test user')
    const { data, error } = await supabase
      .from('user_preferences')
      .upsert({
        user_id: testUserId,
        preferred_topics: ['childhood', 'emotion'],
        notification_settings: { push: true, email: false }
      })
      .select()
      .single()
    if (error) throw error
    return { topics: data.preferred_topics }
  })
  
  await test('用户粘性', '用户登录信息更新', async () => {
    if (!testUserId) throw new Error('No test user')
    const { data, error } = await supabase
      .from('users')
      .update({
        last_login: new Date().toISOString(),
        login_streak: 1,
        max_streak: 1
      })
      .eq('id', testUserId)
      .select()
      .single()
    if (error) throw error
    return { streak: data.login_streak }
  })
  
  await test('用户粘性', '签到连击更新', async () => {
    if (!testUserId) throw new Error('No test user')
    const { data, error } = await supabase
      .from('users')
      .update({ checkin_streak: 2, last_checkin: new Date().toISOString() })
      .eq('id', testUserId)
      .select()
      .single()
    if (error) throw error
    return { streak: data.checkin_streak }
  })

  // 6. Telegram支持测试 (6个)
  console.log('\n📱 6. Telegram支持测试\n')
  
  await test('Telegram', 'Telegram用户视图', async () => {
    const { data, error } = await supabase.from('telegram_users').select('*').limit(5)
    if (error) throw error
    return { count: data?.length || 0 }
  })
  
  await test('Telegram', 'Telegram用户包含贡献值', async () => {
    const { data, error } = await supabase.from('telegram_users').select('contribution').limit(1)
    if (error) throw error
    return { hasContribution: data && data.length > 0 }
  })
  
  await test('Telegram', '签到记录查询', async () => {
    if (!testUserId) throw new Error('No test user')
    const { data, error } = await supabase.from('checkin_records').select('*').eq('user_id', testUserId)
    if (error) throw error
    return { count: data?.length || 0 }
  })
  
  await test('Telegram', '重复签到拒绝', async () => {
    if (!testUserId) throw new Error('No test user')
    const { error } = await supabase
      .from('checkin_records')
      .insert({
        user_id: testUserId,
        checkin_date: new Date().toISOString().split('T')[0],
        points_earned: 10,
        streak_at_checkin: 1
      })
    if (!error) throw new Error('应该拒绝重复签到')
    return { rejected: true }
  })
  
  await test('Telegram', 'Telegram信息更新', async () => {
    if (!testUserId) throw new Error('No test user')
    const { data, error } = await supabase
      .from('users')
      .update({ telegram_username: `updated_${Date.now()}` })
      .eq('id', testUserId)
      .select()
      .single()
    if (error) throw error
    return { username: data.telegram_username }
  })
  
  await test('Telegram', '濒危状态视图', async () => {
    const { data, error } = await supabase.from('user_danger_status').select('*').limit(5)
    if (error) throw error
    return { count: data?.length || 0 }
  })

  // 7. 数据完整性测试 (8个)
  console.log('\n🔒 7. 数据完整性测试\n')
  
  await test('数据完整性', '外键约束', async () => {
    const { error } = await supabase
      .from('ai_partners')
      .insert({ user_id: '00000000-0000-0000-0000-000000000000', name: '无效' })
    if (!error) throw new Error('外键约束未生效')
    return { constraintWorking: true }
  })
  
  await test('数据完整性', '唯一约束', async () => {
    if (!testUserId) throw new Error('No test user')
    const { error } = await supabase
      .from('ai_partners')
      .insert({ user_id: testUserId, name: '重复' })
    if (!error) throw new Error('唯一约束未生效')
    return { constraintWorking: true }
  })
  
  await test('数据完整性', 'CHECK约束-性格', async () => {
    if (!testUserId) throw new Error('No test user')
    const { error } = await supabase
      .from('ai_partners')
      .update({ personality: 'invalid' })
      .eq('user_id', testUserId)
    if (!error) throw new Error('CHECK约束未生效')
    return { constraintWorking: true }
  })
  
  await test('数据完整性', 'CHECK约束-状态', async () => {
    if (!testUserId) throw new Error('No test user')
    const { error } = await supabase
      .from('ai_partners')
      .update({ status: 'invalid' })
      .eq('user_id', testUserId)
    if (!error) throw new Error('CHECK约束未生效')
    return { constraintWorking: true }
  })
  
  await test('数据完整性', 'CHECK约束-贡献值', async () => {
    if (!testUserId) throw new Error('No test user')
    const { error } = await supabase
      .from('ai_partners')
      .update({ current_contribution: -1 })
      .eq('user_id', testUserId)
    if (!error) throw new Error('CHECK约束未生效')
    return { constraintWorking: true }
  })
  
  await test('数据完整性', '级联删除', async () => {
    const { data: tempUser } = await supabase
      .from('users')
      .insert({ telegram_user_id: Math.floor(Math.random() * 1000000000) })
      .select()
      .single()
    if (!tempUser) throw new Error('Failed to create temp user')
    await new Promise(r => setTimeout(r, 500))
    await supabase.from('users').delete().eq('id', tempUser.id)
    const { data: partner } = await supabase
      .from('ai_partners')
      .select('id')
      .eq('user_id', tempUser.id)
      .single()
    if (partner) throw new Error('级联删除未生效')
    return { cascadeWorking: true }
  })
  
  await test('数据完整性', '必填字段验证', async () => {
    const { error } = await supabase
      .from('ai_memories')
      .insert({ user_id: testUserId })
    if (!error) throw new Error('必填字段验证未生效')
    return { validationWorking: true }
  })
  
  await test('数据完整性', '空内容拒绝', async () => {
    if (!testUserId) throw new Error('No test user')
    const { error } = await supabase
      .from('ai_memories')
      .insert({ user_id: testUserId, type: 'emotional', content: '' })
    if (!error) throw new Error('空内容应该被拒绝')
    return { validationWorking: true }
  })

  // 8. 性能测试 (10个)
  console.log('\n⚡ 8. 性能测试\n')
  
  await perfTest('性能', '用户表查询', async () => {
    await supabase.from('users').select('*').limit(10)
  }, 30)
  
  await perfTest('性能', 'AI伙伴表查询', async () => {
    await supabase.from('ai_partners').select('*').limit(10)
  }, 30)
  
  await perfTest('性能', 'AI记忆表查询', async () => {
    await supabase.from('ai_memories').select('*').limit(20)
  }, 30)
  
  await perfTest('性能', '贡献值详情查询', async () => {
    await supabase.from('contribution_details').select('*').limit(20)
  }, 30)
  
  await perfTest('性能', '濒危警告查询', async () => {
    await supabase.from('danger_warnings').select('*').limit(20)
  }, 30)
  
  await perfTest('性能', '复杂视图查询', async () => {
    await supabase.from('user_danger_status').select('*').limit(10)
  }, 20)
  
  await perfTest('性能', 'Telegram用户视图', async () => {
    await supabase.from('telegram_users').select('*').limit(10)
  }, 20)
  
  await perfTest('性能', '登录统计视图', async () => {
    await supabase.from('user_login_stats').select('*').limit(10)
  }, 20)
  
  await perfTest('性能', '记忆统计视图', async () => {
    await supabase.from('memory_stats').select('*').limit(10)
  }, 20)
  
  await perfTest('性能', '带条件排序查询', async () => {
    await supabase
      .from('ai_partners')
      .select('*')
      .eq('status', 'active')
      .order('current_contribution', { ascending: false })
      .limit(10)
  }, 20)

  // 9. 清理
  console.log('\n🧹 9. 清理测试数据\n')
  
  await test('清理', '删除测试用户', async () => {
    if (!testUserId) throw new Error('No test user')
    const { error } = await supabase.from('users').delete().eq('id', testUserId)
    if (error) throw error
    return { deleted: true }
  })

  // 测试报告
  console.log('\n' + '='.repeat(70))
  console.log('  测试报告')
  console.log('='.repeat(70) + '\n')

  const passed = results.filter(r => r.passed).length
  const failed = results.filter(r => !r.passed).length
  const totalDuration = results.reduce((sum, r) => sum + r.duration, 0)

  console.log(`总计: ${results.length} 个测试`)
  console.log(`✅ 通过: ${passed}`)
  console.log(`❌ 失败: ${failed}`)
  console.log(`⏱️  总耗时: ${totalDuration}ms`)
  console.log(`📊 通过率: ${((passed / results.length) * 100).toFixed(1)}%`)

  console.log('\n分类统计:')
  const suites = [...new Set(results.map(r => r.suite))]
  for (const suite of suites) {
    const suiteResults = results.filter(r => r.suite === suite)
    const suitePassed = suiteResults.filter(r => r.passed).length
    console.log(`  ${suite}: ${suitePassed}/${suiteResults.length} 通过`)
  }

  const perfResults = results.filter(r => r.suite === '性能' && r.passed)
  if (perfResults.length > 0) {
    console.log('\n性能统计:')
    for (const r of perfResults) {
      if (r.details) {
        console.log(`  ${r.name}: avg=${r.details.avgTime?.toFixed(0)}ms, p50=${r.details.p50Time}ms, p95=${r.details.p95Time}ms`)
      }
    }
  }

  const failedTests = results.filter(r => !r.passed)
  if (failedTests.length > 0) {
    console.log('\n❌ 失败测试详情:')
    for (const t of failedTests) {
      console.log(`  [${t.suite}] ${t.name}: ${t.error}`)
    }
  }

  process.exit(failed > 0 ? 1 : 0)
}

runTests().catch(console.error)