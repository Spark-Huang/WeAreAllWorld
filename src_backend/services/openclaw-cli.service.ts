/**
 * 大同世界 - OpenClaw Gateway CLI 服务
 * 
 * 使用 `openclaw agent --local` 命令调用：
 * - 无需 WebSocket 连接
 * - 无需 HTTP API 端点
 * - 简单可靠
 */

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface AgentResponse {
  payloads: Array<{
    text: string;
    mediaUrl: string | null;
  }>;
  meta: {
    durationMs: number;
    agentMeta: {
      sessionId: string;
      provider: string;
      model: string;
      usage: {
        input: number;
        output: number;
        total: number;
      };
    };
    aborted: boolean;
  };
}

export class OpenClawCliService {
  private readonly requestTimeout = 60000; // 60 秒超时
  private readonly openclawPath = '/usr/bin/openclaw';

  /**
   * 发送聊天消息
   */
  async sendChatMessage(
    sessionKey: string,
    message: string,
    options?: {
      systemPrompt?: string;
      history?: ChatMessage[];
    }
  ): Promise<string> {
    try {
      // 构建完整消息（包含历史）
      let fullMessage = message;
      
      // 如果有历史消息，添加上下文
      if (options?.history && options.history.length > 0) {
        const historyText = options.history
          .map(m => `${m.role === 'user' ? '用户' : 'AI'}: ${m.content}`)
          .join('\n');
        fullMessage = `历史对话：\n${historyText}\n\n当前消息：${message}`;
      }
      
      // 如果有系统提示，添加到消息开头
      if (options?.systemPrompt) {
        fullMessage = `[系统提示：${options.systemPrompt}]\n\n${fullMessage}`;
      }

      // 执行 openclaw agent 命令
      const { stdout, stderr } = await execAsync(
        `${this.openclawPath} agent --local --agent weareallworld --message "${this.escapeMessage(fullMessage)}" --json`,
        {
          timeout: this.requestTimeout,
          maxBuffer: 1024 * 1024 * 10 // 10MB buffer
        }
      );

      // 提取 JSON 部分（过滤掉插件日志等非 JSON 输出）
      const jsonMatch = stdout.match(/\{[\s\S]*"payloads"[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('无法从输出中提取 JSON 响应');
      }
      
      // 解析响应
      const response: AgentResponse = JSON.parse(jsonMatch[0]);
      
      // 提取文本内容
      const text = response.payloads?.[0]?.text;
      if (text) {
        return text;
      }

      return '（无响应）';
    } catch (err) {
      if (err instanceof Error) {
        // 检查是否是超时
        if (err.message.includes('timeout')) {
          throw new Error('请求超时');
        }
        console.error('[OpenClaw CLI] 聊天失败:', err.message);
      }
      throw err;
    }
  }

  /**
   * 转义消息中的特殊字符
   */
  private escapeMessage(message: string): string {
    return message
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"')
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\r');
  }

  /**
   * 健康检查
   */
  async healthCheck(): Promise<boolean> {
    try {
      const { stdout } = await execAsync(
        `${this.openclawPath} gateway status`,
        { timeout: 5000 }
      );
      return stdout.includes('running');
    } catch {
      return false;
    }
  }

  /**
   * 检查是否已连接（CLI 总是"已连接"）
   */
  isConnected(): boolean {
    return true;
  }
}

// 单例
let cliService: OpenClawCliService | null = null;

export function getOpenClawCliService(): OpenClawCliService {
  if (!cliService) {
    cliService = new OpenClawCliService();
  }
  return cliService;
}