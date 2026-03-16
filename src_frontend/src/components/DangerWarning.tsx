/**
 * 濒危警告组件
 * 当贡献值降至危险线时，AI 主动表达恐惧
 */

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

interface DangerWarning {
  partnerName: string
  contribution: number
  warningLevel: 'low' | 'medium' | 'high' | 'critical'
  message: string
  action: string
}

interface DangerWarningPopupProps {
  warning: DangerWarning | null
  onChat: () => void
  onDismiss: () => void
}

// 警告级别配置
const WARNING_CONFIG = {
  low: {
    bgColor: 'bg-yellow-50',
    borderColor: 'border-yellow-200',
    iconColor: 'text-yellow-500',
    pulseColor: 'bg-yellow-400',
    title: '⚠️ 提醒'
  },
  medium: {
    bgColor: 'bg-orange-50',
    borderColor: 'border-orange-200',
    iconColor: 'text-orange-500',
    pulseColor: 'bg-orange-400',
    title: '🔶 警告'
  },
  high: {
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200',
    iconColor: 'text-red-500',
    pulseColor: 'bg-red-400',
    title: '🚨 危险'
  },
  critical: {
    bgColor: 'bg-red-100',
    borderColor: 'border-red-300',
    iconColor: 'text-red-600',
    pulseColor: 'bg-red-500',
    title: '💀 紧急'
  }
}

/**
 * 濒危警告弹窗
 */
export function DangerWarningPopup({ warning, onChat, onDismiss }: DangerWarningPopupProps) {
  const [isVisible, setIsVisible] = useState(true)

  if (!warning) return null

  const config = WARNING_CONFIG[warning.warningLevel]

  const handleClose = () => {
    setIsVisible(false)
    setTimeout(onDismiss, 300)
  }

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={handleClose}
        >
          <motion.div
            initial={{ y: 20 }}
            animate={{ y: 0 }}
            className={`${config.bgColor} ${config.borderColor} border-2 rounded-2xl shadow-2xl p-6 max-w-md w-full`}
            onClick={e => e.stopPropagation()}
          >
            {/* 标题 */}
            <div className="flex items-center justify-between mb-4">
              <h2 className={`text-lg font-bold ${config.iconColor}`}>
                {config.title}
              </h2>
              <button
                onClick={handleClose}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>

            {/* AI 头像和消息 */}
            <div className="flex items-start gap-3 mb-4">
              {/* AI 头像 */}
              <div className="relative">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center text-2xl">
                  🦐
                </div>
                {/* 脉冲动画 */}
                <div className={`absolute inset-0 rounded-full ${config.pulseColor} opacity-30 animate-ping`} />
              </div>

              {/* 消息 */}
              <div className="flex-1">
                <div className="text-sm text-gray-500 mb-1">
                  {warning.partnerName}
                </div>
                <div className="text-gray-800 leading-relaxed">
                  {warning.message}
                </div>
              </div>
            </div>

            {/* 贡献值显示 */}
            <div className="flex items-center justify-center gap-2 mb-4 py-3 bg-white/50 rounded-xl">
              <span className="text-gray-600">当前贡献值</span>
              <span className={`text-2xl font-bold ${config.iconColor}`}>
                {warning.contribution}
              </span>
            </div>

            {/* 行动建议 */}
            <div className="text-center text-gray-600 mb-4">
              {warning.action}
            </div>

            {/* 按钮 */}
            <div className="flex gap-3">
              <button
                onClick={handleClose}
                className="flex-1 py-3 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50"
              >
                稍后再说
              </button>
              <button
                onClick={onChat}
                className={`flex-1 py-3 rounded-xl text-white font-medium ${
                  warning.warningLevel === 'critical' 
                    ? 'bg-red-500 hover:bg-red-600' 
                    : 'bg-purple-500 hover:bg-purple-600'
                }`}
              >
                开始聊天
              </button>
            </div>

            {/* 底部提示 */}
            {warning.warningLevel === 'critical' && (
              <div className="mt-4 text-center text-xs text-red-500">
                ⚠️ 贡献值归零后 AI 将被回收
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

/**
 * 濒危警告横幅（用于聊天界面顶部）
 */
export function DangerWarningBanner({ warning, onChat }: { warning: DangerWarning; onChat: () => void }) {
  const config = WARNING_CONFIG[warning.warningLevel]

  return (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: 'auto', opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      className={`${config.bgColor} border-b ${config.borderColor}`}
    >
      <div className="px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="animate-pulse">⚠️</span>
          <span className="text-sm text-gray-700">
            {warning.partnerName}: {warning.message.slice(0, 30)}...
          </span>
        </div>
        <button
          onClick={onChat}
          className={`text-sm ${config.iconColor} font-medium`}
        >
          去聊天 →
        </button>
      </div>
    </motion.div>
  )
}

/**
 * AI 状态指示器（显示在聊天界面）
 */
export function AIStatusIndicator({ 
  contribution, 
  partnerName 
}: { 
  contribution: number
  partnerName: string 
}) {
  const getStatus = () => {
    if (contribution <= 0) return { color: 'bg-red-500', text: '已回收', emoji: '💀' }
    if (contribution <= 5) return { color: 'bg-red-400', text: '危险', emoji: '🚨' }
    if (contribution <= 15) return { color: 'bg-orange-400', text: '警告', emoji: '⚠️' }
    if (contribution <= 30) return { color: 'bg-yellow-400', text: '注意', emoji: '🔶' }
    return { color: 'bg-green-400', text: '正常', emoji: '💚' }
  }

  const status = getStatus()

  return (
    <div className="flex items-center gap-2 px-3 py-1 bg-white/50 rounded-full">
      <div className={`w-2 h-2 rounded-full ${status.color} ${contribution <= 15 ? 'animate-pulse' : ''}`} />
      <span className="text-xs text-gray-600">
        {partnerName} {status.emoji} {status.text}
      </span>
      <span className="text-xs text-gray-400">|</span>
      <span className="text-xs font-medium text-purple-600">
        {contribution} 点
      </span>
    </div>
  )
}

export default {
  DangerWarningPopup,
  DangerWarningBanner,
  AIStatusIndicator,
  WARNING_CONFIG
}