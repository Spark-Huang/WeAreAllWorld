/**
 * 大同世界 - OpenClaw Gateway 客户端服务
 * 
 * 单实例多租户方案：
 * - 使用主机的 OpenClaw Gateway (localhost:18789)
 * - 通过 sessionKey 区分不同用户
 * - 支持对话、工具调用、记忆等功能
 */

import WebSocket from 'ws';

interface PendingRequest {
  resolve: (value: any) => void;
  reject: (error: Error) => void;
  timeout: NodeJS.Timeout;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export class OpenClawGatewayService {
  private ws: WebSocket | null = null;
  private pendingRequests: Map<string, PendingRequest> = new Map();
  private connected = false;
  private reconnectTimer: NodeJS.Timeout | null = null;
  
  private readonly gatewayUrl = 'ws://localhost:18789';
  private readonly token = '6c3bbbaf22d80d5bd7e987c8824752d58b96f893169ae608';
  private readonly requestTimeout = 60000; // 60 秒超时

  constructor() {
    this.connect();
  }

  /**
   * 连接到 OpenClaw Gateway
   */
  private connect(): void {
    if (this.ws) return;

    try {
      this.ws = new WebSocket(this.gatewayUrl, {
        headers: {
          'origin': 'http://localhost:18789'
        }
      });

      this.ws.on('open', () => {
        console.log('[OpenClaw Gateway] WebSocket 已连接');
      });

      this.ws.on('message', (data) => {
        this.handleMessage(data.toString());
      });

      this.ws.on('close', () => {
        console.log('[OpenClaw Gateway] WebSocket 已断开');
        this.connected = false;
        this.ws = null;
        this.scheduleReconnect();
      });

      this.ws.on('error', (err) => {
        console.error('[OpenClaw Gateway] WebSocket 错误:', err.message);
      });
    } catch (err) {
      console.error('[OpenClaw Gateway] 连接失败:', err);
      this.scheduleReconnect();
    }
  }

  /**
   * 处理收到的消息
   */
  private handleMessage(data: string): void {
    try {
      const msg = JSON.parse(data);

      // 处理 challenge 事件
      if (msg.type === 'event' && msg.event === 'connect.challenge') {
        this.sendConnectRequest();
        return;
      }

      // 处理连接成功
      if (msg.type === 'res' && msg.ok === true && msg.id === 'connect') {
        this.connected = true;
        console.log('[OpenClaw Gateway] 认证成功，已连接');
        return;
      }

      // 处理响应
      if (msg.type === 'res') {
        const pending = this.pendingRequests.get(msg.id);
        if (pending) {
          clearTimeout(pending.timeout);
          this.pendingRequests.delete(msg.id);
          
          if (msg.ok) {
            pending.resolve(msg.payload);
          } else {
            pending.reject(new Error(msg.error?.message || 'Request failed'));
          }
        }
        return;
      }

      // 处理聊天事件（流式响应）
      if (msg.type === 'event' && msg.event === 'chat') {
        const pending = this.pendingRequests.get(`chat-${msg.payload?.runId}`);
        if (pending) {
          // 对于流式事件，我们收集响应
          if (msg.payload?.state === 'final') {
            clearTimeout(pending.timeout);
            this.pendingRequests.delete(`chat-${msg.payload.runId}`);
            pending.resolve(msg.payload);
          } else if (msg.payload?.state === 'error') {
            clearTimeout(pending.timeout);
            this.pendingRequests.delete(`chat-${msg.payload.runId}`);
            pending.reject(new Error(msg.payload?.errorMessage || 'Chat error'));
          }
        }
      }
    } catch (err) {
      console.error('[OpenClaw Gateway] 解析消息失败:', err);
    }
  }

  /**
   * 发送连接请求（响应 challenge）
   */
  private sendConnectRequest(): void {
    if (!this.ws) return;

    const request = {
      type: 'req',
      id: 'connect',
      method: 'connect',
      params: {
        minProtocol: 3,
        maxProtocol: 3,
        client: {
          id: 'webchat-ui',
          version: '1.0',
          platform: 'linux',
          mode: 'backend'
        },
        role: 'operator',
        scopes: ['operator.admin', 'operator.write'],
        auth: {
          token: this.token
        }
      }
    };

    this.ws.send(JSON.stringify(request));
  }

  /**
   * 发送请求
   */
  private async request<T>(method: string, params: any): Promise<T> {
    if (!this.connected || !this.ws) {
      throw new Error('OpenClaw Gateway 未连接');
    }

    const id = `req-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    
    return new Promise<T>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`请求超时: ${method}`));
      }, this.requestTimeout);

      this.pendingRequests.set(id, { resolve, reject, timeout });

      const request = {
        type: 'req',
        id,
        method,
        params
      };

      this.ws!.send(JSON.stringify(request));
    });
  }

  /**
   * 安排重连
   */
  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;
    
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, 5000);
  }

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
      // 使用 chat.send 方法
      const runId = `run-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      
      // 设置响应等待
      const responsePromise = new Promise<any>((resolve, reject) => {
        const timeout = setTimeout(() => {
          this.pendingRequests.delete(`chat-${runId}`);
          reject(new Error('聊天响应超时'));
        }, this.requestTimeout);

        this.pendingRequests.set(`chat-${runId}`, { resolve, reject, timeout });
      });

      // 发送消息
      await this.request('chat.send', {
        sessionKey,
        message,
        idempotencyKey: runId,
        deliver: false // 不直接投递，等待响应
      });

      // 等待响应
      const response = await responsePromise;
      
      // 提取文本内容
      if (response?.message?.content) {
        const content = response.message.content;
        if (Array.isArray(content)) {
          // 提取文本部分
          const textParts = content
            .filter((part: any) => part.type === 'text')
            .map((part: any) => part.text)
            .join('');
          return textParts || '（无文本响应）';
        }
        return typeof content === 'string' ? content : JSON.stringify(content);
      }

      return response?.message?.text || '（无响应）';
    } catch (err) {
      console.error('[OpenClaw Gateway] 聊天失败:', err);
      throw err;
    }
  }

  /**
   * 健康检查
   */
  async healthCheck(): Promise<boolean> {
    try {
      const result = await this.request<any>('health', {});
      return result?.ok === true || result?.status === 'ok';
    } catch {
      return false;
    }
  }

  /**
   * 检查是否已连接
   */
  isConnected(): boolean {
    return this.connected && this.ws?.readyState === WebSocket.OPEN;
  }

  /**
   * 关闭连接
   */
  close(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.connected = false;
  }
}

// 单例
let gatewayService: OpenClawGatewayService | null = null;

export function getOpenClawGatewayService(): OpenClawGatewayService {
  if (!gatewayService) {
    gatewayService = new OpenClawGatewayService();
  }
  return gatewayService;
}