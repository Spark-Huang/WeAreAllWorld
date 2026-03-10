/**
 * Telegram 认证 API 路由
 * 
 * 功能：
 * 1. Telegram ID 自动注册/登录
 * 2. 获取用户状态
 * 3. 每日签到
 */

import { Router, Request, Response } from 'express'
import { supabase } from '../config/supabase.js'
import { randomUUID } from 'crypto'

const router = Router()

/**
 * POST /api/v1/telegram/auth
 * Telegram ID 自动注册/登录
 */
router.post('/auth', async (req: Request, res: Response) => {
  try {
    const { telegramId, telegramUsername } = req.body

    if (!telegramId) {
      return res.status(400).json({ error: 'telegramId is required' })
    }

    // 查找是否已存在用户
    const { data: existingUser, error: findError } = await supabase
      .from('users')
      .select('id, contribution, telegram_username')
      .eq('telegram_id', telegramId)
      .single()

    if (existingUser) {
      // 老用户登录
      // 获取 AI 伙伴信息
      const { data: partner } = await supabase
        .from('ai_partners')
        .select('name, contribution')
        .eq('user_id', existingUser.id)
        .single()

      // 获取或创建 OpenClaw Pod URL
      const podUrl = await getOrCreateOpenClawPod(existingUser.id)

      return res.json({
        userId: existingUser.id,
        isNewUser: false,
        openClawPodUrl: podUrl,
        contribution: partner?.contribution || existingUser.contribution || 0
      })
    }

    // 新用户注册
    const userId = randomUUID()
    const email = `telegram_${telegramId}@weareallworld.ai` // 虚拟邮箱

    // 创建用户
    const { error: createError } = await supabase
      .from('users')
      .insert({
        id: userId,
        email,
        telegram_id: telegramId,
        telegram_username: telegramUsername,
        contribution: 0,
        created_at: new Date().toISOString()
      })

    if (createError) {
      console.error('Create user error:', createError)
      return res.status(500).json({ error: 'Failed to create user' })
    }

    // 创建 AI 伙伴（通过触发器自动创建，但这里手动确保）
    const { error: partnerError } = await supabase
      .from('ai_partners')
      .insert({
        user_id: userId,
        name: '小零',
        contribution: 0,
        status: 'active',
        created_at: new Date().toISOString()
      })

    if (partnerError) {
      console.error('Create partner error:', partnerError)
      // 不返回错误，因为触发器可能已经创建
    }

    // 获取 OpenClaw Pod URL
    const podUrl = await getOrCreateOpenClawPod(userId)

    return res.json({
      userId,
      isNewUser: true,
      openClawPodUrl: podUrl,
      contribution: 0
    })

  } catch (error) {
    console.error('Telegram auth error:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
})

/**
 * GET /api/v1/telegram/status/:telegramId
 * 获取用户状态
 */
router.get('/status/:telegramId', async (req: Request, res: Response) => {
  try {
    const { telegramId } = req.params

    const { data: user, error } = await supabase
      .from('users')
      .select('id, contribution, checkin_streak, created_at')
      .eq('telegram_id', parseInt(telegramId))
      .single()

    if (!user) {
      return res.status(404).json({ error: 'User not found' })
    }

    // 获取 AI 伙伴
    const { data: partner } = await supabase
      .from('ai_partners')
      .select('name, contribution')
      .eq('user_id', user.id)
      .single()

    // 获取对话次数
    const { count: dialogueCount } = await supabase
      .from('interaction_logs')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)

    return res.json({
      contribution: partner?.contribution || user.contribution || 0,
      partnerName: partner?.name || '小零',
      checkinStreak: user.checkin_streak || 0,
      dialogueCount: dialogueCount || 0
    })

  } catch (error) {
    console.error('Get status error:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
})

/**
 * POST /api/v1/telegram/checkin
 * 每日签到
 */
router.post('/checkin', async (req: Request, res: Response) => {
  try {
    const { telegramId } = req.body

    if (!telegramId) {
      return res.status(400).json({ error: 'telegramId is required' })
    }

    // 获取用户
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, last_checkin, checkin_streak')
      .eq('telegram_id', telegramId)
      .single()

    if (!user) {
      return res.status(404).json({ error: 'User not found' })
    }

    // 检查今天是否已签到
    const today = new Date().toISOString().split('T')[0]
    const lastCheckin = user.last_checkin ? new Date(user.last_checkin).toISOString().split('T')[0] : null

    if (lastCheckin === today) {
      return res.json({ success: false, message: 'Already checked in today' })
    }

    // 计算连续签到天数
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    const yesterdayStr = yesterday.toISOString().split('T')[0]

    let newStreak = 1
    if (lastCheckin === yesterdayStr) {
      newStreak = (user.checkin_streak || 0) + 1
    }

    // 计算奖励
    const basePoints = 5
    const streakBonus = Math.min(newStreak - 1, 7) // 最多 7 天连续奖励
    const totalPoints = basePoints + streakBonus

    // 更新用户
    const { error: updateError } = await supabase
      .from('users')
      .update({
        last_checkin: new Date().toISOString(),
        checkin_streak: newStreak,
        contribution: (user.contribution || 0) + totalPoints
      })
      .eq('id', user.id)

    if (updateError) {
      console.error('Update user error:', updateError)
      return res.status(500).json({ error: 'Failed to check in' })
    }

    // 更新 AI 伙伴贡献值
    await supabase.rpc('update_contribution', {
      p_user_id: user.id,
      p_points: totalPoints,
      p_reason: 'daily_checkin'
    })

    return res.json({
      success: true,
      points: totalPoints,
      streak: newStreak
    })

  } catch (error) {
    console.error('Checkin error:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
})

/**
 * 获取或创建用户专属 OpenClaw Pod
 */
async function getOrCreateOpenClawPod(userId: string): Promise<string> {
  // TODO: 实现 Kubernetes Pod 动态创建
  // 当前返回共享 Pod URL
  const OPENCLAW_GATEWAY = process.env.OPENCLAW_GATEWAY || 'http://localhost:8080'
  
  // 检查是否有专属 Pod
  try {
    const response = await fetch(`${OPENCLAW_GATEWAY}/pod/${userId}`)
    if (response.ok) {
      const data = await response.json()
      return data.podUrl
    }
  } catch (error) {
    console.log('No dedicated pod, using shared')
  }

  // 返回共享 Pod URL
  return `${OPENCLAW_GATEWAY}/shared`
}

export default router