/**
 * OpenClaw Agent 动态管理服务
 * 
 * 功能：
 * 1. 为每个用户创建独立的 agent
 * 2. 每个 agent 有独立的工作空间
 * 3. 通过修改 OpenClaw 配置文件实现
 */

import { execSync } from 'child_process';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// 共享 Pod 配置
const SHARED_POD = {
  name: 'openclaw-746685cccf-7jhqb',
  namespace: 'we-are-all-world',
  configPath: '/home/node/.openclaw/openclaw.json',
  workspacesBase: '/home/node/.openclaw/workspaces',
};

export interface AgentConfig {
  agentId: string;
  userId: string;
  identity: {
    name: string;
    emoji: string;
  };
  workspace: string;
}

export class OpenClawAgentService {
  private supabase: SupabaseClient;

  constructor(supabaseUrl: string, supabaseKey: string) {
    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  /**
   * 为用户创建或获取 agent
   */
  async getOrCreateAgent(userId: string, aiPartnerName: string): Promise<AgentConfig> {
    const agentId = `user-${userId.substring(0, 8)}`;
    const workspace = `${SHARED_POD.workspacesBase}/${userId.substring(0, 8)}`;

    // 检查是否已存在
    const exists = await this.checkAgentExists(agentId);
    
    if (!exists) {
      console.log(`[Agent] 为用户 ${userId} 创建 agent: ${agentId}`);
      await this.createAgent(agentId, userId, aiPartnerName, workspace);
    }

    return {
      agentId,
      userId,
      identity: {
        name: aiPartnerName,
        emoji: '🤖',
      },
      workspace,
    };
  }

  /**
   * 检查 agent 是否已存在
   */
  private async checkAgentExists(agentId: string): Promise<boolean> {
    try {
      const cmd = `kubectl exec -n ${SHARED_POD.namespace} ${SHARED_POD.name} -c main -- cat ${SHARED_POD.configPath}`;
      const config = execSync(cmd, { encoding: 'utf-8' });
      const json = JSON.parse(config);
      return json.agents?.list?.some((a: any) => a.id === agentId) || false;
    } catch (err) {
      console.error('[Agent] 检查 agent 存在失败:', err);
      return false;
    }
  }

  /**
   * 创建新 agent
   */
  private async createAgent(
    agentId: string,
    userId: string,
    name: string,
    workspace: string
  ): Promise<void> {
    try {
      // 1. 读取当前配置
      const getConfigCmd = `kubectl exec -n ${SHARED_POD.namespace} ${SHARED_POD.name} -c main -- cat ${SHARED_POD.configPath}`;
      const config = execSync(getConfigCmd, { encoding: 'utf-8' });
      const json = JSON.parse(config);

      // 2. 添加新 agent
      const newAgent = {
        id: agentId,
        identity: {
          name: name,
          emoji: '🤖',
        },
        workspace: workspace,
      };

      if (!json.agents) json.agents = {};
      if (!json.agents.list) json.agents.list = [];
      
      // 检查是否已存在
      if (!json.agents.list.some((a: any) => a.id === agentId)) {
        json.agents.list.push(newAgent);
      }

      // 3. 写入新配置
      const newConfig = JSON.stringify(json, null, 2);
      const tempFile = `/tmp/openclaw-config-${Date.now()}.json`;
      require('fs').writeFileSync(tempFile, newConfig);

      const putConfigCmd = `kubectl cp ${tempFile} ${SHARED_POD.namespace}/${SHARED_POD.name}:${SHARED_POD.configPath} -c main`;
      execSync(putConfigCmd);

      // 4. 创建工作空间
      const workspaceCmd = `kubectl exec -n ${SHARED_POD.namespace} ${SHARED_POD.name} -c main -- sh -c "
        mkdir -p ${workspace}
        cd ${workspace}
        cp /home/node/.openclaw/workspace/AGENTS.md . 2>/dev/null || true
        cp /home/node/.openclaw/workspace/SOUL.md . 2>/dev/null || true
        cp /home/node/.openclaw/workspace/TOOLS.md . 2>/dev/null || true
        cp /home/node/.openclaw/workspace/HEARTBEAT.md . 2>/dev/null || true
        mkdir -p .openclaw memory
      "`;
      execSync(workspaceCmd);

      // 5. 重新加载配置（发送 SIGHUP）
      const reloadCmd = `kubectl exec -n ${SHARED_POD.namespace} ${SHARED_POD.name} -c main -- pkill -SIGHUP node || true`;
      execSync(reloadCmd);

      console.log(`[Agent] Agent ${agentId} 创建完成`);

      // 清理临时文件
      require('fs').unlinkSync(tempFile);
    } catch (err) {
      console.error('[Agent] 创建 agent 失败:', err);
      throw err;
    }
  }

  /**
   * 获取用户的 agent ID
   */
  getAgentId(userId: string): string {
    return `user-${userId.substring(0, 8)}`;
  }
}

// 单例
let agentService: OpenClawAgentService | null = null;

export function getOpenClawAgentService(): OpenClawAgentService | null {
  if (!agentService) {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      console.warn('[Agent] Supabase 配置不完整');
      return null;
    }
    
    agentService = new OpenClawAgentService(supabaseUrl, supabaseKey);
  }
  
  return agentService;
}