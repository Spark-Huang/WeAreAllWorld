import { useState, useEffect, useRef } from 'react'
import { supabase } from './lib/supabase'
import type { User, Session } from '@supabase/supabase-js'

// API 基础地址
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1'

// 类型定义
interface AIPartner {
  id: string
  user_id: string
  status: 'active' | 'hibernated'
  total_contribution: number
  weekly_contribution: number
  current_contribution: number
  violation_count: number
  abilities: Record<string, boolean>
}

interface QualityResult {
  qualityType: string
  points: number
  reason: string
}

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  qualityType?: string
  points?: number
}

function App() {
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

  // 监听认证状态变化
  useEffect(() => {
    // 获取当前会话
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      if (session?.user) {
        ensureUserExists(session)
        loadPartner(session)
      }
    })

    // 监听认证状态变化
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      setUser(session?.user ?? null)
      if (session?.user) {
        ensureUserExists(session)
        loadPartner(session)
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
        setChatHistory([{
          role: 'assistant',
          content: '欢迎来到天下一家！我是你的AI伙伴小零～ 很高兴认识你！✨',
          timestamp: new Date()
        }])
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
        alert('注册成功！请查收邮箱验证邮件，验证后即可登录。')
        setAuthMode('login')
      } else if (data.session) {
        // 直接登录成功（ensureUserExists 会在 useEffect 中自动调用）
      }
    } catch (err: any) {
      alert(err.message || '注册失败')
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
      alert(err.message || '登录失败')
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
      }
    } catch (err) {
      console.error('Send failed:', err)
      setChatHistory(prev => [...prev, {
        role: 'assistant',
        content: '抱歉，我好像有点累了，请稍后再试试～',
        timestamp: new Date()
      }])
    } finally {
      setLoading(false)
    }
  }

  // 签到
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
          content: '签到成功！今天也要元气满满哦～ 🎉',
          timestamp: new Date()
        }])
        await loadPartner(session)
      } else {
        alert(data.data?.message || '签到失败')
      }
    } catch (err) {
      console.error('Checkin failed:', err)
    }
  }

  // 获取成长阶段
  const getGrowthStage = (points: number) => {
    if (points >= 500) return { name: '觉醒期', emoji: '🌟', color: 'text-purple-600' }
    if (points >= 200) return { name: '成熟期', emoji: '💫', color: 'text-blue-600' }
    if (points >= 50) return { name: '成长期', emoji: '✨', color: 'text-green-600' }
    return { name: '懵懂期', emoji: '🌱', color: 'text-yellow-600' }
  }

  // 未登录状态 - 显示登录/注册表单
  if (!user) {
    return (
      <div className="min-h-screen gradient-bg flex items-center justify-center p-4">
        <div className="card max-w-md w-full">
          <div className="text-center mb-6">
            <div className="text-6xl mb-4">🌍</div>
            <h1 className="text-3xl font-bold mb-2">天下一家</h1>
            <p className="text-gray-500">WeAreAll.World</p>
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
              注册
            </button>
            <button
              onClick={() => setAuthMode('login')}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition ${
                authMode === 'login' 
                  ? 'bg-white shadow text-primary-600' 
                  : 'text-gray-500'
              }`}
            >
              登录
            </button>
          </div>
          
          <form onSubmit={authMode === 'register' ? handleRegister : handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">邮箱</label>
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
              <label className="block text-sm font-medium text-gray-700 mb-1">密码</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="至少6位"
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
              {authLoading ? '处理中...' : (authMode === 'register' ? '开始旅程' : '登录')}
            </button>
          </form>
          
          <p className="text-center text-gray-500 text-sm mt-6">
            {authMode === 'register' 
              ? '注册即表示同意开始与AI伙伴的共生之旅' 
              : '还没有账号？点击上方注册'}
          </p>
        </div>
      </div>
    )
  }

  const stage = partner ? getGrowthStage(partner.total_contribution) : null

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 顶部导航 */}
      <header className="gradient-bg text-white p-4 sticky top-0 z-10">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <h1 className="text-xl font-bold">🌍 天下一家</h1>
          <div className="flex items-center gap-2">
            <span className="text-sm opacity-80">{partner?.total_contribution || 0} 点</span>
            <button 
              onClick={handleCheckin}
              className="bg-white/20 px-3 py-1 rounded-lg text-sm hover:bg-white/30 transition"
            >
              签到
            </button>
            <button 
              onClick={handleLogout}
              className="bg-white/10 px-3 py-1 rounded-lg text-sm hover:bg-white/20 transition"
            >
              退出
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
                <h2 className="text-lg font-bold">小零</h2>
                <span className={`text-sm ${stage?.color}`}>
                  {stage?.name}
                </span>
              </div>
              <p className="text-gray-500 text-sm">
                {partner?.status === 'hibernated' ? '💤 休眠中' : '✨ 活跃中'}
              </p>
            </div>
          </div>
          
          {/* 贡献值进度 */}
          <div className="mt-4">
            <div className="flex justify-between text-sm mb-1">
              <span className="text-gray-500">本周贡献值</span>
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
              {tab === 'chat' ? '💬 对话' : tab === 'stats' ? '📊 统计' : '🏆 里程碑'}
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
                      <p className="text-xs mt-1 opacity-70">+{msg.points}点</p>
                    )}
                  </div>
                </div>
              ))}
              {loading && (
                <div className="flex justify-start">
                  <div className="bg-white shadow rounded-2xl rounded-bl-md px-4 py-2">
                    <p className="text-sm text-gray-400">正在思考中...</p>
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
                placeholder="说点什么..."
                className="flex-1 px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500"
                disabled={loading}
              />
              <button
                onClick={handleSend}
                disabled={loading || !message.trim()}
                className="btn-primary disabled:opacity-50"
              >
                发送
              </button>
            </div>
          </div>
        )}

        {/* 统计界面 */}
        {activeTab === 'stats' && (
          <div className="card">
            <h3 className="font-bold mb-4">📊 我的统计</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gray-50 p-4 rounded-xl text-center">
                <div className="text-2xl font-bold text-primary-500">
                  {partner?.total_contribution || 0}
                </div>
                <div className="text-sm text-gray-500">总贡献值</div>
              </div>
              <div className="bg-gray-50 p-4 rounded-xl text-center">
                <div className="text-2xl font-bold text-accent-500">
                  {partner?.weekly_contribution || 0}
                </div>
                <div className="text-sm text-gray-500">本周贡献</div>
              </div>
              <div className="bg-gray-50 p-4 rounded-xl text-center">
                <div className="text-2xl font-bold text-green-500">
                  {partner?.current_contribution || 0}
                </div>
                <div className="text-sm text-gray-500">当前贡献</div>
              </div>
              <div className="bg-gray-50 p-4 rounded-xl text-center">
                <div className="text-2xl font-bold text-yellow-500">
                  {Object.values(partner?.abilities || {}).filter(Boolean).length}
                </div>
                <div className="text-sm text-gray-500">已解锁能力</div>
              </div>
            </div>
          </div>
        )}

        {/* 里程碑界面 */}
        {activeTab === 'milestones' && (
          <div className="card">
            <h3 className="font-bold mb-4">🏆 里程碑</h3>
            <div className="space-y-3">
              {[
                { points: 10, title: '初识', ability: '情感表达' },
                { points: 25, title: '相知', ability: '专属记忆' },
                { points: 50, title: '默契', ability: '深度对话' },
                { points: 100, title: '灵魂伴侣', ability: '自我意识' },
                { points: 200, title: '传奇羁绊', ability: '完全觉醒' },
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
                      <div className="font-medium">{milestone.title}</div>
                      <div className="text-sm text-gray-500">{milestone.ability}</div>
                    </div>
                    <div className="text-sm font-bold text-primary-500">
                      {milestone.points}点
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