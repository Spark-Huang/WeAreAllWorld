/**
 * 端到端测试脚本
 * 测试完整用户流程
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { execSync } from 'child_process';

dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY!;
const API_BASE = 'http://localhost:3000/api/v1';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

let passCount = 0;
let failCount = 0;

function check(name: string, condition: boolean) {
  if (condition) {
    console.log(`✅ ${name}`);
    passCount++;
  } else {
    console.log(`❌ ${name}`);
    failCount++;
  }
}

async function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// 类型定义
interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    rechargeUrl?: string;
  };
}

interface AIPartner {
  id: string;
  name: string;
  status: string;
  total_contribution: number;
}

interface DialogueResult {
  aiReply: string;
  qualityResult: {
    qualityType: string;
    points: number;
  };
}

interface StoryProgress {
  currentChapter: number;
  currentScene: string;
  completedChapters: number[];
  totalRewards: number;
}

interface StoryScene {
  id: string;
  type: string;
  content: string;
  choices?: Array<{ text: string; nextScene: string }>;
}

async function runTests() {
  console.log('🧪 完整端到端测试');
  console.log('========================================');

  // 生成新用户
  const testEmail = `e2e_${Date.now()}@test.local`;
  const testPassword = 'Test@123456';
  let userId: string;
  let token: string;
  let newApiUserId: number | null = null;

  try {
    // ========== 1. 注册流程 ==========
    console.log('\n📱 1. 注册流程');

    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email: testEmail,
      password: testPassword
    });
    check('注册成功', !signUpError && signUpData.user !== null);
    
    userId = signUpData.user!.id;
    token = signUpData.session!.access_token;
    
    await delay(500);

    // ========== 2. 用户初始化 ==========
    console.log('\n👤 2. 用户初始化');

    const ensureRes = await fetch(`${API_BASE}/auth/ensure-user`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ telegramUsername: testEmail.split('@')[0] })
    });
    const ensureData = await ensureRes.json() as ApiResponse;
    check('用户记录创建', ensureData.success === true);

    await delay(500);

    // ========== 3. AI 伙伴 ==========
    console.log('\n🤖 3. AI 伙伴');

    const partnerRes = await fetch(`${API_BASE}/ai-partner`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const partnerData = await partnerRes.json() as ApiResponse<AIPartner>;
    check('AI 伙伴获取', partnerData.success === true);
    check('AI 伙伴状态正常', partnerData.data?.status === 'active');
    check('初始贡献值为 0', partnerData.data?.total_contribution === 0);

    await delay(500);

    // ========== 4. 对话功能 ==========
    console.log('\n💬 4. 对话功能');

    const dialogue1 = await fetch(`${API_BASE}/dialogue`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ message: '你好！很高兴认识你！' })
    });
    const d1 = await dialogue1.json() as ApiResponse<DialogueResult>;
    check('对话成功', d1.success === true);
    check('AI 有回复', (d1.data?.aiReply?.length || 0) > 0);
    check('获得贡献值', (d1.data?.qualityResult?.points || 0) > 0);

    await delay(500);

    // ========== 5. AI 改名 ==========
    console.log('\n✏️ 5. AI 改名');

    const renameRes = await fetch(`${API_BASE}/ai-partner/name`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ name: '测试小助手' })
    });
    const renameData = await renameRes.json() as ApiResponse;
    check('改名成功', renameData.success === true);

    // 验证改名
    const partnerRes2 = await fetch(`${API_BASE}/ai-partner`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const partnerData2 = await partnerRes2.json() as ApiResponse<AIPartner>;
    check('改名生效', partnerData2.data?.name === '测试小助手');

    await delay(500);

    // ========== 6. 签到 ==========
    console.log('\n📅 6. 签到');

    const checkinRes = await fetch(`${API_BASE}/ai-partner/checkin`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const checkinData = await checkinRes.json() as ApiResponse<{ totalReward: number }>;
    check('签到成功', checkinData.success === true);
    check('签到奖励', (checkinData.data?.totalReward || 0) > 0);

    await delay(500);

    // ========== 7. 聊天记录 ==========
    console.log('\n📝 7. 聊天记录');

    const historyRes = await fetch(`${API_BASE}/dialogue/history?limit=10`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const historyData = await historyRes.json() as ApiResponse<Array<{ understanding?: { userMessage?: string; aiReply?: string } }>>;
    check('聊天记录获取', historyData.success === true);

    const validMessages = historyData.data?.filter(
      log => log.understanding?.userMessage && log.understanding?.aiReply
    ).length || 0;
    check('聊天记录有效', validMessages > 0);

    await delay(500);

    // ========== 8. Token 额度 ==========
    console.log('\n🔋 8. Token 额度');

    const quotaRes = await fetch(`${API_BASE}/new-api/quota`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const quotaData = await quotaRes.json() as ApiResponse<{ quota: number }>;
    check('额度查询成功', quotaData.success === true);
    check('初始额度正确', (quotaData.data?.quota || 0) >= 100000);

    await delay(500);

    // ========== 9. 充值弹窗测试 ==========
    console.log('\n💳 9. 充值弹窗');

    // 获取 New API 用户 ID
    const { data: userData } = await supabase
      .from('users')
      .select('new_api_user_id')
      .eq('id', userId)
      .single();

    newApiUserId = userData?.new_api_user_id;

    if (newApiUserId) {
      // 设置额度为 500
      execSync(`docker exec new-api-postgres psql -U postgres -d newapi -c "UPDATE users SET quota = 500 WHERE id = ${newApiUserId};"`, { stdio: 'pipe' });
      await supabase.from('users').update({ new_api_quota: 500 }).eq('id', userId);

      // 尝试对话
      const lowQuotaRes = await fetch(`${API_BASE}/dialogue`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ message: '测试额度不足' })
      });
      const lowQuotaData = await lowQuotaRes.json() as ApiResponse<DialogueResult>;

      check('额度不足返回错误', lowQuotaData.error?.code === 'QUOTA_EXCEEDED');
      check('返回充值链接', (lowQuotaData.error?.rechargeUrl?.length || 0) > 0);

      // 恢复额度
      execSync(`docker exec new-api-postgres psql -U postgres -d newapi -c "UPDATE users SET quota = 150000 WHERE id = ${newApiUserId};"`, { stdio: 'pipe' });
      await supabase.from('users').update({ new_api_quota: 150000 }).eq('id', userId);
    } else {
      console.log('⚠️ 跳过充值弹窗测试（无 New API 用户）');
    }

    await delay(500);

    // ========== 10. 剧情系统 ==========
    console.log('\n📖 10. 剧情系统');

    const storyRes = await fetch(`${API_BASE}/story`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const storyData = await storyRes.json() as ApiResponse<{
      currentScene: StoryScene;
      progress: StoryProgress;
    }>;
    check('剧情获取成功', storyData.success === true);
    check('剧情有当前场景', storyData.data?.currentScene !== undefined);
    check('剧情有进度', storyData.data?.progress !== undefined);

    // 获取章节列表（单独 API）
    const chaptersRes = await fetch(`${API_BASE}/story/chapters`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const chaptersData = await chaptersRes.json() as ApiResponse<Array<{ id: number; name: string }>>;
    check('章节列表获取成功', chaptersData.success === true);
    check('章节数量正确', chaptersData.data?.length === 5);

    await delay(500);

    // ========== 11. 里程碑 ==========
    console.log('\n🏆 11. 里程碑');

    const milestonesRes = await fetch(`${API_BASE}/ai-partner/milestones`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const milestonesData = await milestonesRes.json() as ApiResponse<Array<{ points: number }>>;
    check('里程碑获取成功', milestonesData.success === true);
    check('里程碑列表有效', (milestonesData.data?.length || 0) > 0);

    // ========== 12. 最终贡献值 ==========
    console.log('\n📊 12. 最终贡献值');

    const finalPartnerRes = await fetch(`${API_BASE}/ai-partner`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const finalPartnerData = await finalPartnerRes.json() as ApiResponse<AIPartner>;
    check('贡献值增加', (finalPartnerData.data?.total_contribution || 0) > 0);

    console.log(`\n最终贡献值: ${finalPartnerData.data?.total_contribution}`);

    // ========== 清理 ==========
    console.log('\n🧹 清理测试用户...');
    await supabase.auth.admin.deleteUser(userId);
    console.log('✅ 已清理');

  } catch (err: any) {
    console.error('\n❌ 测试出错:', err.message);
    failCount++;
  }

  // ========== 结果汇总 ==========
  console.log('\n========================================');
  console.log('📊 测试结果汇总');
  console.log('========================================');
  console.log(`✅ 通过: ${passCount}`);
  console.log(`❌ 失败: ${failCount}`);
  console.log(`📈 通过率: ${Math.round(passCount / (passCount + failCount) * 100)}%`);
  console.log('========================================');

  if (failCount === 0) {
    console.log('\n🎉 所有测试通过！');
  }

  process.exit(failCount > 0 ? 1 : 0);
}

runTests();