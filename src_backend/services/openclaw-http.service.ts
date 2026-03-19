/**
 * 大同世界 - OpenClaw Gateway HTTP 客户端服务
 * 
 * 使用 OpenAI 兼容的 HTTP API：
 * - 无需 WebSocket 连接
 * - 无需 scope 授权
 * - 更简单可靠
 */

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface ChatCompletionResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: {
    index: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }[];
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export class OpenClawHttpService {
  private readonly gatewayUrl = 'http://localhost:18789/v1/chat/completions';
  private readonly token = '6c3bbbaf22d80d5bd7e987c8824752d58b96f893169ae608';
  private readonly requestTimeout = 60000; // 60 秒超时

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
    // 构建消息数组
    const messages: ChatMessage[] = [];
    
    // 添加系统提示
    if (options?.systemPrompt) {
      messages.push({
        role: 'system',
        content: options.systemPrompt
      });
    }
    
    // 添加历史消息
    if (options?.history) {
      messages.push(...options.history);
    }
    
    // 添加当前消息
    messages.push({
      role: 'user',
      content: message
    });

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.requestTimeout);

      const response = await fetch(this.gatewayUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.token}`,
          'x-openclaw-agent-id': 'main',
          'x-openclaw-session-key': sessionKey
        },
        body: JSON.stringify({
          model: 'openclaw:main',
          messages,
          stream: false
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const data = await response.json() as ChatCompletionResponse;
      
      // 提取响应内容
      const content = data.choices?.[0]?.message?.content;
      if (content) {
        return content;
      }

      return '（无响应）';
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        throw new Error('请求超时');
      }
      console.error('[OpenClaw HTTP] 聊天失败:', err);
      throw err;
    }
  }

  /**
   * 健康检查
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch('http://localhost:18789/health', {
        method: 'GET',
        signal: AbortSignal.timeout(5000)
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * 检查是否已连接（HTTP 总是"已连接"）
   */
  isConnected(): boolean {
    return true;
  }
}

// 单例
let httpService: OpenClawHttpService | null = null;

export function getOpenClawHttpService(): OpenClawHttpService {
  if (!httpService) {
    httpService = new OpenClawHttpService();
  }
  return httpService;
}