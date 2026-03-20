/**
 * 大同世界 - OpenClaw Port-Forward 管理服务
 * 
 * 功能：
 * 1. 为每个用户的 OpenClaw Pod 创建 kubectl port-forward
 * 2. 管理端口分配
 * 3. 提供本地访问地址
 */

import { spawn, ChildProcess } from 'child_process';

interface PortForwardEntry {
  podName: string;
  namespace: string;
  localPort: number;
  process: ChildProcess;
  createdAt: Date;
  lastUsed: Date;
}

export class OpenClawPortForwardService {
  private portForwards: Map<string, PortForwardEntry> = new Map();
  private basePort = 28000; // 起始端口
  private maxPort = 29000;  // 最大端口
  private currentPort = 28000;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    // 每 5 分钟清理不活跃的 port-forward
    this.cleanupInterval = setInterval(() => this.cleanup(), 5 * 60 * 1000);
  }

  /**
   * 获取下一个可用端口
   */
  private getNextPort(): number {
    const usedPorts = new Set(Array.from(this.portForwards.values()).map(e => e.localPort));
    
    while (this.currentPort < this.maxPort) {
      if (!usedPorts.has(this.currentPort)) {
        return this.currentPort++;
      }
      this.currentPort++;
    }
    
    // 如果端口用完，从头开始找
    this.currentPort = this.basePort;
    return this.getNextPort();
  }

  /**
   * 为用户创建或获取 port-forward
   */
  async getOrCreate(userId: string, podName: string, namespace: string = 'we-are-all-world'): Promise<string | null> {
    const existing = this.portForwards.get(userId);
    
    if (existing) {
      // 检查进程是否还在运行
      if (existing.process.exitCode === null) {
        existing.lastUsed = new Date();
        return `http://localhost:${existing.localPort}`;
      }
      // 进程已退出，重新创建
      this.portForwards.delete(userId);
    }

    const localPort = this.getNextPort();
    
    console.log(`[PortForward] 为用户 ${userId} 创建 port-forward: ${podName} -> localhost:${localPort}`);

    try {
      const proc = spawn('kubectl', [
        'port-forward',
        `-n`, namespace,
        `deploy/${podName}`,
        `${localPort}:18789`
      ], {
        stdio: ['ignore', 'pipe', 'pipe']
      });

      proc.stdout?.on('data', (data) => {
        // console.log(`[PortForward ${localPort}] stdout:`, data.toString());
      });

      proc.stderr?.on('data', (data) => {
        console.error(`[PortForward ${localPort}] stderr:`, data.toString());
      });

      proc.on('exit', (code) => {
        console.log(`[PortForward ${localPort}] 进程退出，代码: ${code}`);
        this.portForwards.delete(userId);
      });

      // 等待 port-forward 启动
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          // 超时也尝试继续，可能已经启动成功
          console.log(`[PortForward ${localPort}] 启动检测超时，尝试连接...`);
          resolve();
        }, 5000);

        proc.stderr?.on('data', (data: Buffer) => {
          const msg = data.toString();
          if (msg.includes('Forwarding from') || msg.includes('waiting for connection')) {
            clearTimeout(timeout);
            resolve();
          }
        });

        proc.on('error', (err) => {
          clearTimeout(timeout);
          reject(err);
        });
      });

      // 等待一小段时间让 port-forward 完全启动
      await new Promise(r => setTimeout(r, 500));

      // 验证连接是否正常
      const testHealth = await fetch(`http://localhost:${localPort}/health`, {
        signal: AbortSignal.timeout(3000)
      }).catch(() => null);

      if (!testHealth || !testHealth.ok) {
        throw new Error('Port-forward 连接验证失败');
      }

      this.portForwards.set(userId, {
        podName,
        namespace,
        localPort,
        process: proc,
        createdAt: new Date(),
        lastUsed: new Date()
      });

      return `http://localhost:${localPort}`;
    } catch (err) {
      console.error(`[PortForward] 创建失败:`, (err as Error).message);
      return null;
    }
  }

  /**
   * 获取用户的本地访问地址
   */
  getLocalEndpoint(userId: string): string | null {
    const entry = this.portForwards.get(userId);
    if (entry && entry.process.exitCode === null) {
      entry.lastUsed = new Date();
      return `http://localhost:${entry.localPort}`;
    }
    return null;
  }

  /**
   * 关闭用户的 port-forward
   */
  close(userId: string): void {
    const entry = this.portForwards.get(userId);
    if (entry) {
      entry.process.kill();
      this.portForwards.delete(userId);
    }
  }

  /**
   * 清理不活跃的 port-forward
   */
  private cleanup(): void {
    const now = new Date();
    const maxInactive = 30 * 60 * 1000; // 30 分钟不活跃

    for (const [userId, entry] of this.portForwards) {
      if (now.getTime() - entry.lastUsed.getTime() > maxInactive) {
        console.log(`[PortForward] 清理不活跃的连接: ${userId}`);
        entry.process.kill();
        this.portForwards.delete(userId);
      }
    }
  }

  /**
   * 关闭所有 port-forward
   */
  closeAll(): void {
    for (const [userId, entry] of this.portForwards) {
      entry.process.kill();
    }
    this.portForwards.clear();
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
  }
}

// 单例
let instance: OpenClawPortForwardService | null = null;

export function getPortForwardService(): OpenClawPortForwardService {
  if (!instance) {
    instance = new OpenClawPortForwardService();
  }
  return instance;
}