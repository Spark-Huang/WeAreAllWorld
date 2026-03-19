/**
 * 大同世界 - 共享 OpenClaw Pod 服务
 * 
 * 通过 WebSocket 连接到 K8s 中的共享 OpenClaw Pod
 */

import WebSocket from 'ws';

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface WsResponse {
  type: 'message' | 'error' | 'typing' | 'done';
  content?: string;
  sessionId?: string;
}

// 共享 Pod 配置
const SHARED_POD = {
  name: 'openclaw-746685cccf-7jhqb',
  ip: '172.31.0.208',
  port: 18789,
  wsUrl: 'ws://172.31.0.208:18789',
  httpUrl: 'http://172.31.0.208:18789'
};

export class SharedOpenClawService {
  private readonly requestTimeout = 60000; // 60 秒超时

  /**
   * 发送聊天消息（通过 HTTP API）
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

      // 使用 HTTP API（如果支持）
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.requestTimeout);

      try {
        const response = await fetch(`${SHARED_POD.httpUrl}/v1/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
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

        if (response.ok) {
          const data = await response.json() as { choices: Array<{ message: { content: string } }> };
          return data.choices?.[0]?.message?.content || '（无响应）';
        }
      } catch (httpError) {
        console.log('[共享Pod] HTTP API 不可用，使用 WebSocket');
      }

      // HTTP 不可用，使用 WebSocket
      return await this.sendViaWebSocket(sessionKey, messages);
    } catch (err) {
      console.error('[共享Pod] 聊天失败:', err);
      throw err;
    }
  }

  /**
   * 通过 WebSocket 发送消息
   */
  private async sendViaWebSocket(sessionKey: string, messages: ChatMessage[]): Promise<string> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(SHARED_POD.wsUrl);
      let response = '';
      let timeout: NodeJS.Timeout;

      ws.on('open', () => {
        // 发送连接请求
        ws.send(JSON.stringify({
          type: 'connect',
          sessionKey,
          agentId: 'main'
        }));

        // 设置超时
        timeout = setTimeout(() => {
          ws.close();
          reject(new Error('WebSocket 连接超时'));
        }, this.requestTimeout);
      });

      ws.on('message', (data: Buffer) => {
        try {
          const msg: WsResponse = JSON.parse(data.toString());
          
          if (msg.type === 'message' && msg.content) {
            response += msg.content;
          } else if (msg.type === 'done') {
            clearTimeout(timeout);
            ws.close();
            resolve(response || '（无响应）');
          } else if (msg.type === 'error') {
            clearTimeout(timeout);
            ws.close();
            reject(new Error(msg.content || '未知错误'));
          }
        } catch (e) {
          // 忽略解析错误
        }
      });

      ws.on('error', (err) => {
        clearTimeout(timeout);
        reject(err);
      });

      ws.on('close', () => {
        clearTimeout(timeout);
        if (!response) {
          reject(new Error('连接已关闭'));
        }
      });

      // 连接成功后发送消息
      ws.once('open', () => {
        setTimeout(() => {
          ws.send(JSON.stringify({
            type: 'chat.send',
            sessionKey,
            message: messages[messages.length - 1].content,
            systemPrompt: messages.find(m => m.role === 'system')?.content
          }));
        }, 1000);
      });
    });
  }

  /**
   * 健康检查
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${SHARED_POD.httpUrl}/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000)
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * 获取共享 Pod 信息
   */
  getPodInfo() {
    return { ...SHARED_POD };
  }
}

// 单例
let sharedService: SharedOpenClawService | null = null;

export function getSharedOpenClawService(): SharedOpenClawService {
  if (!sharedService) {
    sharedService = new SharedOpenClawService();
  }
  return sharedService;
}