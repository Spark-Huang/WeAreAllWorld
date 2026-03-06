/**
 * 共生世界（WeAreAll.World）- Supabase接口白盒测试
 * 
 * 测试范围：
 * 1. 数据库表结构
 * 2. 数据库函数
 * 3. 触发器
 * 4. RLS策略
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

// 加载环境变量
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ 请设置 SUPABASE_URL 和 SUPABASE_SERVICE_KEY 环境变量');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// 测试结果统计
let passed = 0;
let failed = 0;

/**
 * 测试辅助函数
 */
async function test(name: string, fn: () => Promise<boolean>): Promise<void> {
  try {
    const result = await fn();
    if (result) {
      console.log(`✅ ${name}`);
      passed++;
    } else {
      console.log(`❌ ${name}`);
      failed++;
    }
  } catch (error) {
    console.log(`❌ ${name}`);
    console.log(`   错误: ${(error as Error).message}`);
    failed++;
  }
}

/**
 * 生成测试用的Telegram用户ID
 */
function generateTestTelegramId(): number {
  return Math.floor(Math.random() * 1000000000) + 1000000000;
}

/**
 * 测试套件
 */
async function runTests(): Promise<void> {
  console.log('\n========================================');
  console.log('共生世界 Supabase 接口白盒测试');
  console.log('========================================\n');

  const testTelegramId = generateTestTelegramId();
  let testUserId: string | null = null;

  // ============================================
  // 1. 用户表测试
  // ============================================
  console.log('📋 1. 用户表测试\n');

  await test('创建用户', async () => {
    const { data, error } = await supabase
      .from('users')
      .insert({
        telegram_user_id: testTelegramId,
        telegram_username: `test_user_${testTelegramId}`
      })
      .select()
      .single();
    
    if (error) {
      console.log(`   错误详情: ${error.message}`);
      return false;
    }
    testUserId = data.id;
    console.log(`   用户ID: ${data.id}`);
    return !!data.id;
  });

  await test('查询用户', async () => {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('telegram_user_id', testTelegramId)
      .single();
    
    return !error && data.telegram_user_id === testTelegramId;
  });

  // ============================================
  // 2. AI伙伴表测试（触发器自动创建）
  // ============================================
  console.log('\n📋 2. AI伙伴表测试\n');

  await test('触发器自动创建AI伙伴', async () => {
    const { data, error } = await supabase
      .from('ai_partners')
      .select('*')
      .eq('user_id', testUserId)
      .single();
    
    if (error) {
      console.log(`   错误详情: ${error.message}`);
      return false;
    }
    console.log(`   AI伙伴ID: ${data.id}`);
    console.log(`   初始状态: ${data.status}`);
    console.log(`   初始贡献值: total=${data.total_contribution}, current=${data.current_contribution}, weekly=${data.weekly_contribution}`);
    return data.status === 'active' && data.total_contribution === 0;
  });

  // ============================================
  // 3. update_contribution 函数测试
  // ============================================
  console.log('\n📋 3. update_contribution 函数测试\n');

  await test('添加贡献值（日常对话 +2点）', async () => {
    const { data, error } = await supabase.rpc('update_contribution', {
      p_user_id: testUserId,
      p_points: 2,
      p_category: 'daily',
      p_data_rarity: '活跃数据',
      p_ai_understanding: { emotion: 'neutral' },
      p_message_hash: 'test_hash_1'
    });
    
    if (error) {
      console.log(`   错误详情: ${error.message}`);
      return false;
    }
    console.log(`   新增点数: ${data.points_added}`);
    console.log(`   累计贡献值: ${data.new_total}`);
    return data.new_total === 2 && data.new_weekly === 2;
  });

  await test('添加贡献值（情感表达 +3点）', async () => {
    const { data, error } = await supabase.rpc('update_contribution', {
      p_user_id: testUserId,
      p_points: 3,
      p_category: 'emotion',
      p_data_rarity: '[稀有·真实情感图谱]',
      p_ai_understanding: { emotion: 'happy' },
      p_message_hash: 'test_hash_2'
    });
    
    if (error) {
      console.log(`   错误详情: ${error.message}`);
      return false;
    }
    console.log(`   累计贡献值: ${data.new_total}`);
    return data.new_total === 5;
  });

  await test('添加贡献值（深度思考 +5点）', async () => {
    const { data, error } = await supabase.rpc('update_contribution', {
      p_user_id: testUserId,
      p_points: 5,
      p_category: 'deep_thought',
      p_data_rarity: '[典藏级·人类独有思维特征]',
      p_ai_understanding: { topic: '人生意义' },
      p_message_hash: 'test_hash_3'
    });
    
    if (error) {
      console.log(`   错误详情: ${error.message}`);
      return false;
    }
    console.log(`   累计贡献值: ${data.new_total}`);
    return data.new_total === 10;
  });

  await test('检查里程碑解锁（10点 - 初识）', async () => {
    const { data, error } = await supabase
      .from('ai_partners')
      .select('current_title, total_contribution')
      .eq('user_id', testUserId)
      .single();
    
    if (error) return false;
    console.log(`   当前称号: ${data.current_title}`);
    return data.current_title === '初识';
  });

  // ============================================
  // 4. 每日签到函数测试
  // ============================================
  console.log('\n📋 4. 每日签到函数测试\n');

  await test('每日签到', async () => {
    const { data, error } = await supabase.rpc('process_daily_checkin', {
      p_user_id: testUserId
    });
    
    if (error) {
      console.log(`   错误详情: ${error.message}`);
      return false;
    }
    console.log(`   签到结果: ${data.success ? '成功' : '失败'}`);
    console.log(`   连续天数: ${data.streak_count}`);
    console.log(`   获得奖励: ${data.total_reward}点`);
    return data.success === true;
  });

  await test('重复签到应失败', async () => {
    const { data, error } = await supabase.rpc('process_daily_checkin', {
      p_user_id: testUserId
    });
    
    return data.success === false;
  });

  // ============================================
  // 5. 每周评估函数测试
  // ============================================
  console.log('\n📋 5. 每周评估函数测试\n');

  await test('执行每周评估（应通过）', async () => {
    const { data, error } = await supabase.rpc('run_weekly_evaluation', {
      p_user_id: testUserId
    });
    
    if (error) {
      console.log(`   错误详情: ${error.message}`);
      return false;
    }
    console.log(`   评估结果: ${data.passed ? '通过' : '未通过'}`);
    console.log(`   本周贡献值: ${data.achieved_power}/${data.required_power}`);
    console.log(`   执行动作: ${data.action_taken}`);
    return data.passed === true;
  });

  // ============================================
  // 6. 交互日志测试
  // ============================================
  console.log('\n📋 6. 交互日志测试\n');

  await test('查询交互日志', async () => {
    const { data, error } = await supabase
      .from('interaction_logs')
      .select('*')
      .eq('user_id', testUserId)
      .order('created_at', { ascending: false });
    
    if (error) {
      console.log(`   错误详情: ${error.message}`);
      return false;
    }
    console.log(`   日志数量: ${data.length}`);
    data.slice(0, 3).forEach((log, i) => {
      console.log(`   [${i + 1}] ${log.category}: +${log.granted_power}点 (${log.data_rarity})`);
    });
    return data.length >= 3;
  });

  // ============================================
  // 7. 获取统计信息测试
  // ============================================
  console.log('\n📋 7. 获取统计信息测试\n');

  await test('获取本周统计', async () => {
    const { data, error } = await supabase.rpc('get_weekly_stats', {
      p_user_id: testUserId
    });
    
    if (error) {
      console.log(`   错误详情: ${error.message}`);
      return false;
    }
    console.log(`   本周贡献值: ${data.weekly_power}`);
    console.log(`   对话次数: ${data.dialogue_count}`);
    console.log(`   签到次数: ${data.signin_count}`);
    console.log(`   活跃等级: ${data.activity_level}`);
    console.log(`   进度: ${Math.round(data.progress_percent)}%`);
    return data.dialogue_count >= 3;
  });

  await test('获取用户完整信息', async () => {
    const { data, error } = await supabase.rpc('get_user_full_info', {
      p_telegram_user_id: testTelegramId
    });
    
    if (error) {
      console.log(`   错误详情: ${error.message}`);
      return false;
    }
    console.log(`   用户ID: ${data.user.id}`);
    console.log(`   AI伙伴状态: ${data.ai_partner?.status}`);
    console.log(`   累计贡献值: ${data.ai_partner?.total_contribution}`);
    return !!data.user && !!data.ai_partner;
  });

  // ============================================
  // 8. 休眠与唤醒测试
  // ============================================
  console.log('\n📋 8. 休眠与唤醒测试\n');

  await test('手动设置休眠状态', async () => {
    const { error } = await supabase
      .from('ai_partners')
      .update({
        status: 'hibernated',
        hibernated_since: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString() // 3天前
      })
      .eq('user_id', testUserId);
    
    return !error;
  });

  await test('执行休眠衰减', async () => {
    const { data, error } = await supabase.rpc('run_hibernation_decay', {
      p_user_id: testUserId
    });
    
    if (error) {
      console.log(`   错误详情: ${error.message}`);
      return false;
    }
    console.log(`   衰减前: ${data.previous_power}`);
    console.log(`   衰减后: ${data.new_power}`);
    console.log(`   衰减量: ${data.decay_amount}`);
    return data.success === true && data.decay_amount === 2;
  });

  await test('唤醒AI', async () => {
    const { data, error } = await supabase.rpc('wakeup_ai', {
      p_user_id: testUserId
    });
    
    if (error) {
      console.log(`   错误详情: ${error.message}`);
      return false;
    }
    console.log(`   休眠天数: ${data.days_hibernated}`);
    console.log(`   损失贡献值: ${data.power_lost}`);
    console.log(`   返还贡献值: ${data.power_returned}`);
    console.log(`   新贡献值: ${data.new_power}`);
    return data.success === true;
  });

  // ============================================
  // 9. 清理测试数据
  // ============================================
  console.log('\n📋 9. 清理测试数据\n');

  await test('删除测试用户（级联删除相关数据）', async () => {
    const { error } = await supabase
      .from('users')
      .delete()
      .eq('id', testUserId);
    
    return !error;
  });

  // ============================================
  // 测试结果汇总
  // ============================================
  console.log('\n========================================');
  console.log('测试结果汇总');
  console.log('========================================');
  console.log(`✅ 通过: ${passed}`);
  console.log(`❌ 失败: ${failed}`);
  console.log(`📊 总计: ${passed + failed}`);
  console.log(`📈 通过率: ${Math.round((passed / (passed + failed)) * 100)}%`);
  console.log('========================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

// 运行测试
runTests().catch(console.error);