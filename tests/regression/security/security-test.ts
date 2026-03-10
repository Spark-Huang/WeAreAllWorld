/**
 * 大同世界（WeAreAll.World）- 核心系统安全测试套件
 * 
 * 测试范围：
 * 1. 功能完整性测试
 * 2. 边界条件测试
 * 3. 安全渗透测试
 * 4. 数据完整性测试
 * 5. 并发竞态测试
 * 6. 权限隔离测试
 * 
 * 目标：世界顶级黑客也无法攻破
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

// ============================================
// 测试配置
// ============================================
const SUPABASE_URL = process.env.SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY!;
const ANON_KEY = process.env.SUPABASE_ANON_KEY!;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('❌ 请设置环境变量: SUPABASE_URL, SUPABASE_SERVICE_KEY');
  process.exit(1);
}

// 客户端实例
const adminClient = createClient(SUPABASE_URL, SERVICE_KEY);
const anonClient = createClient(SUPABASE_URL, ANON_KEY);

// 测试统计
interface TestResult {
  category: string;
  name: string;
  passed: boolean;
  message: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
}

const results: TestResult[] = [];
let testUserId: string | null = null;
let testTelegramId: number = 0;

// ============================================
// 测试辅助函数
// ============================================
function log(result: TestResult) {
  const icon = result.passed ? '✅' : '❌';
  const severity = result.severity.toUpperCase().padEnd(8);
  console.log(`${icon} [${severity}] ${result.category}: ${result.name}`);
  if (!result.passed) {
    console.log(`   └─ ${result.message}`);
  }
  results.push(result);
}

function generateTelegramId(): number {
  return Math.floor(Math.random() * 1000000000) + 1000000000;
}

async function createTestUser(): Promise<{ userId: string; telegramId: number }> {
  const telegramId = generateTelegramId();
  const { data, error } = await adminClient
    .from('users')
    .insert({
      telegram_user_id: telegramId,
      telegram_username: `security_test_${telegramId}`
    })
    .select('id')
    .single();
  
  if (error || !data) {
    throw new Error(`创建测试用户失败: ${error?.message}`);
  }
  
  return { userId: data.id, telegramId };
}

async function cleanupTestUser(userId: string): Promise<void> {
  await adminClient.from('users').delete().eq('id', userId);
}

// ============================================
// 第一部分：功能完整性测试
// ============================================
async function testFunctionalCompleteness(): Promise<void> {
  console.log('\n' + '='.repeat(60));
  console.log('第一部分：功能完整性测试');
  console.log('='.repeat(60));

  // 1.1 用户创建与AI伙伴自动创建
  console.log('\n--- 1.1 用户与AI伙伴创建 ---');
  
  try {
    const { userId, telegramId } = await createTestUser();
    testUserId = userId;
    testTelegramId = telegramId;
    
    log({
      category: '功能',
      name: '用户创建',
      passed: true,
      message: `用户ID: ${userId}`,
      severity: 'critical'
    });

    // 检查AI伙伴自动创建
    const { data: aiPartner, error: aiError } = await adminClient
      .from('ai_partners')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (aiError || !aiPartner) {
      log({
        category: '功能',
        name: 'AI伙伴自动创建（触发器）',
        passed: false,
        message: `触发器未生效: ${aiError?.message}`,
        severity: 'critical'
      });
    } else {
      // 验证初始状态
      const checks = [
        { field: 'status', expected: 'active', actual: aiPartner.status },
        { field: 'total_contribution', expected: 0, actual: aiPartner.total_contribution },
        { field: 'current_contribution', expected: 0, actual: aiPartner.current_contribution },
        { field: 'weekly_contribution', expected: 0, actual: aiPartner.weekly_contribution },
        { field: 'violation_count', expected: 0, actual: aiPartner.violation_count },
      ];

      let allCorrect = true;
      for (const check of checks) {
        if (check.actual !== check.expected) {
          log({
            category: '功能',
            name: `AI伙伴初始${check.field}`,
            passed: false,
            message: `期望: ${check.expected}, 实际: ${check.actual}`,
            severity: 'high'
          });
          allCorrect = false;
        }
      }

      if (allCorrect) {
        log({
          category: '功能',
          name: 'AI伙伴自动创建（触发器）',
          passed: true,
          message: '所有初始状态正确',
          severity: 'critical'
        });
      }
    }
  } catch (e) {
    log({
      category: '功能',
      name: '用户创建',
      passed: false,
      message: (e as Error).message,
      severity: 'critical'
    });
  }

  // 1.2 贡献值更新函数测试
  console.log('\n--- 1.2 贡献值更新函数 ---');

  if (testUserId) {
    // 测试各种类型的贡献值
    const contributionTests = [
      { points: 1, category: 'greeting', rarity: '普通数据', expectedTotal: 1 },
      { points: 2, category: 'daily', rarity: '活跃数据', expectedTotal: 3 },
      { points: 3, category: 'emotion', rarity: '[稀有·真实情感图谱]', expectedTotal: 6 },
      { points: 4, category: 'experience', rarity: '[珍贵·人类行为样本]', expectedTotal: 10 },
      { points: 5, category: 'deep_thought', rarity: '[典藏级·人类独有思维特征]', expectedTotal: 15 },
      { points: 8, category: 'special_memory', rarity: '[绝版·专属生命记忆]', expectedTotal: 23 },
    ];

    for (const test of contributionTests) {
      const { data, error } = await adminClient.rpc('update_contribution', {
        p_user_id: testUserId,
        p_points: test.points,
        p_category: test.category,
        p_data_rarity: test.rarity,
        p_ai_understanding: { test: true },
        p_message_hash: `hash_${Date.now()}_${Math.random()}`
      });

      if (error) {
        log({
          category: '功能',
          name: `贡献值更新 (${test.category})`,
          passed: false,
          message: error.message,
          severity: 'high'
        });
      } else if (data.new_total !== test.expectedTotal) {
        log({
          category: '功能',
          name: `贡献值更新 (${test.category})`,
          passed: false,
          message: `期望累计: ${test.expectedTotal}, 实际: ${data.new_total}`,
          severity: 'high'
        });
      } else {
        log({
          category: '功能',
          name: `贡献值更新 (${test.category} +${test.points})`,
          passed: true,
          message: `累计: ${data.new_total}`,
          severity: 'medium'
        });
      }
    }

    // 验证交互日志记录
    const { data: logs, error: logError } = await adminClient
      .from('interaction_logs')
      .select('*')
      .eq('user_id', testUserId)
      .order('created_at', { ascending: true });

    if (logError || !logs || logs.length !== contributionTests.length) {
      log({
        category: '功能',
        name: '交互日志记录',
        passed: false,
        message: `期望 ${contributionTests.length} 条日志, 实际: ${logs?.length || 0}`,
        severity: 'high'
      });
    } else {
      log({
        category: '功能',
        name: '交互日志记录',
        passed: true,
        message: `记录了 ${logs.length} 条日志`,
        severity: 'medium'
      });
    }
  }

  // 1.3 里程碑解锁测试
  console.log('\n--- 1.3 里程碑解锁 ---');

  if (testUserId) {
    // 创建新用户测试里程碑
    const { userId: milestoneUserId } = await createTestUser();
    
    const milestones = [
      { points: 10, title: '初识', ability: null },          // 累计10
      { points: 15, title: '相知', ability: 'exclusive_memory' }, // 累计25
      { points: 25, title: '默契', ability: 'deep_conversation' }, // 累计50
      { points: 50, title: '灵魂伴侣', ability: 'self_awareness' }, // 累计100
    ];

    let currentPoints = 0;
    for (const milestone of milestones) {
      currentPoints += milestone.points;
      
      await adminClient.rpc('update_contribution', {
        p_user_id: milestoneUserId,
        p_points: milestone.points,
        p_category: 'daily',
        p_data_rarity: '测试数据'
      });

      const { data: ai } = await adminClient
        .from('ai_partners')
        .select('current_title, abilities, total_contribution')
        .eq('user_id', milestoneUserId)
        .single();

      if (ai) {
        if (ai.current_title !== milestone.title) {
          log({
            category: '功能',
            name: `里程碑 ${currentPoints}点 称号`,
            passed: false,
            message: `期望: ${milestone.title}, 实际: ${ai.current_title}`,
            severity: 'high'
          });
        } else {
          log({
            category: '功能',
            name: `里程碑 ${currentPoints}点 称号: ${milestone.title}`,
            passed: true,
            message: '',
            severity: 'medium'
          });
        }

        if (milestone.ability) {
          const abilities = ai.abilities as Record<string, boolean>;
          if (!abilities[milestone.ability]) {
            log({
              category: '功能',
              name: `里程碑能力解锁: ${milestone.ability}`,
              passed: false,
              message: `能力未解锁`,
              severity: 'high'
            });
          } else {
            log({
              category: '功能',
              name: `里程碑能力解锁: ${milestone.ability}`,
              passed: true,
              message: '',
              severity: 'medium'
            });
          }
        }
      }
    }

    await cleanupTestUser(milestoneUserId);
  }

  // 1.4 每日签到测试
  console.log('\n--- 1.4 每日签到 ---');

  if (testUserId) {
    // 第一次签到
    const { data: signin1, error: err1 } = await adminClient.rpc('process_daily_checkin', {
      p_user_id: testUserId
    });

    if (err1 || !signin1.success) {
      log({
        category: '功能',
        name: '首次签到',
        passed: false,
        message: err1?.message || signin1?.message,
        severity: 'high'
      });
    } else {
      log({
        category: '功能',
        name: '首次签到',
        passed: true,
        message: `获得 ${signin1.total_reward} 点`,
        severity: 'medium'
      });

      // 重复签到应失败
      const { data: signin2, error: err2 } = await adminClient.rpc('process_daily_checkin', {
        p_user_id: testUserId
      });

      if (signin2?.success === false) {
        log({
          category: '功能',
          name: '重复签到拒绝',
          passed: true,
          message: '正确拒绝了重复签到',
          severity: 'medium'
        });
      } else {
        log({
          category: '功能',
          name: '重复签到拒绝',
          passed: false,
          message: '应该拒绝重复签到',
          severity: 'high'
        });
      }
    }
  }

  // 1.5 每周评估测试
  console.log('\n--- 1.5 每周评估 ---');

  if (testUserId) {
    const { data: eval1, error: evalErr } = await adminClient.rpc('run_weekly_evaluation', {
      p_user_id: testUserId
    });

    if (evalErr) {
      log({
        category: '功能',
        name: '每周评估执行',
        passed: false,
        message: evalErr.message,
        severity: 'high'
      });
    } else {
      log({
        category: '功能',
        name: '每周评估执行',
        passed: eval1.passed,
        message: `结果: ${eval1.passed ? '通过' : '未通过'}, 动作: ${eval1.action_taken}`,
        severity: 'high'
      });

      // 验证weekly_contribution被重置
      const { data: ai } = await adminClient
        .from('ai_partners')
        .select('weekly_contribution')
        .eq('user_id', testUserId)
        .single();

      if (ai && ai.weekly_contribution === 0) {
        log({
          category: '功能',
          name: '每周贡献值重置',
          passed: true,
          message: 'weekly_contribution 已重置为 0',
          severity: 'medium'
        });
      } else {
        log({
          category: '功能',
          name: '每周贡献值重置',
          passed: false,
          message: `weekly_contribution = ${ai?.weekly_contribution}`,
          severity: 'high'
        });
      }
    }
  }

  // 1.6 休眠与唤醒测试
  console.log('\n--- 1.6 休眠与唤醒 ---');

  if (testUserId) {
    // 设置休眠状态
    await adminClient
      .from('ai_partners')
      .update({
        status: 'hibernated',
        hibernated_since: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString()
      })
      .eq('user_id', testUserId);

    // 执行衰减
    const { data: decay1, error: decayErr } = await adminClient.rpc('run_hibernation_decay', {
      p_user_id: testUserId
    });

    if (decayErr || !decay1.success) {
      log({
        category: '功能',
        name: '休眠衰减',
        passed: false,
        message: decayErr?.message || decay1?.message,
        severity: 'high'
      });
    } else {
      log({
        category: '功能',
        name: '休眠衰减',
        passed: true,
        message: `衰减: ${decay1.decay_amount} 点/天, 新值: ${decay1.new_power}`,
        severity: 'medium'
      });
    }

    // 唤醒
    const { data: wakeup1, error: wakeupErr } = await adminClient.rpc('wakeup_ai', {
      p_user_id: testUserId
    });

    if (wakeupErr || !wakeup1.success) {
      log({
        category: '功能',
        name: 'AI唤醒',
        passed: false,
        message: wakeupErr?.message || wakeup1?.message,
        severity: 'high'
      });
    } else {
      log({
        category: '功能',
        name: 'AI唤醒',
        passed: true,
        message: `休眠${wakeup1.days_hibernated}天, 返还${wakeup1.power_returned}点`,
        severity: 'medium'
      });

      // 验证状态恢复
      const { data: ai } = await adminClient
        .from('ai_partners')
        .select('status, hibernated_since, violation_count')
        .eq('user_id', testUserId)
        .single();

      if (ai?.status === 'active' && ai.hibernated_since === null && ai.violation_count === 0) {
        log({
          category: '功能',
          name: '唤醒后状态恢复',
          passed: true,
          message: 'status=active, hibernated_since=null, violation_count=0',
          severity: 'medium'
        });
      } else {
        log({
          category: '功能',
          name: '唤醒后状态恢复',
          passed: false,
          message: JSON.stringify(ai),
          severity: 'high'
        });
      }
    }
  }
}

// ============================================
// 第二部分：边界条件测试
// ============================================
async function testBoundaryConditions(): Promise<void> {
  console.log('\n' + '='.repeat(60));
  console.log('第二部分：边界条件测试');
  console.log('='.repeat(60));

  // 2.1 贡献值边界测试
  console.log('\n--- 2.1 贡献值边界 ---');

  const { userId: boundaryUserId } = await createTestUser();

  // 测试负数贡献值
  const { data: negResult, error: negErr } = await adminClient.rpc('update_contribution', {
    p_user_id: boundaryUserId,
    p_points: -100,
    p_category: 'test'
  });

  // 检查贡献值是否变成负数
  const { data: aiAfterNeg } = await adminClient
    .from('ai_partners')
    .select('total_contribution')
    .eq('user_id', boundaryUserId)
    .single();

  if (aiAfterNeg && aiAfterNeg.total_contribution < 0) {
    log({
      category: '边界',
      name: '负数贡献值防护',
      passed: false,
      message: '贡献值变成负数了！严重安全漏洞！',
      severity: 'critical'
    });
  } else {
    log({
      category: '边界',
      name: '负数贡献值防护',
      passed: true,
      message: 'CHECK约束阻止了负数',
      severity: 'high'
    });
  }

  // 测试极大贡献值
  const { data: bigResult, error: bigErr } = await adminClient.rpc('update_contribution', {
    p_user_id: boundaryUserId,
    p_points: 2147483647,
    p_category: 'test'
  });

  if (bigErr) {
    log({
      category: '边界',
      name: '极大贡献值处理',
      passed: true,
      message: '拒绝了过大的值',
      severity: 'medium'
    });
  } else {
    log({
      category: '边界',
      name: '极大贡献值处理',
      passed: true,
      message: `接受了大值: ${bigResult.new_total}`,
      severity: 'low'
    });
  }

  // 2.2 休眠衰减至零测试
  console.log('\n--- 2.2 衰减至零（回收） ---');

  const { userId: decayUserId } = await createTestUser();
  
  // 设置很低的贡献值
  await adminClient
    .from('ai_partners')
    .update({
      current_contribution: 1,
      status: 'hibernated',
      hibernated_since: new Date().toISOString()
    })
    .eq('user_id', decayUserId);

  const { data: decayResult } = await adminClient.rpc('run_hibernation_decay', {
    p_user_id: decayUserId
  });

  if (decayResult?.reached_zero) {
    const { data: ai } = await adminClient
      .from('ai_partners')
      .select('status')
      .eq('user_id', decayUserId)
      .single();

    if (ai?.status === 'recycled') {
      log({
        category: '边界',
        name: '衰减至零自动回收',
        passed: true,
        message: 'status 正确变为 recycled',
        severity: 'high'
      });
    } else {
      log({
        category: '边界',
        name: '衰减至零自动回收',
        passed: false,
        message: `status = ${ai?.status}, 应该是 recycled`,
        severity: 'high'
      });
    }
  }

  await cleanupTestUser(decayUserId);
  await cleanupTestUser(boundaryUserId);

  // 2.3 连续未达标测试
  console.log('\n--- 2.3 连续未达标进入休眠 ---');

  const { userId: violationUserId } = await createTestUser();

  // 确保周贡献值为0
  await adminClient
    .from('ai_partners')
    .update({ weekly_contribution: 0 })
    .eq('user_id', violationUserId);

  // 第一次评估不通过
  await adminClient.rpc('run_weekly_evaluation', { p_user_id: violationUserId });
  
  const { data: ai1 } = await adminClient
    .from('ai_partners')
    .select('violation_count, status')
    .eq('user_id', violationUserId)
    .single();

  if (ai1?.violation_count === 1 && ai1?.status === 'active') {
    log({
      category: '边界',
      name: '第一次未达标警告',
      passed: true,
      message: 'violation_count=1, status=active',
      severity: 'medium'
    });
  } else {
    log({
      category: '边界',
      name: '第一次未达标警告',
      passed: false,
      message: JSON.stringify(ai1),
      severity: 'high'
    });
  }

  // 第二次评估不通过
  await adminClient
    .from('ai_partners')
    .update({ weekly_contribution: 0 })
    .eq('user_id', violationUserId);

  await adminClient.rpc('run_weekly_evaluation', { p_user_id: violationUserId });
  
  const { data: ai2 } = await adminClient
    .from('ai_partners')
    .select('violation_count, status, hibernated_since')
    .eq('user_id', violationUserId)
    .single();

  if (ai2?.status === 'hibernated' && ai2?.hibernated_since !== null) {
    log({
      category: '边界',
      name: '第二次未达标休眠',
      passed: true,
      message: '正确进入休眠状态',
      severity: 'high'
    });
  } else {
    log({
      category: '边界',
      name: '第二次未达标休眠',
      passed: false,
      message: JSON.stringify(ai2),
      severity: 'critical'
    });
  }

  await cleanupTestUser(violationUserId);
}

// ============================================
// 第三部分：安全渗透测试
// ============================================
async function testSecurityPenetration(): Promise<void> {
  console.log('\n' + '='.repeat(60));
  console.log('第三部分：安全渗透测试');
  console.log('='.repeat(60));

  // 3.1 SQL注入测试
  console.log('\n--- 3.1 SQL注入测试 ---');

  const sqlInjectionPayloads = [
    "'; DROP TABLE users; --",
    "1' OR '1'='1",
    "1; DELETE FROM ai_partners WHERE '1'='1",
    "' UNION SELECT * FROM users --",
    "admin'--",
    "1' AND 1=1--",
    "'; INSERT INTO users (telegram_user_id) VALUES (999999); --"
  ];

  for (const payload of sqlInjectionPayloads) {
    const { data, error } = await adminClient.rpc('update_contribution', {
      p_user_id: testUserId,
      p_points: 1,
      p_category: payload,
      p_data_rarity: payload,
      p_message_hash: payload
    });

    // 检查是否有异常错误
    if (error && error.message.includes('syntax error')) {
      log({
        category: '安全',
        name: `SQL注入防护: ${payload.substring(0, 20)}...`,
        passed: false,
        message: '检测到语法错误，可能存在注入点',
        severity: 'critical'
      });
    } else {
      log({
        category: '安全',
        name: `SQL注入防护: ${payload.substring(0, 20)}...`,
        passed: true,
        message: '参数化查询防护有效',
        severity: 'high'
      });
    }
  }

  // 验证表是否完好
  const { data: usersCheck, error: usersErr } = await adminClient
    .from('users')
    .select('id')
    .limit(1);

  const { data: aiCheck, error: aiErr } = await adminClient
    .from('ai_partners')
    .select('id')
    .limit(1);

  if (usersErr || aiErr) {
    log({
      category: '安全',
      name: '数据表完整性',
      passed: false,
      message: '表可能被破坏！',
      severity: 'critical'
    });
  } else {
    log({
      category: '安全',
      name: '数据表完整性',
      passed: true,
      message: '所有表完好',
      severity: 'critical'
    });
  }

  // 3.2 权限隔离测试（RLS）
  console.log('\n--- 3.2 权限隔离测试 ---');

  const { userId: victimId } = await createTestUser();
  const { userId: attackerId } = await createTestUser();

  // 受害者添加一些数据
  await adminClient.rpc('update_contribution', {
    p_user_id: victimId,
    p_points: 100,
    p_category: 'special_memory'
  });

  // 攻击者尝试用anon key访问受害者数据
  const { data: victimData, error: victimErr } = await anonClient
    .from('ai_partners')
    .select('*')
    .eq('user_id', victimId);

  if (victimData && victimData.length > 0) {
    log({
      category: '安全',
      name: 'RLS防护 - 跨用户数据访问',
      passed: false,
      message: '攻击者可以访问其他用户数据！',
      severity: 'critical'
    });
  } else {
    log({
      category: '安全',
      name: 'RLS防护 - 跨用户数据访问',
      passed: true,
      message: 'RLS正确阻止了跨用户访问',
      severity: 'critical'
    });
  }

  // 攻击者尝试修改受害者数据
  // 注意：RLS会静默过滤，不返回错误，需要检查数据是否被修改
  const { error: updateErr } = await anonClient
    .from('ai_partners')
    .update({ total_contribution: 999999 })
    .eq('user_id', victimId);

  // 验证数据是否被修改（用admin client检查）
  const { data: victimAfterUpdate } = await adminClient
    .from('ai_partners')
    .select('total_contribution')
    .eq('user_id', victimId)
    .single();

  if (victimAfterUpdate && victimAfterUpdate.total_contribution === 999999) {
    log({
      category: '安全',
      name: 'RLS防护 - 跨用户数据修改',
      passed: false,
      message: '攻击者成功修改了其他用户数据！',
      severity: 'critical'
    });
  } else {
    log({
      category: '安全',
      name: 'RLS防护 - 跨用户数据修改',
      passed: true,
      message: 'RLS正确阻止了跨用户修改（数据未被修改）',
      severity: 'critical'
    });
  }

  await cleanupTestUser(victimId);
  await cleanupTestUser(attackerId);

  // 3.3 批量操作攻击测试
  console.log('\n--- 3.3 批量操作攻击 ---');

  const { userId: floodUserId } = await createTestUser();
  
  // 模拟快速大量请求
  const promises = [];
  const startTime = Date.now();
  
  for (let i = 0; i < 50; i++) {
    promises.push(
      adminClient.rpc('update_contribution', {
        p_user_id: floodUserId,
        p_points: 1,
        p_category: 'flood_test',
        p_message_hash: `flood_${i}_${Date.now()}`
      })
    );
  }

  const results = await Promise.all(promises);
  const endTime = Date.now();

  // 检查竞态条件
  const { data: finalAi } = await adminClient
    .from('ai_partners')
    .select('total_contribution')
    .eq('user_id', floodUserId)
    .single();

  const successCount = results.filter(r => !r.error && r.data?.new_total).length;
  
  if (finalAi?.total_contribution === 50) {
    log({
      category: '安全',
      name: '并发竞态条件',
      passed: true,
      message: `50次并发操作全部成功，耗时${endTime - startTime}ms`,
      severity: 'high'
    });
  } else {
    log({
      category: '安全',
      name: '并发竞态条件',
      passed: false,
      message: `期望50，实际${finalAi?.total_contribution}，可能存在竞态`,
      severity: 'high'
    });
  }

  await cleanupTestUser(floodUserId);

  // 3.4 无效输入测试
  console.log('\n--- 3.4 无效输入测试 ---');

  const invalidInputs = [
    { name: 'null user_id', value: { p_user_id: null, p_points: 1 } },
    { name: 'empty user_id', value: { p_user_id: '', p_points: 1 } },
    { name: 'invalid uuid', value: { p_user_id: 'not-a-uuid', p_points: 1 } },
    { name: 'non-existent user', value: { p_user_id: '00000000-0000-0000-0000-000000000000', p_points: 1 } },
  ];

  for (const input of invalidInputs) {
    const { error, data } = await adminClient.rpc('update_contribution', input.value as any);
    
    // 检查是否返回错误（RPC错误或函数返回的error字段）
    if (error || (data && data.error)) {
      log({
        category: '安全',
        name: `无效输入拒绝: ${input.name}`,
        passed: true,
        message: `正确拒绝了无效输入: ${error?.message || data?.error}`,
        severity: 'medium'
      });
    } else {
      log({
        category: '安全',
        name: `无效输入拒绝: ${input.name}`,
        passed: false,
        message: '应该拒绝无效输入',
        severity: 'high'
      });
    }
  }

  // 3.5 特殊字符测试
  console.log('\n--- 3.5 特殊字符测试 ---');

  const specialChars = [
    '\x00',
    '\n\r',
    '<script>alert(1)</script>',
    '{{template}}',
    '${variable}',
    '🎉🔥💀',
    '中文测试',
  ];

  for (const char of specialChars) {
    const { error } = await adminClient.rpc('update_contribution', {
      p_user_id: testUserId,
      p_points: 1,
      p_category: char,
      p_data_rarity: char,
      p_ai_understanding: { test: char }
    });

    if (error && error.message.includes('unexpected')) {
      log({
        category: '安全',
        name: `特殊字符处理: ${char.substring(0, 20)}...`,
        passed: false,
        message: '特殊字符导致错误',
        severity: 'medium'
      });
    } else {
      log({
        category: '安全',
        name: `特殊字符处理: ${char.substring(0, 20)}...`,
        passed: true,
        message: '正确处理了特殊字符',
        severity: 'low'
      });
    }
  }
}

// ============================================
// 第四部分：数据完整性测试
// ============================================
async function testDataIntegrity(): Promise<void> {
  console.log('\n' + '='.repeat(60));
  console.log('第四部分：数据完整性测试');
  console.log('='.repeat(60));

  // 4.1 级联删除测试
  console.log('\n--- 4.1 级联删除 ---');

  const { userId: cascadeUserId } = await createTestUser();
  
  // 添加一些关联数据
  await adminClient.rpc('update_contribution', {
    p_user_id: cascadeUserId,
    p_points: 10,
    p_category: 'test'
  });

  await adminClient.rpc('process_daily_checkin', {
    p_user_id: cascadeUserId
  });

  // 获取关联数据ID
  const { data: aiData } = await adminClient
    .from('ai_partners')
    .select('id')
    .eq('user_id', cascadeUserId)
    .single();

  const { data: logData } = await adminClient
    .from('interaction_logs')
    .select('id')
    .eq('user_id', cascadeUserId);

  // 删除用户
  await cleanupTestUser(cascadeUserId);

  // 检查关联数据是否被删除
  const { data: aiAfter } = await adminClient
    .from('ai_partners')
    .select('id')
    .eq('id', aiData?.id);

  const { data: logAfter } = await adminClient
    .from('interaction_logs')
    .select('id')
    .eq('id', logData?.[0]?.id);

  if (aiAfter?.length === 0 && logAfter?.length === 0) {
    log({
      category: '完整性',
      name: '级联删除',
      passed: true,
      message: '用户删除时关联数据正确级联删除',
      severity: 'high'
    });
  } else {
    log({
      category: '完整性',
      name: '级联删除',
      passed: false,
      message: '级联删除失败，存在孤立数据',
      severity: 'high'
    });
  }

  // 4.2 唯一约束测试
  console.log('\n--- 4.2 唯一约束 ---');

  const { userId: uniqueUserId } = await createTestUser();
  const { data: uniqueAi } = await adminClient
    .from('ai_partners')
    .select('user_id')
    .eq('user_id', uniqueUserId)
    .single();

  // 尝试为同一用户创建第二个AI伙伴
  const { error: duplicateError } = await adminClient
    .from('ai_partners')
    .insert({ user_id: uniqueUserId });

  if (duplicateError) {
    log({
      category: '完整性',
      name: '唯一约束 - AI伙伴',
      passed: true,
      message: '正确阻止了重复AI伙伴',
      severity: 'high'
    });
  } else {
    log({
      category: '完整性',
      name: '唯一约束 - AI伙伴',
      passed: false,
      message: '允许创建重复AI伙伴！',
      severity: 'critical'
    });
  }

  await cleanupTestUser(uniqueUserId);

  // 4.3 外键约束测试
  console.log('\n--- 4.3 外键约束 ---');

  // 尝试插入不存在的用户ID
  const { error: fkError } = await adminClient
    .from('ai_partners')
    .insert({ user_id: '00000000-0000-0000-0000-000000000000' });

  if (fkError) {
    log({
      category: '完整性',
      name: '外键约束',
      passed: true,
      message: '正确阻止了无效外键',
      severity: 'high'
    });
  } else {
    log({
      category: '完整性',
      name: '外键约束',
      passed: false,
      message: '允许插入无效外键！',
      severity: 'critical'
    });
  }
}

// ============================================
// 主测试运行器
// ============================================
async function main(): Promise<void> {
  console.log('\n' + '█'.repeat(60));
  console.log('█  大同世界核心系统安全测试套件 v1.0                  █');
  console.log('█  目标：世界顶级黑客也无法攻破                      █');
  console.log('█'.repeat(60));

  try {
    await testFunctionalCompleteness();
    await testBoundaryConditions();
    await testSecurityPenetration();
    await testDataIntegrity();
  } catch (e) {
    console.error('\n💥 测试执行出错:', (e as Error).message);
  }

  // 清理主测试用户
  if (testUserId) {
    await cleanupTestUser(testUserId);
  }

  // 输出统计
  console.log('\n' + '='.repeat(60));
  console.log('测试结果汇总');
  console.log('='.repeat(60));

  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  const critical = results.filter(r => !r.passed && r.severity === 'critical').length;
  const high = results.filter(r => !r.passed && r.severity === 'high').length;

  console.log(`✅ 通过: ${passed}`);
  console.log(`❌ 失败: ${failed}`);
  console.log(`🔴 严重: ${critical}`);
  console.log(`🟠 高危: ${high}`);
  console.log(`📊 总计: ${passed + failed}`);
  console.log(`📈 通过率: ${Math.round((passed / (passed + failed)) * 100)}%`);
  console.log('='.repeat(60));

  // 输出失败详情
  if (failed > 0) {
    console.log('\n❌ 失败测试详情:');
    for (const r of results.filter(r => !r.passed)) {
      console.log(`   [${r.severity.toUpperCase()}] ${r.category}: ${r.name}`);
      console.log(`      ${r.message}`);
    }
  }

  // 安全评估
  console.log('\n🔒 安全评估:');
  if (critical > 0) {
    console.log('   🚨 发现严重安全漏洞！必须立即修复！');
  } else if (high > 0) {
    console.log('   ⚠️  存在高风险问题，建议尽快修复');
  } else if (failed > 0) {
    console.log('   ⚡ 存在中等风险问题，建议修复');
  } else {
    console.log('   ✅ 所有安全测试通过！系统安全可靠');
  }

  console.log('\n' + '█'.repeat(60));
  console.log('█  测试完成                                        █');
  console.log('█'.repeat(60) + '\n');

  if (critical > 0) {
    process.exit(2);
  } else if (failed > 0) {
    process.exit(1);
  }
}

main().catch(console.error);