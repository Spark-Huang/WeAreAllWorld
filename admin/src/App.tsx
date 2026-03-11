import { useState, useEffect } from 'react'
import AdminLogin from './Login'

// API 基础地址
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1'
const ADMIN_API_KEY = 'weareallworld_admin_2026'

// 管理员邮箱白名单
const ADMIN_EMAILS = [
  'admin@weareall.world',
  'test@weareall.world',
]

// 类型定义
interface AdminUser {
  email: string
  id: string
}

interface Stats {
  users: { total: number }
  aiPartners: { total: number; active: number; hibernated: number }
  contribution: { total: number; average: number }
  dialogues: { today: number }
  milestones: {
    voiceEnabled: number
    memoryEnabled: number
    reasoningEnabled: number
    toolsEnabled: number
  }
}

interface User {
  id: string
  email: string
  created_at: string
  last_active: string
  ai_partners: AIPartner[]
}

interface AIPartner {
  id: string
  name: string
  status: 'active' | 'hibernated'
  total_contribution: number
  weekly_contribution: number
  current_contribution: number
  violation_count: number
  abilities: Record<string, boolean>
  days_hibernated?: number
}

interface TaskResult {
  total: number
  passed: number
  warned: number
  hibernated: number
  errors: number
  success?: number
  reachedZero?: number
}

