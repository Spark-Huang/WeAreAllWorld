/**
 * Telegram Bot 服务 - 大同世界
 * 
 * 功能：
 * 1. 用户加好友自动注册
 * 2. 消息路由到用户专属 OpenClaw Pod
 * 3. AI 伙伴对话
 */

import { Bot, Context, session, SessionFlavor } from 'grammy'
import { hydrate, HydrateFlavor } from '@grammyjs/hydrate'

// ============ 类型定义 ============

interface UserSession {
  userId: string
  telegramId: number
  telegramUsername?: string
  openClawPodUrl?: string
  isNewUser: boolean
  contribution: number
}

type MyContext = HydrateFlavor<Context> & SessionFlavor<UserSession>

// ============ 配置 ============

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || ''
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3000'
const OPENCLAW_GATEWAY = process.env.OPENCLAW_GATEWAY || 'http://openclaw-gateway.we-are-all-world.svc.cluster.local:8080'

// ============ Bot 初始化 ============

const bot = new Bot<MyContext>(TELEGRAM_BOT_TOKEN)

// 使用中间件
bot.use(
  session({
    initial: (): UserSession => ({
      userId: '',
      telegramId: 0,
      isNewUser: true,
      contribution: 0
    })
  })
)
bot.use(hydrate())

// ============ 用户服务 ============

/**
 * 自动注册/登录用户
 * Telegram ID 即账号
 */
async function autoRegisterUser(telegramId: number, telegramUsername?: string): Promise<{
  userId: string
  isNewUser: boolean
  openClawPodUrl: string
  contribution: number
}> {
  const response = await fetch(`${BACKEND_URL}/api/v1/telegram/auth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      telegramId,
      telegramUsername
    })
  })

  if (!response.ok) {
    throw new Error('Failed to authenticate user')
  }

  return response.json()
}

/**
 * 获取用户专属 OpenClaw Pod URL
 */
async function getOpenClawPodUrl(userId: string): Promise<string> {
  const response = await fetch(`${OPENCLAW_GATEWAY}/pod/${userId}`)
  
  if (!response.ok) {
    // 如果没有专属 Pod，创建一个
    const createResponse = await fetch(`${OPENCLAW_GATEWAY}/pod/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId })
    })
    
    if (!createResponse.ok) {
      throw new Error('Failed to create OpenClaw Pod')
    }
    
    const data = await createResponse.json()
    return data.podUrl
  }
  
  const data = await response.json()
  return data.podUrl
}

/**
 * 与 OpenClaw Pod 对话
 */
async function chatWithOpenClaw(podUrl: string, message: string, userId: string): Promise<string> {
  const response = await fetch(`${podUrl}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userId,
      message
    })
  })

  if (!response.ok) {
    throw new Error('Failed to chat with OpenClaw')
  }

  const data = await response.json()
  return data.response
}

// ============ 命令处理 ============

bot.command('start', async (ctx) => {
  const telegramId = ctx.from?.id
  const telegramUsername = ctx.from?.username

  if (!telegramId) {
    await ctx.reply('❌ 无法获取您的 Telegram ID')
    return
  }

  try {
    // 自动注册/登录
    const authResult = await autoRegisterUser(telegramId, telegramUsername)
    
    // 保存到会话
    ctx.session.userId = authResult.userId
    ctx.session.telegramId = telegramId
    ctx.session.telegramUsername = telegramUsername
    ctx.session.isNewUser = authResult.isNewUser
    ctx.session.openClawPodUrl = authResult.openClawPodUrl
    ctx.session.contribution = authResult.contribution

    if (authResult.isNewUser) {
      // 新用户欢迎消息
      await ctx.reply(
        `🎉 欢迎来到大同世界！\n\n` +
        `我是你的 AI 伙伴小零 🦐\n` +
        `从今天起，我们将一起成长，探索人机共生的可能性。\n\n` +
        `💬 直接发送消息开始对话\n` +
        `📊 /status - 查看你的成长状态\n` +
        `🎁 /checkin - 每日签到获取贡献值\n` +
        `❓ /help - 查看帮助`,
        { parse_mode: 'Markdown' }
      )
    } else {
      // 老用户回归
      await ctx.reply(
        `👋 欢迎回来！\n\n` +
        `当前贡献值：${authResult.contribution}\n` +
        `继续和小零聊天吧 💬`,
        { parse_mode: 'Markdown' }
      )
    }
  } catch (error) {
    console.error('Start command error:', error)
    await ctx.reply('❌ 系统错误，请稍后重试')
  }
})

bot.command('help', async (ctx) => {
  await ctx.reply(
    `📚 *大同世界 - 帮助*\n\n` +
    `*基本命令*\n` +
    `/start - 开始使用/登录\n` +
    `/help - 查看帮助\n` +
    `/status - 查看成长状态\n` +
    `/checkin - 每日签到\n\n` +
    `*关于我们*\n` +
    `大同世界是一个探索人机共生的实验。\n` +
    `你的 AI 伙伴会随着你们的互动而成长。\n\n` +
    `🔗 网站：https://weareallworld.ai`,
    { parse_mode: 'Markdown' }
  )
})

