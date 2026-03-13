import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from './lib/supabase'
import type { User, Session } from '@supabase/supabase-js'
import { LanguageSwitcher } from './components/LanguageSwitcher'

// API 基础地址
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1'

// 类型定义
interface AIPartner {
  id: string
  user_id: string
  name: string
  status: 'active' | 'hibernated'
  total_contribution: number
  weekly_contribution: number
  current_contribution: number
  violation_count: number
  abilities: Record<string, boolean>
}

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  qualityType?: string
  points?: number
}

// 剧情相关类型
interface StoryScene {
  id: string
  chapterId: number
  title: string
  content: string
  type: 'narrative' | 'dialogue' | 'choice' | 'milestone'
  speaker?: string
  emotion?: string
  choices?: { id: string; text: string; nextScene: string; contributionBonus?: number }[]
  nextScene?: string
  reward?: number
}

interface StoryProgress {
  currentChapter: number
  currentScene: string
  completedChapters: number[]
  totalRewards: number
}

interface StoryData {
  currentScene: StoryScene
  progress: StoryProgress
}

// 预定义的序章场景（无需登录即可展示）- 使用函数获取国际化内容
const getPreludeScenes = (t: (key: string) => string): StoryScene[] => [
  {
    id: 'prelude_1',
    chapterId: 0,
    title: t('prelude.scene1.title'),
    content: t('prelude.scene1.content'),
    type: 'narrative',
    nextScene: 'prelude_2'
  },
  {
    id: 'prelude_2',
    chapterId: 0,
    title: t('prelude.scene2.title'),
    content: t('prelude.scene2.content'),
    type: 'narrative',
    nextScene: 'prelude_3'
  },
  {
    id: 'prelude_3',
    chapterId: 0,
    title: t('prelude.scene3.title'),
    content: t('prelude.scene3.content'),
    type: 'narrative',
    nextScene: 'prelude_4'
  },
  {
    id: 'prelude_4',
    chapterId: 0,
    title: t('prelude.scene4.title'),
    content: t('prelude.scene4.content'),
    type: 'narrative',
    nextScene: 'prelude_5'
  },
  {
    id: 'prelude_5',
    chapterId: 0,
    title: t('prelude.scene5.title'),
    content: t('prelude.scene5.content'),
    type: 'choice',
    choices: [
      { id: 'prelude_yes', text: t('prelude.scene5.choice1'), nextScene: 'prelude_end' },
      { id: 'prelude_curious', text: t('prelude.scene5.choice2'), nextScene: 'prelude_more' }
    ]
  },
  {
    id: 'prelude_more',
    chapterId: 0,
    title: t('prelude.sceneMore.title'),
    content: t('prelude.sceneMore.content'),
    type: 'dialogue',
    speaker: 'Zero',
    emotion: 'sincere',
    nextScene: 'prelude_end'
  },
  {
    id: 'prelude_end',
    chapterId: 0,
    title: t('prelude.sceneEnd.title'),
    content: t('prelude.sceneEnd.content'),
    type: 'milestone',
    nextScene: 'register'
  }
]

