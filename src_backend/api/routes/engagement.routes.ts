/**
 * 用户粘性功能 API 路由
 * 
 * 包含：
 * - 连续登录奖励
 * - 深度对话引导
 * - 记忆博物馆
 */

import { Router, Request, Response } from 'express'
import { authMiddleware } from '../middleware/auth.middleware.js'
import {
  processDailyLogin,
  getLoginStatus,
  getLoginHistory,
  getStreakLeaderboard,
  STREAK_REWARDS
} from '../../services/streak-reward.service.js'
import {
  getDeepDialoguePrompt,
  startDeepDialogue,
  completeDeepDialogue,
  getDeepDialogueHistory,
  DEEP_DIALOGUE_PROMPTS
} from '../../services/deep-dialogue.service.js'
import {
  getMemories,
  getMemoryStats,
  getMemoryTimeline,
  searchMemories,
  getAnniversaryMemories,
  deleteMemory,
  MEMORY_TYPE_LABELS
} from '../../services/memory-museum.service.js'

const router = Router()

// 所有路由需要认证
router.use(authMiddleware)

// ============ 连续登录奖励 ============

/**
 * POST /api/v1/engagement/login
 * 处理每日登录
 */
router.post('/login', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const result = await processDailyLogin(userId)
    res.json(result)
  } catch (error) {
    console.error('Process login error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

/**
 * GET /api/v1/engagement/login/status
 * 获取登录状态
 */
router.get('/login/status', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const status = await getLoginStatus(userId)
    res.json(status)
  } catch (error) {
    console.error('Get login status error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

/**
 * GET /api/v1/engagement/login/history
 * 获取登录历史
 */
router.get('/login/history', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const days = parseInt(req.query.days as string) || 30
    const history = await getLoginHistory(userId, days)
    res.json({ history })
  } catch (error) {
    console.error('Get login history error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

/**
 * GET /api/v1/engagement/login/leaderboard
 * 获取连续登录排行榜
 */
router.get('/login/leaderboard', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 10
    const leaderboard = await getStreakLeaderboard(limit)
    res.json({ leaderboard })
  } catch (error) {
    console.error('Get leaderboard error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

/**
 * GET /api/v1/engagement/login/rewards
 * 获取登录奖励配置
 */
router.get('/login/rewards', (_req: Request, res: Response) => {
  res.json({ rewards: STREAK_REWARDS })
})

// ============ 深度对话引导 ============

/**
 * GET /api/v1/engagement/deep-dialogue/prompt
 * 获取深度对话提示
 */
router.get('/deep-dialogue/prompt', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const prompt = await getDeepDialoguePrompt(userId)
    res.json({ prompt })
  } catch (error) {
    console.error('Get deep dialogue prompt error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

/**
 * POST /api/v1/engagement/deep-dialogue/start
 * 开始深度对话
 */
router.post('/deep-dialogue/start', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const { promptId } = req.body
    if (!promptId) {
      return res.status(400).json({ error: 'promptId is required' })
    }

    const result = await startDeepDialogue(userId, promptId)
    res.json(result)
  } catch (error) {
    console.error('Start deep dialogue error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

/**
 * POST /api/v1/engagement/deep-dialogue/complete
 * 完成深度对话
 */
router.post('/deep-dialogue/complete', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const { recordId, content } = req.body
    if (!recordId || !content) {
      return res.status(400).json({ error: 'recordId and content are required' })
    }

    const result = await completeDeepDialogue(recordId, userId, content)
    res.json(result)
  } catch (error) {
    console.error('Complete deep dialogue error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

/**
 * GET /api/v1/engagement/deep-dialogue/history
 * 获取深度对话历史
 */
router.get('/deep-dialogue/history', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const history = await getDeepDialogueHistory(userId)
    res.json({ history })
  } catch (error) {
    console.error('Get deep dialogue history error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

/**
 * GET /api/v1/engagement/deep-dialogue/prompts
 * 获取所有深度对话主题
 */
router.get('/deep-dialogue/prompts', (_req: Request, res: Response) => {
  res.json({ prompts: DEEP_DIALOGUE_PROMPTS })
})

// ============ 记忆博物馆 ============

/**
 * GET /api/v1/engagement/memories
 * 获取记忆列表
 */
router.get('/memories', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const type = req.query.type as string
    const limit = parseInt(req.query.limit as string) || 20
    const offset = parseInt(req.query.offset as string) || 0
    const search = req.query.search as string

    const memories = await getMemories(userId, {
      type: type as any,
      limit,
      offset,
      search
    })

    res.json({ memories })
  } catch (error) {
    console.error('Get memories error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

/**
 * GET /api/v1/engagement/memories/stats
 * 获取记忆统计
 */
router.get('/memories/stats', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const stats = await getMemoryStats(userId)
    res.json(stats)
  } catch (error) {
    console.error('Get memory stats error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

/**
 * GET /api/v1/engagement/memories/timeline
 * 获取时间轴视图
 */
router.get('/memories/timeline', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const timeline = await getMemoryTimeline(userId)
    res.json({ timeline })
  } catch (error) {
    console.error('Get memory timeline error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

/**
 * GET /api/v1/engagement/memories/anniversary
 * 获取纪念日记忆
 */
router.get('/memories/anniversary', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const memories = await getAnniversaryMemories(userId)
    res.json({ memories })
  } catch (error) {
    console.error('Get anniversary memories error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

/**
 * GET /api/v1/engagement/memories/types
 * 获取记忆类型
 */
router.get('/memories/types', (_req: Request, res: Response) => {
  res.json({ types: MEMORY_TYPE_LABELS })
})

/**
 * DELETE /api/v1/engagement/memories/:id
 * 删除记忆
 */
router.delete('/memories/:id', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const { id } = req.params
    const success = await deleteMemory(id, userId)

    if (success) {
      res.json({ success: true })
    } else {
      res.status(404).json({ error: 'Memory not found' })
    }
  } catch (error) {
    console.error('Delete memory error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

export default router