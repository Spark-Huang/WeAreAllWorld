/**
 * 情感冲击功能 API 路由
 * 
 * 包含：
 * - AI 遗书
 * - 濒危警告
 * - 贡献值详情
 */

import { Router, Request, Response } from 'express'
import { authMiddleware } from '../middleware/auth.middleware.js'
import { supabase } from '../config/supabase.js'
import {
  generateLegacyLetter,
  getLegacyLetter,
  checkAndGenerateLegacy
} from '../../services/ai-legacy.service.js'
import {
  checkDangerWarning,
  getAIGreeting
} from '../../services/danger-warning.service.js'
import {
  getContributionHistory,
  getContributionStats,
  RATING_INFO
} from '../../services/contribution-detail.service.js'

const router = Router()

// 所有路由需要认证
router.use(authMiddleware)

/**
 * GET /api/v1/emotional/danger-warning
 * 获取濒危警告
 */
router.get('/danger-warning', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const warning = await checkDangerWarning(userId)
    res.json({ warning })
  } catch (error) {
    console.error('Get danger warning error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

/**
 * GET /api/v1/emotional/greeting
 * 获取 AI 开场白（带濒危警告）
 */
router.get('/greeting', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const result = await getAIGreeting(userId)
    res.json(result)
  } catch (error) {
    console.error('Get greeting error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

/**
 * GET /api/v1/emotional/legacy
 * 获取 AI 遗书
 */
router.get('/legacy', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const legacy = await getLegacyLetter(userId)
    res.json({ legacy })
  } catch (error) {
    console.error('Get legacy error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

/**
 * POST /api/v1/emotional/legacy/generate
 * 生成 AI 遗书
 */
router.post('/legacy/generate', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const legacy = await generateLegacyLetter(userId)
    res.json({ legacy })
  } catch (error) {
    console.error('Generate legacy error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

/**
 * POST /api/v1/emotional/wake-up
 * 唤醒 AI 伙伴
 */
router.post('/wake-up', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    // 获取 AI 伙伴信息
    const { data: partner, error: partnerError } = await supabase
      .from('ai_partners')
      .select('contribution, status')
      .eq('user_id', userId)
      .single()

    if (!partner) {
      return res.status(404).json({ error: 'AI partner not found' })
    }

    // 计算恢复的贡献值
    const recoveredPoints = Math.max(15, Math.floor(partner.contribution * 0.5))

    // 更新 AI 状态
    const { error: updateError } = await supabase
      .from('ai_partners')
      .update({
        status: 'active',
        contribution: recoveredPoints,
        last_active: new Date().toISOString()
      })
      .eq('user_id', userId)

    if (updateError) {
      console.error('Update partner error:', updateError)
      return res.status(500).json({ error: 'Failed to wake up AI partner' })
    }

    res.json({
      success: true,
      recoveredPoints,
      message: 'AI 伙伴已唤醒'
    })
  } catch (error) {
    console.error('Wake up error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

/**
 * GET /api/v1/emotional/contribution/history
 * 获取贡献值历史
 */
router.get('/contribution/history', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const limit = parseInt(req.query.limit as string) || 20
    const history = await getContributionHistory(userId, limit)
    res.json({ history })
  } catch (error) {
    console.error('Get contribution history error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

/**
 * GET /api/v1/emotional/contribution/stats
 * 获取贡献值统计
 */
router.get('/contribution/stats', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const stats = await getContributionStats(userId)
    res.json({ stats })
  } catch (error) {
    console.error('Get contribution stats error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

/**
 * GET /api/v1/emotional/contribution/ratings
 * 获取数据评级信息
 */
router.get('/contribution/ratings', (_req: Request, res: Response) => {
  res.json({ ratings: RATING_INFO })
})

export default router