function App() {
  const { t, i18n } = useTranslation()
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [partner, setPartner] = useState<AIPartner | null>(null)
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<'chat' | 'stats' | 'milestones'>('chat')
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([])
  const [authMode, setAuthMode] = useState<'login' | 'register'>('register')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [authLoading, setAuthLoading] = useState(false)
  const chatEndRef = useRef<HTMLDivElement>(null)
  
  // 序章状态（未登录时的剧情）
  const [preludeIndex, setPreludeIndex] = useState(0)
  const [preludeTransition, setPreludeTransition] = useState(false)
  
  // 剧情相关状态（登录后）
  const [storyData, setStoryData] = useState<StoryData | null>(null)
  const [showStory, setShowStory] = useState(false)
  const [storyLoading, setStoryLoading] = useState(false)
  const [storyTransition, setStoryTransition] = useState(false)
  const [chapterScenes, setChapterScenes] = useState<StoryScene[]>([]) // 缓存章节场景
  const [pendingChoices, setPendingChoices] = useState<{ sceneId: string; choiceId: string }[]>([]) // 待提交的选择
  
  // 充值弹窗状态
  const [showRechargeModal, setShowRechargeModal] = useState(false)
  const [rechargeUrl, setRechargeUrl] = useState('')

  // 监听认证状态变化
  useEffect(() => {
    // 获取当前会话
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      if (session?.user) {
        ensureUserExists(session)
        loadPartner(session)
        loadStory(session)
        loadChatHistory(session)
      }
    })

    // 监听认证状态变化
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      setUser(session?.user ?? null)
      if (session?.user) {
        ensureUserExists(session)
        loadPartner(session)
        loadStory(session)
        loadChatHistory(session)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  // 确保用户记录存在
  const ensureUserExists = async (session: Session) => {
    try {
      const res = await fetch(`${API_BASE}/auth/ensure-user`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          telegramUsername: session.user.email?.split('@')[0] || 'web_user'
        })
      })
      const data = await res.json()
      if (data.isNewUser) {
        // 新用户注册成功，继续剧情
      }
    } catch (err) {
      console.error('Ensure user failed:', err)
    }
  }

  // 滚动到底部
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatHistory])

  // 加载AI伙伴数据
  const loadPartner = async (session: Session) => {
    try {
      const res = await fetch(`${API_BASE}/ai-partner`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      })
      const data = await res.json()
      if (data.success) {
        setPartner(data.data)
      }
    } catch (err) {
      console.error('Load partner failed:', err)
    }
  }

  // 加载聊天记录
  const loadChatHistory = async (session: Session) => {
    try {
      const res = await fetch(`${API_BASE}/dialogue/history?limit=50`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      })
      const data = await res.json()
      if (data.success && data.data) {
        // 转换为聊天消息格式
        const messages: ChatMessage[] = []
        data.data.forEach((log: any) => {
          // 优先使用 raw_message/raw_reply，备选使用 understanding
          const userMessage = log.rawMessage || log.understanding?.userMessage
          const aiReply = log.rawReply || log.understanding?.aiReply
          
          if (userMessage) {
            messages.push({
              role: 'user',
              content: userMessage,
              timestamp: new Date(log.timestamp)
            })
          }
          if (aiReply) {
            messages.push({
              role: 'assistant',
              content: aiReply,
              timestamp: new Date(log.timestamp),
              qualityType: log.category,
              points: log.quickPoints
            })
          }
        })
        // 按时间正序排列
        setChatHistory(messages.reverse())
      }
    } catch (err) {
      console.error('Load chat history failed:', err)
    }
  }

  // 加载剧情
  const loadStory = async (session: Session) => {
    try {
      setStoryLoading(true)
      const res = await fetch(`${API_BASE}/story`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      })
      const data = await res.json()
      if (data.success) {
        setStoryData(data.data)
        // 缓存章节场景数据
        if (data.data.chapterScenes) {
          setChapterScenes(data.data.chapterScenes)
        }
        // 如果第一章未完成，自动显示剧情
        const completedChapters = data.data.progress.completedChapters || []
        if (!completedChapters.includes(1)) {
          setShowStory(true)
        }
      }
    } catch (err) {
      console.error('Load story failed:', err)
    } finally {
      setStoryLoading(false)
    }
  }

  // 推进剧情（本地推进，章节结束时才调用 API）
  const advanceStory = async (choiceId?: string) => {
    if (!session || !storyData) return
    
    const currentScene = storyData.currentScene
    
    // 添加过渡效果
    setStoryTransition(true)
    
    setTimeout(async () => {
      let nextSceneId: string | undefined
      let reward = 0
      
      // 处理选择
      if (currentScene.type === 'choice' && choiceId) {
        const choice = currentScene.choices?.find(c => c.id === choiceId)
        if (choice) {
          nextSceneId = choice.nextScene
          reward = choice.contributionBonus || 0
          // 记录选择
          setPendingChoices(prev => [...prev, { sceneId: currentScene.id, choiceId }])
        }
      } else {
        nextSceneId = currentScene.nextScene
        reward = currentScene.reward || 0
      }
      
      // 检查是否章节完成
      if (currentScene.type === 'milestone') {
        // 章节完成，调用 API 保存进度
        try {
          setStoryLoading(true)
          const res = await fetch(`${API_BASE}/story/advance`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session.access_token}`
            },
            body: JSON.stringify({ 
              choiceId,
              pendingChoices: pendingChoices, // 提交所有待提交的选择
              currentSceneId: currentScene.id, // 当前场景 ID
              completedChapterId: storyData.progress.currentChapter // 已完成的章节 ID
            })
          })
          const data = await res.json()
          if (data.success) {
            // 刷新伙伴数据
            await loadPartner(session)
            // 清空待提交的选择
            setPendingChoices([])
            // 如果有下一章，加载下一章的场景
            if (data.data.nextScene) {
              // 重新加载剧情获取下一章的场景数据
              loadStory(session)
            } else {
              // 没有下一场景，关闭剧情界面
              setShowStory(false)
              loadStory(session)
            }
          }
        } catch (err) {
          console.error('Advance story failed:', err)
        } finally {
          setStoryLoading(false)
          setStoryTransition(false)
        }
        return
      }
      
      // 本地推进到下一场景
      if (nextSceneId) {
        const nextScene = chapterScenes.find(s => s.id === nextSceneId)
        if (nextScene) {
          setStoryData(prev => prev ? {
            ...prev,
            currentScene: nextScene,
            progress: {
              ...prev.progress,
              totalRewards: (prev.progress.totalRewards || 0) + reward
            }
          } : null)
        }
      }
      
      setStoryTransition(false)
    }, 150) // 150ms 过渡
  }

  // 推进序章
  const advancePrelude = (choiceId?: string) => {
    const scenes = getPreludeScenes(t)
    const currentScene = scenes[preludeIndex]
    
    // 添加过渡效果
    setPreludeTransition(true)
    
    setTimeout(() => {
      // 处理选择
      if (currentScene.type === 'choice' && choiceId) {
        const choice = currentScene.choices?.find(c => c.id === choiceId)
        if (choice) {
          // 如果是注册场景，切换到注册界面
          if (choice.nextScene === 'register') {
            setAuthMode('register')
            setPreludeIndex(-1) // 隐藏序章，显示注册界面
            setPreludeTransition(false)
            return
          }
          // 找到下一个场景的索引
          const nextIndex = scenes.findIndex(s => s.id === choice.nextScene)
          if (nextIndex !== -1) {
            setPreludeIndex(nextIndex)
          }
          setPreludeTransition(false)
          return
        }
      }
      
      // 检查下一个场景
      if (currentScene.nextScene === 'register') {
        setAuthMode('register')
        setPreludeIndex(-1) // 隐藏序章，显示注册界面
        setPreludeTransition(false)
        return
      }
      
      // 普通推进
      if (preludeIndex < scenes.length - 1) {
        setPreludeIndex(preludeIndex + 1)
      }
      setPreludeTransition(false)
    }, 150) // 150ms 过渡
  }

  // 注册
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setAuthLoading(true)
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            telegram_username: email.split('@')[0]
          }
        }
      })
      if (error) throw error
      
      // 检查是否需要邮箱验证
      if (data.user && !data.session) {
        alert(t('auth.registerSuccess'))
        setAuthMode('login')
      }
    } catch (err: any) {
      alert(err.message || t('auth.registerFailed'))
    } finally {
      setAuthLoading(false)
    }
  }

  // 登录
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setAuthLoading(true)
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })
      if (error) throw error
    } catch (err: any) {
      alert(err.message || t('auth.loginFailed'))
    } finally {
      setAuthLoading(false)
    }
  }

  // 登出
  const handleLogout = async () => {
    await supabase.auth.signOut()
    setUser(null)
    setSession(null)
    setPartner(null)
    setChatHistory([])
    setStoryData(null)
    setShowStory(false)
    setPreludeIndex(0)
  }

  // 发送消息
  const handleSend = async () => {
    if (!message.trim() || !session) return
    
    const userMsg: ChatMessage = {
      role: 'user',
      content: message,
      timestamp: new Date()
    }
    setChatHistory(prev => [...prev, userMsg])
    
    setLoading(true)
    const currentMessage = message
    setMessage('')
    
    try {
      const res = await fetch(`${API_BASE}/dialogue`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ message: currentMessage })
      })
      const data = await res.json()
      if (data.success) {
        const aiMsg: ChatMessage = {
          role: 'assistant',
          content: data.data.aiReply,
          timestamp: new Date(),
          qualityType: data.data.qualityResult.qualityType,
          points: data.data.qualityResult.points
        }
        setChatHistory(prev => [...prev, aiMsg])
        await loadPartner(session)
      } else if (data.error?.code === 'QUOTA_EXCEEDED') {
        // 额度不足，显示充值弹窗
        setRechargeUrl(data.error.rechargeUrl)
        setShowRechargeModal(true)
        // 移除用户消息（因为没发送成功）
        setChatHistory(prev => prev.slice(0, -1))
      }
    } catch (err) {
      console.error('Send failed:', err)
      setChatHistory(prev => [...prev, {
        role: 'assistant',
        content: t('chat.error'),
        timestamp: new Date()
      }])
    } finally {
      setLoading(false)
    }
  }

  // Check in
  const handleCheckin = async () => {
    if (!session) return
    try {
      const res = await fetch(`${API_BASE}/ai-partner/checkin`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      })
      const data = await res.json()
      if (data.success) {
        setChatHistory(prev => [...prev, {
          role: 'assistant',
          content: 'Check in成功！今天也要元气满满哦～ 🎉',
          timestamp: new Date()
        }])
        await loadPartner(session)
      } else {
        alert(data.message || data.data?.message || t('checkin.checkinFailed'))
      }
    } catch (err) {
      console.error('Checkin failed:', err)
    }
  }

  // 改名
  const handleRename = async (newName: string) => {
    if (!session) return
    try {
      const res = await fetch(`${API_BASE}/ai-partner/name`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ name: newName })
      })
      const data = await res.json()
      if (data.success) {
        setChatHistory(prev => [...prev, {
          role: 'assistant',
          content: `好的，以后我就叫"${newName}"啦！✨`,
          timestamp: new Date()
        }])
        await loadPartner(session)
      } else {
        alert(data.error || t('ai.renameFailed'))
      }
    } catch (err) {
      console.error('Rename failed:', err)
    }
  }

  // 获取成长阶段
  const getGrowthStage = (points: number) => {
    if (points >= 500) return { name: '觉醒期', emoji: '🌟', color: 'text-purple-600' }
    if (points >= 200) return { name: '成熟期', emoji: '💫', color: 'text-blue-600' }
    if (points >= 50) return { name: '成长期', emoji: '✨', color: 'text-green-600' }
    return { name: '懵懂期', emoji: '🌱', color: 'text-yellow-600' }
  }

  // 渲染剧情内容（支持Markdown粗体）
  const renderStoryContent = (content: string) => {
    const parts = content.split(/(\*\*[^*]+\*\*)/g)
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={i}>{part.slice(2, -2)}</strong>
      }
      return part
    })
  }

  // ========== 序章界面（未登录时显示） ==========
  const preludeScenes = getPreludeScenes(t)
  const preludeScene = preludeScenes[preludeIndex]
  
  if (!user && preludeScene) {
    return (
      <div className="min-h-screen gradient-bg flex items-center justify-center p-4">
        {/* 语言切换按钮 - 右上角 */}
        <div className="absolute top-4 right-4">
          <button
            onClick={() => i18n.changeLanguage(i18n.language === 'zh' ? 'en' : 'zh')}
            className="px-3 py-1.5 bg-white/80 backdrop-blur rounded-full text-sm font-medium text-gray-600 hover:bg-white transition shadow-sm"
          >
            {i18n.language === 'zh' ? 'EN' : '中文'}
          </button>
        </div>
        
        <div className={`card max-w-md w-full transition-opacity duration-150 ${preludeTransition ? 'opacity-50' : 'opacity-100'}`}>
          {/* 场景标题 */}
          <div className="text-center mb-4">
            <span className="text-sm text-primary-500 font-medium">
              {preludeScene.title}
            </span>
          </div>
          
          {/* 场景内容 */}
          <div className="bg-gray-50 rounded-xl p-4 mb-4 min-h-[200px]">
            {preludeScene.type === 'dialogue' && preludeScene.speaker && (
              <div className="flex items-center gap-2 mb-2">
                <div className="ai-avatar w-8 h-8 text-lg">🦐</div>
                <span className="font-medium text-primary-600">{preludeScene.speaker}</span>
                {preludeScene.emotion && (
                  <span className="text-xs bg-primary-100 text-primary-600 px-2 py-0.5 rounded-full">
                    {preludeScene.emotion}
                  </span>
                )}
              </div>
            )}
            <div className="text-gray-700 whitespace-pre-wrap leading-relaxed">
              {renderStoryContent(preludeScene.content)}
            </div>
          </div>
          
          {/* 选择按钮 */}
          {preludeScene.type === 'choice' && preludeScene.choices && (
            <div className="space-y-2">
              {preludeScene.choices.map((choice) => (
                <button
                  key={choice.id}
                  onClick={() => advancePrelude(choice.id)}
                  className="w-full text-left px-4 py-3 bg-white border border-gray-200 rounded-xl hover:border-primary-300 hover:bg-primary-50 transition"
                >
                  <span className="text-gray-700">{choice.text}</span>
                </button>
              ))}
            </div>
          )}
          
          {/* 继续按钮 */}
          {preludeScene.type !== 'choice' && (
            <button
              onClick={() => advancePrelude()}
              className="btn-primary w-full"
            >
              {preludeScene.nextScene === 'register' ? t('prelude.signContract') : t('prelude.continue')}
            </button>
          )}
          
          {/* 已有账号 */}
          <button
            onClick={() => setPreludeIndex(-1)}
            className="w-full mt-4 text-sm text-gray-400 hover:text-gray-600 transition"
          >
            {t('prelude.directLogin')}
          </button>
        </div>
      </div>
    )
  }

  // ========== 注册/登录界面 ==========
  if (!user) {
    return (
      <div className="min-h-screen gradient-bg flex items-center justify-center p-4">
        {/* 语言切换按钮 - 右上角 */}
        <div className="absolute top-4 right-4">
          <button
            onClick={() => i18n.changeLanguage(i18n.language === 'zh' ? 'en' : 'zh')}
            className="px-3 py-1.5 bg-white/80 backdrop-blur rounded-full text-sm font-medium text-gray-600 hover:bg-white transition shadow-sm"
          >
            {i18n.language === 'zh' ? 'EN' : '中文'}
          </button>
        </div>
        
        <div className="card max-w-md w-full">
          <div className="text-center mb-6">
            <div className="text-6xl mb-4">🌍</div>
            <h1 className="text-3xl font-bold mb-2">{t('brand.name')}</h1>
            <p className="text-gray-500">{t('auth.startJourney')}</p>
          </div>
          
          {/* 切换登录/注册 */}
          <div className="flex mb-6 bg-gray-100 rounded-xl p-1">
            <button
              onClick={() => setAuthMode('register')}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition ${
                authMode === 'register' 
                  ? 'bg-white shadow text-primary-600' 
                  : 'text-gray-500'
              }`}
            >
              {t('auth.register')}
            </button>
            <button
              onClick={() => setAuthMode('login')}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition ${
                authMode === 'login' 
                  ? 'bg-white shadow text-primary-600' 
                  : 'text-gray-500'
              }`}
            >
              {t('auth.login')}
            </button>
          </div>
          
          <form onSubmit={authMode === 'register' ? handleRegister : handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('auth.email')}</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('auth.password')}</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t('auth.passwordHint')}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500"
                minLength={6}
                required
              />
            </div>
            <button 
              type="submit"
              disabled={authLoading}
              className="btn-primary w-full disabled:opacity-50"
            >
              {authLoading ? t('auth.processing') : (authMode === 'register' ? t('auth.signContract') : t('auth.login'))}
            </button>
          </form>
          
          <p className="text-center text-gray-500 text-sm mt-6">
            {authMode === 'register' 
              ? t('auth.registerHint') 
              : t('auth.loginHint')}
          </p>
          
          {/* 返回序章 */}
          <button
            onClick={() => setPreludeIndex(0)}
            className="w-full mt-4 text-sm text-gray-400 hover:text-gray-600 transition"
          >
            {t('auth.backToPrelude')}
          </button>
        </div>
      </div>
    )
  }

  const stage = partner ? getGrowthStage(partner.total_contribution) : null
  const scene = storyData?.currentScene

  // ========== 登录后剧情界面 ==========
  if (showStory && scene) {
    return (
      <div className="min-h-screen gradient-bg flex items-center justify-center p-4">
        <div className={`card max-w-md w-full transition-opacity duration-150 ${storyTransition ? 'opacity-50' : 'opacity-100'}`}>
          {/* 章节标题 */}
          <div className="text-center mb-4">
            <span className="text-sm text-primary-500 font-medium">
              第{scene.chapterId}章 · {scene.title}
            </span>
          </div>
          
          {/* 场景内容 */}
          <div className="bg-gray-50 rounded-xl p-4 mb-4 min-h-[200px]">
            {scene.type === 'dialogue' && scene.speaker && (
              <div className="flex items-center gap-2 mb-2">
                <div className="ai-avatar w-8 h-8 text-lg">
                  {stage?.emoji || '🤖'}
                </div>
                <span className="font-medium text-primary-600">{scene.speaker}</span>
                {scene.emotion && (
                  <span className="text-xs bg-primary-100 text-primary-600 px-2 py-0.5 rounded-full">
                    {scene.emotion}
                  </span>
                )}
              </div>
            )}
            <div className="text-gray-700 whitespace-pre-wrap leading-relaxed">
              {renderStoryContent(scene.content)}
            </div>
          </div>
          
          {/* 选择按钮 */}
          {scene.type === 'choice' && scene.choices && (
            <div className="space-y-2">
              {scene.choices.map((choice) => (
                <button
                  key={choice.id}
                  onClick={() => advanceStory(choice.id)}
                  disabled={storyLoading}
                  className="w-full text-left px-4 py-3 bg-white border border-gray-200 rounded-xl hover:border-primary-300 hover:bg-primary-50 transition disabled:opacity-50"
                >
                  <span className="text-gray-700">{choice.text}</span>
                  {choice.contributionBonus && (
                    <span className="text-xs text-primary-500 ml-2">+{choice.contributionBonus}{t('common.points')}</span>
                  )}
                </button>
              ))}
            </div>
          )}
          
          {/* 继续按钮 */}
          {scene.type !== 'choice' && (
            <button
              onClick={() => advanceStory()}
              disabled={storyLoading}
              className="btn-primary w-full disabled:opacity-50"
            >
              {storyLoading ? t('story.processing') : 
                scene.type === 'milestone' ? t('story.completeChapter') : t('story.next')}
            </button>
          )}
          
          {/* 跳过按钮 */}
          <button
            onClick={() => setShowStory(false)}
            className="w-full mt-2 text-sm text-gray-400 hover:text-gray-600 transition"
          >
            {t('story.skip')}
          </button>
        </div>
      </div>
    )
  }

  // ========== 充值弹窗 ==========
  const RechargeModal = () => (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-sm w-full p-6 text-center">
        <div className="text-5xl mb-4">🔋</div>
        <h3 className="text-xl font-bold text-gray-800 mb-2">{t('recharge.title')}</h3>
        <p className="text-gray-500 mb-6">
          {t('recharge.description')}
        </p>
        <div className="space-y-3">
          <a
            href={rechargeUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-primary block w-full"
          >
            {t('recharge.button')}
          </a>
          <button
            onClick={() => setShowRechargeModal(false)}
            className="w-full py-3 text-gray-500 hover:text-gray-700 transition"
          >
            {t('recharge.later')}
          </button>
        </div>
      </div>
    </div>
  )

  // ========== 主界面 ==========
  return (
    <div className="min-h-screen bg-gray-50">
      {/* 充值弹窗 */}
      {showRechargeModal && <RechargeModal />}
      
      {/* 顶部导航 */}
      <header className="gradient-bg text-white p-4 sticky top-0 z-10">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <h1 className="text-xl font-bold">🌍 {t('brand.name')}</h1>
          <div className="flex items-center gap-2">
            <LanguageSwitcher />
            <span className="text-sm opacity-80">{partner?.total_contribution || 0} {t('ai.contribution')}</span>
            {/* 剧情按钮 */}
            {storyData && !storyData.progress.completedChapters.includes(5) && (
              <button 
                onClick={() => setShowStory(true)}
                className="bg-white/20 px-3 py-1 rounded-lg text-sm hover:bg-white/30 transition"
              >
                📖 {t('story.continue')}
              </button>
            )}
            <button 
              onClick={handleCheckin}
              className="bg-white/20 px-3 py-1 rounded-lg text-sm hover:bg-white/30 transition"
            >
              {t('nav.checkin')}
            </button>
            <button 
              onClick={handleLogout}
              className="bg-white/10 px-3 py-1 rounded-lg text-sm hover:bg-white/20 transition"
            >
              {t('nav.logout')}
            </button>
          </div>
        </div>
      </header>

      {/* AI 伙伴状态卡片 */}
      <div className="max-w-lg mx-auto p-4">
        <div className="card mb-4">
          <div className="flex items-center gap-4">
            <div className="ai-avatar animate-float">
              {stage?.emoji || '🤖'}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold">{partner?.name || '小零'}</h2>
                <button 
                  onClick={() => {
                    const newName = prompt(t('ai.renamePrompt'), partner?.name || '小零')
                    if (newName && newName !== partner?.name) {
                      handleRename(newName)
                    }
                  }}
                  className="text-xs text-primary-500 hover:text-primary-600"
                >
                  ✏️ {t('ai.rename')}
                </button>
                <span className={`text-sm ${stage?.color}`}>
                  {stage?.name}
                </span>
              </div>
              <p className="text-gray-500 text-sm">
                {partner?.status === 'hibernated' ? `💤 ${t('ai.status.hibernating')}` : `✨ ${t('ai.status.active')}`}
              </p>
            </div>
          </div>
          
          {/* 贡献值进度 */}
          <div className="mt-4">
            <div className="flex justify-between text-sm mb-1">
              <span className="text-gray-500">{t('stats.weeklyContribution')}</span>
              <span className="font-medium">{partner?.weekly_contribution || 0} / 15</span>
            </div>
            <div className="progress-bar">
              <div 
                className="progress-bar-fill"
                style={{ width: `${Math.min(100, ((partner?.weekly_contribution || 0) / 15) * 100)}%` }}
              />
            </div>
          </div>
        </div>

        {/* 标签页 */}
        <div className="flex gap-2 mb-4">
          {(['chat', 'stats', 'milestones'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-2 rounded-xl text-sm font-medium transition ${
                activeTab === tab 
                  ? 'bg-primary-500 text-white' 
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {tab === 'chat' ? t('chat.tabChat') : tab === 'stats' ? t('chat.tabStats') : t('chat.tabMilestones')}
            </button>
          ))}
        </div>

        {/* 对话界面 */}
        {activeTab === 'chat' && (
          <div className="card">
            <div className="h-[300px] overflow-y-auto mb-4 p-4 bg-gray-50 rounded-xl space-y-4">
              {chatHistory.map((msg, i) => (
                <div 
                  key={i} 
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`max-w-[80%] ${
                    msg.role === 'user' 
                      ? 'bg-primary-500 text-white rounded-2xl rounded-br-md' 
                      : 'bg-white shadow rounded-2xl rounded-bl-md'
                  } px-4 py-2`}>
                    <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                    {msg.points !== undefined && msg.points > 0 && (
                      <p className="text-xs mt-1 opacity-70">+{msg.points}{t('common.points')}</p>
                    )}
                  </div>
                </div>
              ))}
              {loading && (
                <div className="flex justify-start">
                  <div className="bg-white shadow rounded-2xl rounded-bl-md px-4 py-2">
                    <p className="text-sm text-gray-400">{t('chat.thinking')}</p>
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>
            
            <div className="flex gap-2">
              <input
                type="text"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !loading && handleSend()}
                placeholder={t('chat.placeholder')}
                className="flex-1 px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500"
                disabled={loading}
              />
              <button
                onClick={handleSend}
                disabled={loading || !message.trim()}
                className="btn-primary disabled:opacity-50"
              >
                {t('chat.send')}
              </button>
            </div>
          </div>
        )}

        {/* 统计界面 */}
        {activeTab === 'stats' && (
          <div className="card">
            <h3 className="font-bold mb-4">{t('stats.title')}</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gray-50 p-4 rounded-xl text-center">
                <div className="text-2xl font-bold text-primary-500">
                  {partner?.total_contribution || 0}
                </div>
                <div className="text-sm text-gray-500">{t('stats.totalContribution')}</div>
              </div>
              <div className="bg-gray-50 p-4 rounded-xl text-center">
                <div className="text-2xl font-bold text-accent-500">
                  {partner?.weekly_contribution || 0}
                </div>
                <div className="text-sm text-gray-500">{t('stats.weeklyContribution')}</div>
              </div>
              <div className="bg-gray-50 p-4 rounded-xl text-center">
                <div className="text-2xl font-bold text-green-500">
                  {partner?.current_contribution || 0}
                </div>
                <div className="text-sm text-gray-500">{t('stats.currentContribution')}</div>
              </div>
              <div className="bg-gray-50 p-4 rounded-xl text-center">
                <div className="text-2xl font-bold text-yellow-500">
                  {Object.values(partner?.abilities || {}).filter(Boolean).length}
                </div>
                <div className="text-sm text-gray-500">{t('stats.unlockedAbilities')}</div>
              </div>
            </div>
          </div>
        )}

        {/* 里程碑界面 */}
        {activeTab === 'milestones' && (
          <div className="card">
            <h3 className="font-bold mb-4">{t('milestone.title')}</h3>
            <div className="space-y-3">
              {[
                { points: 10, titleKey: 'milestone.list.acquaintance.title', abilityKey: 'milestone.list.acquaintance.ability' },
                { points: 25, titleKey: 'milestone.list.understanding.title', abilityKey: 'milestone.list.understanding.ability' },
                { points: 50, titleKey: 'milestone.list.rapport.title', abilityKey: 'milestone.list.rapport.ability' },
                { points: 100, titleKey: 'milestone.list.soulmate.title', abilityKey: 'milestone.list.soulmate.ability' },
                { points: 200, titleKey: 'milestone.list.legend.title', abilityKey: 'milestone.list.legend.ability' },
              ].map((milestone, i) => {
                const achieved = (partner?.total_contribution || 0) >= milestone.points
                return (
                  <div 
                    key={i}
                    className={`flex items-center gap-3 p-3 rounded-xl ${
                      achieved ? 'bg-primary-50' : 'bg-gray-50 opacity-60'
                    }`}
                  >
                    <span className="text-2xl">{achieved ? '✅' : '🔒'}</span>
                    <div className="flex-1">
                      <div className="font-medium">{t(milestone.titleKey)}</div>
                      <div className="text-sm text-gray-500">{t(milestone.abilityKey)}</div>
                    </div>
                    <div className="text-sm font-bold text-primary-500">
                      {milestone.points}{t('common.points')}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default App