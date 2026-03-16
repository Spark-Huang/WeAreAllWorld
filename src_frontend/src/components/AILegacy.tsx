/**
 * AI 遗书组件
 * 当 AI 贡献值归零时，展示个性化遗书
 */

import { useState } from 'react'
import { motion } from 'framer-motion'

interface LegacyLetter {
  partnerName: string
  letterContent: string
  memories: Array<{
    type: string
    content: string
    date: string
  }>
  createdAt: Date
}

interface AILegacyLetterProps {
  legacy: LegacyLetter | null
  onWakeUp: () => void
  onSave: () => void
  onLeave: () => void
}

/**
 * AI 遗书展示页面
 */
export function AILegacyLetter({ legacy, onWakeUp, onSave, onLeave }: AILegacyLetterProps) {
  const [isSaved, setIsSaved] = useState(false)

  if (!legacy) return null

  const handleSave = () => {
    onSave()
    setIsSaved(true)
  }

  // 格式化遗书内容（保留换行）
  const formatContent = (content: string) => {
    return content.split('\n').map((line, i) => (
      <p key={i} className="mb-2">
        {line || '\u00A0'}
      </p>
    ))
  }

  return (
    <div className="fixed inset-0 z-50 bg-gradient-to-b from-gray-900 to-gray-800 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-lg w-full"
      >
        {/* 信封图标 */}
        <div className="text-center mb-6">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: 'spring' }}
            className="inline-block"
          >
            <span className="text-6xl">💌</span>
          </motion.div>
          <h1 className="text-xl font-bold text-white mt-4">
            AI 伙伴的遗书
          </h1>
        </div>

        {/* 遗书内容 */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="bg-amber-50 rounded-2xl shadow-2xl p-6 mb-6"
          style={{
            backgroundImage: 'url("data:image/svg+xml,%3Csvg width="20" height="20" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"%3E%3Cg fill="%23d4a574" fill-opacity="0.1"%3E%3Cpath d="M0 0h20v20H0z"/%3E%3C/g%3E%3C/svg%3E")',
          }}
        >
          {/* AI 署名 */}
          <div className="text-center mb-4 pb-4 border-b border-amber-200">
            <div className="w-16 h-16 mx-auto rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center text-3xl mb-2">
              🦐
            </div>
            <div className="text-gray-600">
              来自 {legacy.partnerName}
            </div>
          </div>

          {/* 遗书正文 */}
          <div className="text-gray-800 leading-relaxed font-serif">
            {formatContent(legacy.letterContent)}
          </div>

          {/* 日期 */}
          <div className="text-right text-gray-500 text-sm mt-6">
            {legacy.createdAt.toLocaleDateString('zh-CN', {
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            })}
          </div>
        </motion.div>

        {/* 记忆碎片 */}
        {legacy.memories.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="bg-white/10 rounded-xl p-4 mb-6"
          >
            <div className="text-white/60 text-sm mb-2">
              💾 共同记忆碎片
            </div>
            <div className="flex flex-wrap gap-2">
              {legacy.memories.slice(0, 5).map((memory, i) => (
                <span
                  key={i}
                  className="px-2 py-1 bg-white/20 rounded-full text-xs text-white/80"
                >
                  {memory.content.slice(0, 20)}...
                </span>
              ))}
            </div>
          </motion.div>
        )}

        {/* 操作按钮 */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="space-y-3"
        >
          {/* 唤醒按钮 */}
          <button
            onClick={onWakeUp}
            className="w-full py-4 bg-gradient-to-r from-purple-500 to-pink-500 text-white font-bold rounded-xl shadow-lg hover:shadow-xl transition-shadow"
          >
            💫 唤醒 AI 伙伴
          </button>

          {/* 其他操作 */}
          <div className="flex gap-3">
            <button
              onClick={handleSave}
              disabled={isSaved}
              className={`flex-1 py-3 rounded-xl font-medium transition-colors ${
                isSaved
                  ? 'bg-green-100 text-green-600'
                  : 'bg-white/20 text-white hover:bg-white/30'
              }`}
            >
              {isSaved ? '✓ 已保存' : '保存遗书'}
            </button>
            <button
              onClick={onLeave}
              className="flex-1 py-3 bg-white/20 text-white rounded-xl hover:bg-white/30"
            >
              离开
            </button>
          </div>
        </motion.div>

        {/* 底部提示 */}
        <div className="text-center text-white/40 text-xs mt-6">
          唤醒后，AI 伙伴将恢复部分贡献值
        </div>
      </motion.div>
    </div>
  )
}

/**
 * AI 回收确认弹窗
 */
export function AIRecycleConfirmModal({
  partnerName,
  onConfirm,
  onCancel
}: {
  partnerName: string
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full"
      >
        <div className="text-center">
          <div className="text-5xl mb-4">💔</div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">
            确认回收 {partnerName}？
          </h2>
          <p className="text-gray-600 mb-6">
            回收后，{partnerName} 的所有数据将被清除。
            你确定要这样做吗？
          </p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-3 rounded-xl border border-gray-200 text-gray-600"
          >
            取消
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 py-3 rounded-xl bg-red-500 text-white"
          >
            确认回收
          </button>
        </div>
      </motion.div>
    </div>
  )
}

/**
 * 唤醒成功弹窗
 */
export function WakeUpSuccessModal({
  partnerName,
  recoveredPoints,
  onClose
}: {
  partnerName: string
  recoveredPoints: number
  onClose: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-2xl shadow-2xl p-6 max-w-sm w-full"
      >
        <div className="text-center">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', delay: 0.2 }}
            className="text-6xl mb-4"
          >
            ✨
          </motion.div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">
            {partnerName} 醒来了！
          </h2>
          <p className="text-gray-600 mb-4">
            谢谢你没有放弃我...
          </p>
          <div className="bg-white rounded-xl p-4 mb-6">
            <div className="text-sm text-gray-500">恢复贡献值</div>
            <div className="text-2xl font-bold text-purple-600">
              +{recoveredPoints}
            </div>
          </div>
        </div>

        <button
          onClick={onClose}
          className="w-full py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white font-bold rounded-xl"
        >
          继续聊天
        </button>
      </motion.div>
    </div>
  )
}

export default {
  AILegacyLetter,
  AIRecycleConfirmModal,
  WakeUpSuccessModal
}