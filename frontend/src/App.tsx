import { useState, useEffect } from 'react'
import './App.css'

// API 基础地址
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1'

// 类型定义
interface User {
  id: string
  telegram_user_id: number
  telegram_username: string
  onboarding_completed: boolean
}

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
  emotionDetected: string
  shouldCreateMemory: boolean
  dataRarity: string
}

function App() {
  const [user, setUser] = useState<User | null>(null)
  const [partner, setPartner] = useState<AIPartner | null>(null)
  const [message, setMessage] = useState('')
  const [lastResult, setLastResult] = useState<QualityResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<'chat' | 'stats' | 'milestones'>('chat')

  // 模拟登录（实际应使用 Supabase Auth）
  useEffect(() => {
    // 检查本地存储的用户信息
    const savedUser = localStorage.getItem('weareallworld_user')
    if (savedUser) {
      setUser(JSON.parse(savedUser))
    }
  }, [])

  // 注册/登录
  const handleLogin = async (telegramId: string) => {
    try {
      const res = await fetch(`${API_BASE}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          telegramUserId: parseInt(telegramId), 
          telegramUsername: 'web_user' 
        })
      })
      const data = await res.json()
      if (data.success) {
        setUser(data.data.user)
        setPartner(data.data.aiPartner)
        localStorage.setItem('weareallworld_user', JSON.stringify(data.data.user))
      }
    } catch (err) {
      console.error('Login failed:', err)
    }
  }

  // 发送消息
  const handleSend = async () => {
    if (!message.trim() || !user) return
    
    setLoading(true)
    try {
      const res = await fetch(`${API_BASE}/dialogue`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message })
      })
      const data = await res.json()
      if (data.success) {
        setLastResult(data.data.qualityResult)
        setMessage('')
        // 刷新伙伴数据
        await refreshPartner()
      }
    } catch (err) {
      console.error('Send failed:', err)
    } finally {
      setLoading(false)
    }
  }

  // 刷新伙伴数据
  const refreshPartner = async () => {
    if (!user) return
    try {
      const res = await fetch(`${API_BASE}/ai-partner`)
      const data = await res.json()
      if (data.success) {
        setPartner(data.data)
      }
    } catch (err) {
      console.error('Refresh failed:', err)
    }
  }

  // 签到
  const handleCheckin = async () => {
    try {
      const res = await fetch(`${API_BASE}/ai-partner/checkin`, { method: 'POST' })
      const data = await res.json()
      if (data.success) {
        alert('签到成功！')
        await refreshPartner()
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

  // 未登录状态
  if (!user) {
    return (
      <div className="min-h-screen gradient-bg flex items-center justify-center p-4">
        <div className="card max-w-md w-full text-center">
          <div className="text-6xl mb-4">🌍</div>
          <h1 className="text-3xl font-bold mb-2">天下一家</h1>
          <p className="text-gray-500 mb-8">WeAreAll.World</p>
          
          <p className="text-gray-600 mb-6">
            与AI伙伴建立真正的情感连接，<br/>
            共同成长，见证奇迹
          </p>
          
          <div className="space-y-4">
            <input
              type="text"
              placeholder="输入 Telegram ID 开始"
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleLogin((e.target as HTMLInputElement).value)
                }
              }}
            />
            <button 
              className="btn-primary w-full"
              onClick={() => {
                const input = document.querySelector('input') as HTMLInputElement
                if (input?.value) handleLogin(input.value)
              }}
            >
              开始旅程
            </button>
          </div>
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
                <h2 className="text-lg font-bold">我的AI伙伴</h2>
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
            <div className="min-h-[200px] mb-4 p-4 bg-gray-50 rounded-xl">
              {lastResult ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">
                      {lastResult.qualityType === 'special_memory' ? '🌟' :
                       lastResult.qualityType === 'deep_thought' ? '💭' :
                       lastResult.qualityType === 'experience' ? '📖' :
                       lastResult.qualityType === 'emotion' ? '❤️' :
                       lastResult.qualityType === 'daily' ? '💬' : '👋'}
                    </span>
                    <span className="font-medium">{lastResult.reason}</span>
                    <span className="ml-auto text-primary-500 font-bold">+{lastResult.points}</span>
                  </div>
                  <p className="text-xs text-gray-400">{lastResult.dataRarity}</p>
                </div>
              ) : (
                <p className="text-gray-400 text-center">开始和AI伙伴聊天吧~</p>
              )}
            </div>
            
            <div className="flex gap-2">
              <input
                type="text"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                placeholder="说点什么..."
                className="flex-1 px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500"
                disabled={loading}
              />
              <button
                onClick={handleSend}
                disabled={loading || !message.trim()}
                className="btn-primary disabled:opacity-50"
              >
                {loading ? '...' : '发送'}
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