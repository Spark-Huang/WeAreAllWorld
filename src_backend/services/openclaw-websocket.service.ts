/**
 * 大同世界 - OpenClaw WebSocket 客户端
 * 
 * 功能：
 * 1. 连接到 OpenClaw Gateway
 * 2. 发送消息并接收响应
 * 3. 处理认证和重连
 */

import WebSocket from 'ws';

export interface OpenClawMessage {
  type: 'text' | 'command' | 'ping' | 'pong';
  content: string;
  userId?: string;
  sessionId?: string;
}

export interface OpenClawResponse {
  type: 'text' | 'error' | 'pong';
  content: string;
  done?: boolean;
}

export class OpenClawWebSocketClient {
  private ws: WebSocket | null = null;
  private endpoint: string;
  private token: string;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 3;
  private messageQueue: OpenClawMessage[] = [];
  private responseResolver: ((response: OpenClawResponse) => void) | null = null;
  private responseTimeout: NodeJS.Timeout | null = null;

  constructor(endpoint: string, token: string) {
    this.endpoint = endpoint;
    this.token = token;
  }

  /**
   * 连接到 OpenClaw Gateway
   */
  async connect(): Promise<boolean> {
    return new Promise((resolve) => {
      try {
        const wsUrl = this.endpoint.replace('http://', 'ws://').replace('https://', 'wss://');
        
        this.ws = new WebSocket(wsUrl);

        this.ws.on('open', () => {
          console.log(`[OpenClaw WS] 已连接到 ${wsUrl}，等待 challenge...`);
          this.reconnectAttempts = 0;
          // 不立即 resolve，等待 challenge
        });

        this.ws.on('message', (data: WebSocket.Data) => {
          this.handleMessage(data, resolve);
        });

        this.ws.on('error', (error: Error) => {
          console.error('[OpenClaw WS] 连接错误:', error.message);
          resolve(false);
        });

        this.ws.on('close', () => {
          console.log('[OpenClaw WS] 连接关闭');
          this.handleReconnect();
        });

        // 连接超时
        setTimeout(() => {
          if (this.ws?.readyState !== WebSocket.OPEN) {
            resolve(false);
          }
        }, 10000);
      } catch (error) {
        console.error('[OpenClaw WS] 连接失败:', error);
        resolve(false);
      }
    });
  }

  /**
   * 发送消息并等待响应
   */
  async sendMessage(message: OpenClawMessage, timeout = 30000): Promise<OpenClawResponse> {
    // 如果未连接，先连接
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      const connected = await this.connect();
      if (!connected) {
        return {
          type: 'error',
          content: '无法连接到 OpenClaw Gateway'
        };
      }
    }

    return new Promise((resolve) => {
      this.responseResolver = resolve;
      
      // 设置超时
      this.responseTimeout = setTimeout(() => {
        resolve({
          type: 'error',
          content: '响应超时'
        });
        this.responseResolver = null;
      }, timeout);

      // 发送消息
      const payload = JSON.stringify(message);
      this.ws!.send(payload, (error) => {
        if (error) {
          resolve({
            type: 'error',
            content: `发送失败: ${error.message}`
          });
        }
      });
    });
  }

  /**
   * 处理收到的消息
   */
  private handleMessage(data: WebSocket.Data, connectResolve?: (success: boolean) => void): void {
    try {
      const msg = JSON.parse(data.toString());
      
      // 处理 challenge 事件
      if (msg.type === 'event' && msg.event === 'connect.challenge') {
        console.log('[OpenClaw WS] 收到 challenge，发送响应...');
        const response = {
          type: 'connect.response',
          nonce: msg.payload.nonce,
          token: this.token
        };
        this.ws?.send(JSON.stringify(response));
        return;
      }
      
      // 处理连接成功事件
      if (msg.type === 'event' && msg.event === 'connect.ready') {
        console.log('[OpenClaw WS] 认证成功，连接就绪');
        this.reconnectAttempts = 0;
        this.flushMessageQueue();
        connectResolve?.(true);
        return;
      }
      
      // 处理错误事件
      if (msg.type === 'event' && msg.event === 'connect.error') {
        console.error('[OpenClaw WS] 认证失败:', msg.payload);
        connectResolve?.(false);
        return;
      }
      
      // 处理普通响应
      const response = msg as OpenClawResponse;
      
      // 清除超时
      if (this.responseTimeout) {
        clearTimeout(this.responseTimeout);
        this.responseTimeout = null;
      }

      // 解析响应
      if (this.responseResolver) {
        this.responseResolver(response);
        this.responseResolver = null;
      }
    } catch (error) {
      console.error('[OpenClaw WS] 解析消息失败:', error);
    }
  }

  /**
   * 处理重连
   */
  private async handleReconnect(): Promise<void> {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(`[OpenClaw WS] 尝试重连 (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
      
      await new Promise(resolve => setTimeout(resolve, 1000 * this.reconnectAttempts));
      await this.connect();
    }
  }

  /**
   * 发送队列中的消息
   */
  private flushMessageQueue(): void {
    while (this.messageQueue.length > 0 && this.ws?.readyState === WebSocket.OPEN) {
      const message = this.messageQueue.shift();
      if (message) {
        this.ws.send(JSON.stringify(message));
      }
    }
  }

  /**
   * 关闭连接
   */
  close(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  /**
   * 检查连接状态
   */
  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}

/**
 * OpenClaw 客户端管理器
 * 为每个用户维护独立的 WebSocket 连接
 */
export class OpenClawClientManager {
  private clients: Map<string, OpenClawWebSocketClient> = new Map();
  private defaultToken: string;

  constructor(defaultToken: string) {
    this.defaultToken = defaultToken;
  }

  /**
   * 获取用户的 OpenClaw 客户端
   */
  getClient(userId: string, endpoint: string, token?: string): OpenClawWebSocketClient {
    let client = this.clients.get(userId);
    
    if (!client || !client.isConnected()) {
      client = new OpenClawWebSocketClient(endpoint, token || this.defaultToken);
      this.clients.set(userId, client);
    }
    
    return client;
  }

  /**
   * 发送消息到用户的 OpenClaw
   */
  async sendMessage(
    userId: string,
    endpoint: string,
    message: string,
    token?: string
  ): Promise<OpenClawResponse> {
    const client = this.getClient(userId, endpoint, token);
    
    return client.sendMessage({
      type: 'text',
      content: message,
      userId
    });
  }

  /**
   * 关闭所有连接
   */
  closeAll(): void {
    for (const client of this.clients.values()) {
      client.close();
    }
    this.clients.clear();
  }
}

// 默认客户端管理器实例
let defaultManager: OpenClawClientManager | null = null;

/**
 * 获取默认客户端管理器
 */
export function getOpenClawClientManager(): OpenClawClientManager | null {
  if (!defaultManager) {
    const token = process.env.OPENCLAW_GATEWAY_TOKEN;
    if (!token) {
      console.warn('[OpenClaw] 未配置 OPENCLAW_GATEWAY_TOKEN');
      return null;
    }
    defaultManager = new OpenClawClientManager(token);
  }
  return defaultManager;
}