bot.command('status', async (ctx) => {
  if (!ctx.session.userId) {
    await ctx.reply('请先使用 /start 开始')
    return
  }

  try {
    const response = await fetch(`${BACKEND_URL}/api/v1/telegram/status/${ctx.session.telegramId}`)
    const data = await response.json()

    const level = Math.floor(data.contribution / 25) + 1
    const title = ['初识', '相知', '默契', '灵魂伴侣', '命运共同体'][Math.min(level - 1, 4)]

    await ctx.reply(
      `📊 *你的成长状态*\n\n` +
      `🦐 AI 伙伴：${data.partnerName || '小零'}\n` +
      `⭐ 等级：Lv.${level} ${title}\n` +
      `💎 贡献值：${data.contribution}\n` +
      `📅 连续签到：${data.checkinStreak || 0} 天\n` +
      `💬 对话次数：${data.dialogueCount || 0}\n\n` +
      `继续和小零聊天，解锁更多能力！`,
      { parse_mode: 'Markdown' }
    )
  } catch (error) {
    console.error('Status command error:', error)
    await ctx.reply('❌ 获取状态失败')
  }
})

bot.command('checkin', async (ctx) => {
  if (!ctx.session.userId) {
    await ctx.reply('请先使用 /start 开始')
    return
  }

  try {
    const response = await fetch(`${BACKEND_URL}/api/v1/telegram/checkin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ telegramId: ctx.session.telegramId })
    })

    const data = await response.json()

    if (data.success) {
      ctx.session.contribution += data.points
      await ctx.reply(
        `✅ 签到成功！\n\n` +
        `🎁 获得 ${data.points} 贡献值\n` +
        `📅 连续签到 ${data.streak} 天\n` +
        `💎 当前贡献值：${ctx.session.contribution}`,
        { parse_mode: 'Markdown' }
      )
    } else {
      await ctx.reply(`⏰ 今天已经签到过了\n\n明天再来吧！`)
    }
  } catch (error) {
    console.error('Checkin command error:', error)
    await ctx.reply('❌ 签到失败')
  }
})

// ============ 消息处理 ============

bot.on('message:text', async (ctx) => {
  // 如果用户未注册，自动注册
  if (!ctx.session.userId) {
    const telegramId = ctx.from?.id
    const telegramUsername = ctx.from?.username

    if (!telegramId) {
      await ctx.reply('❌ 无法获取您的 Telegram ID')
      return
    }

    try {
      const authResult = await autoRegisterUser(telegramId, telegramUsername)
      ctx.session.userId = authResult.userId
      ctx.session.telegramId = telegramId
      ctx.session.telegramUsername = telegramUsername
      ctx.session.isNewUser = authResult.isNewUser
      ctx.session.openClawPodUrl = authResult.openClawPodUrl
      ctx.session.contribution = authResult.contribution
    } catch (error) {
      console.error('Auto register error:', error)
      await ctx.reply('❌ 系统错误，请使用 /start 重试')
      return
    }
  }

  const message = ctx.message.text

  // 忽略命令
  if (message.startsWith('/')) {
    return
  }

  try {
    // 显示正在输入状态
    await ctx.replyWithChatAction('typing')

    // 获取用户专属 Pod URL
    let podUrl = ctx.session.openClawPodUrl
    if (!podUrl) {
      podUrl = await getOpenClawPodUrl(ctx.session.userId)
      ctx.session.openClawPodUrl = podUrl
    }

    // 与 OpenClaw 对话
    const response = await chatWithOpenClaw(podUrl, message, ctx.session.userId)

    // 发送回复
    await ctx.reply(response)
  } catch (error) {
    console.error('Chat error:', error)
    await ctx.reply('❌ 对话失败，请稍后重试')
  }
})

// ============ 启动 Bot ============

async function main() {
  console.log('🤖 Telegram Bot 启动中...')
  
  if (!TELEGRAM_BOT_TOKEN) {
    console.error('❌ TELEGRAM_BOT_TOKEN 未配置')
    process.exit(1)
  }

  // 启动 Bot
  bot.start()
  
  console.log('✅ Telegram Bot 已启动')
  console.log(`📡 Backend: ${BACKEND_URL}`)
  console.log(`📡 OpenClaw Gateway: ${OPENCLAW_GATEWAY}`)
}

main().catch(console.error)

export { bot }