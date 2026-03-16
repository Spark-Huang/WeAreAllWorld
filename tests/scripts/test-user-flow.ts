/**
 * 测试新用户流程：注册 → 创建AI伙伴 → 更新贡献值
 */

import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { resolve } from 'path'

config({ path: resolve(__dirname, '../.env') })

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY!
)

async function testUserFlow() {
  console.log('\n=== 测试新用户流程 ===\n')
  
  // 1. 创建新用户
  console.log('1️⃣ 创建新用户...')
  const telegramId = Math.floor(Math.random() * 1000000000)
  const username = `test_${Date.now()}`
  
  const { data: user, error: userError } = await supabase
    .from('users')
    .insert({
      telegram_user_id: telegramId,
      telegram_username: username
    })
    .select()
    .single()
  
  if (userError) {
    console.log('❌ 创建用户失败:', userError.message)
    return
  }
  console.log('✅ 用户创建成功:', user.id)
  
  // 2. 检查AI伙伴是否自动创建
  console.log('\n2️⃣ 检查AI伙伴（应该自动创建）...')
  const { data: partner, error: partnerError } = await supabase
    .from('ai_partners')
    .select('*')
    .eq('user_id', user.id)
    .single()
  
  if (partnerError) {
    console.log('❌ 查询AI伙伴失败:', partnerError.message)
  } else {
    console.log('✅ AI伙伴已自动创建:')
    console.log('   - 名称:', partner.name)
    console.log('   - 状态:', partner.status)
    console.log('   - 性格:', partner.personality)
    console.log('   - 当前贡献值:', partner.current_contribution)
  }
  
  // 3. 更新贡献值
  console.log('\n3️⃣ 更新贡献值...')
  const { data: updatedPartner, error: updateError } = await supabase
    .from('ai_partners')
    .update({
      current_contribution: 25,
      total_contribution: 25
    })
    .eq('user_id', user.id)
    .select()
    .single()
  
  if (updateError) {
    console.log('❌ 更新贡献值失败:', updateError.message)
  } else {
    console.log('✅ 贡献值更新成功:', updatedPartner.current_contribution)
  }
  
  // 4. 添加交互日志（包含 quality_score）
  console.log('\n4️⃣ 添加交互日志...')
  const { data: log, error: logError } = await supabase
    .from('interaction_logs')
    .insert({
      user_id: user.id,
      category: 'emotion',
      granted_power: 3,
      data_rarity: '稀有·真实情感图谱'
    })
    .select()
    .single()
  
  if (logError) {
    console.log('❌ 添加交互日志失败:', logError.message)
    // 尝试查看表结构
    const { data: sample } = await supabase
      .from('interaction_logs')
      .select('*')
      .limit(1)
    console.log('   表结构示例:', sample)
  } else {
    console.log('✅ 交互日志添加成功:', log.id)
  }
  
  // 5. 添加AI记忆
  console.log('\n5️⃣ 添加AI记忆...')
  const { data: memory, error: memoryError } = await supabase
    .from('ai_memories')
    .insert({
      user_id: user.id,
      type: 'emotional',
      content: '用户分享了一件开心的事'
    })
    .select()
    .single()
  
  if (memoryError) {
    console.log('❌ 添加AI记忆失败:', memoryError.message)
  } else {
    console.log('✅ AI记忆添加成功:', memory.id)
  }
  
  // 6. 添加贡献值详情
  console.log('\n6️⃣ 添加贡献值详情...')
  const { data: detail, error: detailError } = await supabase
    .from('contribution_details')
    .insert({
      user_id: user.id,
      points: 5,
      rating: 'precious',
      reason: '用户分享了深度思考'
    })
    .select()
    .single()
  
  if (detailError) {
    console.log('❌ 添加贡献值详情失败:', detailError.message)
  } else {
    console.log('✅ 贡献值详情添加成功:', detail.id)
  }
  
  // 7. 查询最终状态
  console.log('\n7️⃣ 查询最终状态...')
  const { data: finalPartner } = await supabase
    .from('ai_partners')
    .select('*')
    .eq('user_id', user.id)
    .single()
  
  if (finalPartner) {
    console.log('✅ AI伙伴最终状态:')
    console.log('   - 名称:', finalPartner.name)
    console.log('   - 状态:', finalPartner.status)
    console.log('   - 当前贡献值:', finalPartner.current_contribution)
    console.log('   - 累计贡献值:', finalPartner.total_contribution)
    console.log('   - 性格:', finalPartner.personality)
  }
  
  // 8. 清理测试数据
  console.log('\n8️⃣ 清理测试数据...')
  const { error: deleteError } = await supabase
    .from('users')
    .delete()
    .eq('id', user.id)
  
  if (deleteError) {
    console.log('❌ 清理失败:', deleteError.message)
  } else {
    console.log('✅ 测试数据已清理')
  }
  
  console.log('\n=== 测试完成 ===\n')
}

testUserFlow().catch(console.error)