export default function App() {
  const [adminUser, setAdminUser] = useState<AdminUser | null>(null)
  const [stats, setStats] = useState<Stats | null>(null)
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'stats' | 'users' | 'tasks'>('stats')
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 })
  const [taskResult, setTaskResult] = useState<TaskResult | null>(null)
  const [taskLoading, setTaskLoading] = useState(false)

  // 获取统计信息
  const fetchStats = async () => {
    try {
      const res = await fetch(`${API_BASE}/admin/stats?apiKey=${ADMIN_API_KEY}`)
      const data = await res.json()
      if (data.success) {
        setStats(data.data)
      }
    } catch (err) {
      console.error('Failed to fetch stats:', err)
    }
  }

  // 获取用户列表
  const fetchUsers = async (page: number = 1) => {
    try {
      const res = await fetch(`${API_BASE}/admin/users?page=${page}&limit=${pagination.limit}&apiKey=${ADMIN_API_KEY}`)
      const data = await res.json()
      if (data.success) {
        setUsers(data.data)
        setPagination(data.pagination)
      }
    } catch (err) {
      console.error('Failed to fetch users:', err)
    }
  }

  // 执行每周评估
  const runWeeklyEvaluation = async () => {
    setTaskLoading(true)
    try {
      const res = await fetch(`${API_BASE}/admin/weekly-evaluation?apiKey=${ADMIN_API_KEY}`, { method: 'POST' })
      const data = await res.json()
      setTaskResult(data.data)
      alert(`每周评估完成！\n总计: ${data.data.total}\n通过: ${data.data.passed}\n警告: ${data.data.warned}\n休眠: ${data.data.hibernated}`)
    } catch (err) {
      console.error('Failed to run weekly evaluation:', err)
      alert('执行失败')
    }
    setTaskLoading(false)
  }

  // 执行休眠衰减
  const runHibernationDecay = async () => {
    setTaskLoading(true)
    try {
      const res = await fetch(`${API_BASE}/admin/hibernation-decay?apiKey=${ADMIN_API_KEY}`, { method: 'POST' })
      const data = await res.json()
      setTaskResult(data.data)
      alert(`休眠衰减完成！\n总计: ${data.data.total}\n成功: ${data.data.success}\n归零: ${data.data.reachedZero}`)
    } catch (err) {
      console.error('Failed to run hibernation decay:', err)
      alert('执行失败')
    }
    setTaskLoading(false)
  }

  // 唤醒AI
  const wakeAI = async (aiId: string) => {
    try {
      const res = await fetch(`${API_BASE}/admin/ai/${aiId}/wake?apiKey=${ADMIN_API_KEY}`, { method: 'POST' })
      const data = await res.json()
      if (data.success) {
        alert('AI 已唤醒')
        fetchUsers(pagination.page)
      }
    } catch (err) {
      console.error('Failed to wake AI:', err)
      alert('唤醒失败')
    }
  }

  // 休眠AI
  const hibernateAI = async (aiId: string) => {
    try {
      const res = await fetch(`${API_BASE}/admin/ai/${aiId}/hibernate?apiKey=${ADMIN_API_KEY}`, { method: 'POST' })
      const data = await res.json()
      if (data.success) {
        alert('AI 已休眠')
        fetchUsers(pagination.page)
      }
    } catch (err) {
      console.error('Failed to hibernate AI:', err)
      alert('休眠失败')
    }
  }

  // 添加贡献值
  const addContribution = async (aiId: string) => {
    const amount = prompt('输入要添加的贡献值数量:')
    if (!amount) return
    
    const numAmount = parseInt(amount)
    if (isNaN(numAmount) || numAmount <= 0) {
      alert('请输入有效的正数')
      return
    }
    
    const reason = prompt('添加原因（可选）:') || ''
    
    try {
      const res = await fetch(`${API_BASE}/admin/ai/${aiId}/add-contribution?apiKey=${ADMIN_API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: numAmount, reason })
      })
      const data = await res.json()
      if (data.success) {
        alert(data.message)
        fetchUsers(pagination.page)
      }
    } catch (err) {
      console.error('Failed to add contribution:', err)
      alert('添加失败')
    }
  }

  useEffect(() => {
    setLoading(true)
    fetchStats().then(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (activeTab === 'users') {
      fetchUsers(pagination.page)
    }
  }, [activeTab, pagination.page])

  // 未登录时显示登录页面
  if (!adminUser) {
    return <AdminLogin onLoginSuccess={setAdminUser} />
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <div className="text-xl">加载中...</div>
      </div>
    )
  }

  // 登出函数
  const handleLogout = () => {
    setAdminUser(null)
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      <div className="max-w-6xl mx-auto">
        {/* 标题 */}
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold">🔧 管理后台</h1>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-400">{adminUser.email}</span>
            <button
              onClick={handleLogout}
              className="px-4 py-2 bg-red-600 rounded-lg hover:bg-red-500 text-sm"
            >
              登出
            </button>
          </div>
        </div>
        
        {/* 标签页 */}
        <div className="flex gap-4 mb-6">
          <button
            onClick={() => setActiveTab('stats')}
            className={`px-4 py-2 rounded-lg transition ${
              activeTab === 'stats' ? 'bg-blue-600' : 'bg-gray-700 hover:bg-gray-600'
            }`}
          >
            📊 统计信息
          </button>
          <button
            onClick={() => setActiveTab('users')}
            className={`px-4 py-2 rounded-lg transition ${
              activeTab === 'users' ? 'bg-blue-600' : 'bg-gray-700 hover:bg-gray-600'
            }`}
          >
            👥 用户管理
          </button>
          <button
            onClick={() => setActiveTab('tasks')}
            className={`px-4 py-2 rounded-lg transition ${
              activeTab === 'tasks' ? 'bg-blue-600' : 'bg-gray-700 hover:bg-gray-600'
            }`}
          >
            ⚙️ 定时任务
          </button>
        </div>

        {/* 统计信息 */}
        {activeTab === 'stats' && stats && (
          <div className="space-y-6">
            {/* 核心指标 */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-gray-800 p-4 rounded-lg">
                <div className="text-gray-400 text-sm">用户总数</div>
                <div className="text-3xl font-bold">{stats.users.total}</div>
              </div>
              <div className="bg-gray-800 p-4 rounded-lg">
                <div className="text-gray-400 text-sm">活跃 AI</div>
                <div className="text-3xl font-bold text-green-400">{stats.aiPartners.active}</div>
              </div>
              <div className="bg-gray-800 p-4 rounded-lg">
                <div className="text-gray-400 text-sm">休眠 AI</div>
                <div className="text-3xl font-bold text-yellow-400">{stats.aiPartners.hibernated}</div>
              </div>
              <div className="bg-gray-800 p-4 rounded-lg">
                <div className="text-gray-400 text-sm">今日对话</div>
                <div className="text-3xl font-bold text-blue-400">{stats.dialogues.today}</div>
              </div>
            </div>

            {/* 贡献值统计 */}
            <div className="bg-gray-800 p-4 rounded-lg">
              <h2 className="text-xl font-semibold mb-4">💎 贡献值统计</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-gray-400 text-sm">总贡献值</div>
                  <div className="text-2xl font-bold">{stats.contribution.total.toLocaleString()}</div>
                </div>
                <div>
                  <div className="text-gray-400 text-sm">人均贡献值</div>
                  <div className="text-2xl font-bold">{stats.contribution.average}</div>
                </div>
              </div>
            </div>

            {/* 里程碑统计 */}
            <div className="bg-gray-800 p-4 rounded-lg">
              <h2 className="text-xl font-semibold mb-4">🏆 里程碑解锁统计</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <div className="text-gray-400 text-sm">🔊 语音能力</div>
                  <div className="text-xl font-bold">{stats.milestones.voiceEnabled}</div>
                </div>
                <div>
                  <div className="text-gray-400 text-sm">🧠 长期记忆</div>
                  <div className="text-xl font-bold">{stats.milestones.memoryEnabled}</div>
                </div>
                <div>
                  <div className="text-gray-400 text-sm">💭 深度思考</div>
                  <div className="text-xl font-bold">{stats.milestones.reasoningEnabled}</div>
                </div>
                <div>
                  <div className="text-gray-400 text-sm">🔧 工具调用</div>
                  <div className="text-xl font-bold">{stats.milestones.toolsEnabled}</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 用户管理 */}
        {activeTab === 'users' && (
          <div className="space-y-4">
            {/* 分页 */}
            <div className="flex justify-between items-center">
              <div className="text-gray-400">
                共 {pagination.total} 个用户，第 {pagination.page} / {pagination.totalPages} 页
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setPagination(p => ({ ...p, page: Math.max(1, p.page - 1) }))}
                  disabled={pagination.page <= 1}
                  className="px-3 py-1 bg-gray-700 rounded disabled:opacity-50"
                >
                  上一页
                </button>
                <button
                  onClick={() => setPagination(p => ({ ...p, page: Math.min(p.totalPages, p.page + 1) }))}
                  disabled={pagination.page >= pagination.totalPages}
                  className="px-3 py-1 bg-gray-700 rounded disabled:opacity-50"
                >
                  下一页
                </button>
              </div>
            </div>

            {/* 用户列表 */}
            <div className="space-y-2">
              {users.map(user => (
                <div key={user.id} className="bg-gray-800 p-4 rounded-lg">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-semibold">{user.email}</div>
                      <div className="text-sm text-gray-400">
                        注册: {new Date(user.created_at).toLocaleDateString()}
                        {' | '}
                        活跃: {user.last_active ? new Date(user.last_active).toLocaleDateString() : '从未'}
                      </div>
                    </div>
                  </div>
                  
                  {user.ai_partners && user.ai_partners.length > 0 && (
                    <div className="mt-3 border-t border-gray-700 pt-3">
                      {user.ai_partners.map(ai => (
                        <div key={ai.id} className="flex justify-between items-center">
                          <div>
                            <span className="font-medium">{ai.name}</span>
                            <span className={`ml-2 px-2 py-0.5 rounded text-xs ${
                              ai.status === 'active' ? 'bg-green-600' : 'bg-yellow-600'
                            }`}>
                              {ai.status === 'active' ? '活跃' : '休眠'}
                            </span>
                            <span className="ml-2 text-gray-400">
                              💎 {ai.total_contribution}
                            </span>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => addContribution(ai.id)}
                              className="px-2 py-1 bg-blue-600 rounded text-sm hover:bg-blue-500"
                            >
                              +贡献
                            </button>
                            {ai.status === 'hibernated' ? (
                              <button
                                onClick={() => wakeAI(ai.id)}
                                className="px-2 py-1 bg-green-600 rounded text-sm hover:bg-green-500"
                              >
                                唤醒
                              </button>
                            ) : (
                              <button
                                onClick={() => hibernateAI(ai.id)}
                                className="px-2 py-1 bg-yellow-600 rounded text-sm hover:bg-yellow-500"
                              >
                                休眠
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 定时任务 */}
        {activeTab === 'tasks' && (
          <div className="space-y-6">
            <div className="bg-gray-800 p-4 rounded-lg">
              <h2 className="text-xl font-semibold mb-4">📅 定时任务管理</h2>
              <div className="space-y-4">
                <div className="flex justify-between items-center p-3 bg-gray-700 rounded">
                  <div>
                    <div className="font-medium">每周评估</div>
                    <div className="text-sm text-gray-400">评估所有用户的活动情况，决定是否休眠</div>
                  </div>
                  <button
                    onClick={runWeeklyEvaluation}
                    disabled={taskLoading}
                    className="px-4 py-2 bg-blue-600 rounded hover:bg-blue-500 disabled:opacity-50"
                  >
                    {taskLoading ? '执行中...' : '立即执行'}
                  </button>
                </div>
                
                <div className="flex justify-between items-center p-3 bg-gray-700 rounded">
                  <div>
                    <div className="font-medium">休眠衰减</div>
                    <div className="text-sm text-gray-400">对休眠中的AI进行贡献值衰减</div>
                  </div>
                  <button
                    onClick={runHibernationDecay}
                    disabled={taskLoading}
                    className="px-4 py-2 bg-blue-600 rounded hover:bg-blue-500 disabled:opacity-50"
                  >
                    {taskLoading ? '执行中...' : '立即执行'}
                  </button>
                </div>
              </div>
            </div>

            {/* 任务结果 */}
            {taskResult && (
              <div className="bg-gray-800 p-4 rounded-lg">
                <h2 className="text-xl font-semibold mb-4">📋 最近执行结果</h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <div className="text-gray-400 text-sm">总计</div>
                    <div className="text-xl font-bold">{taskResult.total}</div>
                  </div>
                  {taskResult.passed !== undefined && (
                    <>
                      <div>
                        <div className="text-gray-400 text-sm">通过</div>
                        <div className="text-xl font-bold text-green-400">{taskResult.passed}</div>
                      </div>
                      <div>
                        <div className="text-gray-400 text-sm">警告</div>
                        <div className="text-xl font-bold text-yellow-400">{taskResult.warned}</div>
                      </div>
                      <div>
                        <div className="text-gray-400 text-sm">休眠</div>
                        <div className="text-xl font-bold text-red-400">{taskResult.hibernated}</div>
                      </div>
                    </>
                  )}
                  {taskResult.success !== undefined && (
                    <>
                      <div>
                        <div className="text-gray-400 text-sm">成功</div>
                        <div className="text-xl font-bold text-green-400">{taskResult.success}</div>
                      </div>
                      <div>
                        <div className="text-gray-400 text-sm">归零</div>
                        <div className="text-xl font-bold text-red-400">{taskResult.reachedZero}</div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}