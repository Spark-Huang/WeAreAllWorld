/**
 * 大同世界 - OpenClaw 动态部署服务
 * 
 * 功能：
 * 1. 为每个用户创建独立的 OpenClaw Pod
 * 2. 管理用户专属 OpenClaw 实例的生命周期
 * 3. 提供用户与 OpenClaw 的连接信息
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { execSync } from 'child_process';

export interface OpenClawInstance {
  userId: string;
  podName: string;
  namespace: string;
  status: 'pending' | 'running' | 'stopped' | 'error';
  createdAt: string;
  endpoint: string;
}

export interface ProvisionResult {
  success: boolean;
  instance?: OpenClawInstance;
  error?: string;
}

/**
 * OpenClaw 动态部署服务
 */
export class OpenClawProvisionService {
  private supabase: SupabaseClient;
  private namespace: string;
  private baseImage: string;
  private baseUrl: string;
  
  constructor(
    supabaseUrl: string,
    supabaseKey: string,
    namespace: string = 'we-are-all-world',
    baseImage: string = 'openclaw/openclaw:latest',
    baseUrl: string = 'openclaw.weareall.world'
  ) {
    this.supabase = createClient(supabaseUrl, supabaseKey);
    this.namespace = namespace;
    this.baseImage = baseImage;
    this.baseUrl = baseUrl;
  }
  
  /**
   * 为用户创建 OpenClaw 实例
   */
  async provisionForUser(userId: string): Promise<ProvisionResult> {
    try {
      // 1. 检查用户是否已有实例
      const existing = await this.getInstance(userId);
      if (existing && existing.status === 'running') {
        return {
          success: true,
          instance: existing
        };
      }
      
      // 2. 生成 Pod 名称
      const podName = `openclaw-${userId.substring(0, 8)}`;
      
      // 3. 创建 Kubernetes Deployment
      const deploymentYaml = this.generateDeploymentYaml(userId, podName);
      
      // 4. 应用 Deployment
      await this.applyDeployment(deploymentYaml);
      
      // 5. 等待 Pod 就绪
      const ready = await this.waitForPodReady(podName, 120000); // 2分钟超时
      
      if (!ready) {
        return {
          success: false,
          error: 'Pod 未能及时就绪'
        };
      }
      
      // 6. 记录实例信息到数据库
      const instance: OpenClawInstance = {
        userId,
        podName,
        namespace: this.namespace,
        status: 'running',
        createdAt: new Date().toISOString(),
        endpoint: `https://${podName}.${this.baseUrl}`
      };
      
      await this.saveInstance(instance);
      
      return {
        success: true,
        instance
      };
    } catch (error) {
      console.error('创建 OpenClaw 实例失败:', error);
      return {
        success: false,
        error: String(error)
      };
    }
  }
  
  /**
   * 获取用户的 OpenClaw 实例
   */
  async getInstance(userId: string): Promise<OpenClawInstance | null> {
    const { data, error } = await this.supabase
      .from('openclaw_instances')
      .select('*')
      .eq('user_id', userId)
      .single();
    
    if (error || !data) {
      return null;
    }
    
    // 检查实际 Pod 状态
    const actualStatus = await this.getPodStatus(data.pod_name);
    
    // 转换数据库字段名到 camelCase
    return {
      userId: data.user_id,
      podName: data.pod_name,
      namespace: data.namespace,
      status: actualStatus as 'pending' | 'running' | 'stopped' | 'error',
      createdAt: data.created_at,
      endpoint: data.endpoint
    };
  }
  
  /**
   * 停止用户的 OpenClaw 实例
   */
  async stopInstance(userId: string): Promise<boolean> {
    try {
      const instance = await this.getInstance(userId);
      if (!instance) {
        return false;
      }
      
      // 删除 Deployment
      execSync(`kubectl delete deployment ${instance.podName} -n ${this.namespace} --ignore-not-found=true`, {
        encoding: 'utf-8'
      });
      
      // 更新数据库状态
      await this.supabase
        .from('openclaw_instances')
        .update({ status: 'stopped' })
        .eq('user_id', userId);
      
      return true;
    } catch (error) {
      console.error('停止实例失败:', error);
      return false;
    }
  }
  
  /**
   * 生成 Deployment YAML
   */
  private generateDeploymentYaml(userId: string, podName: string): string {
    return `
apiVersion: apps/v1
kind: Deployment
metadata:
  name: ${podName}
  namespace: ${this.namespace}
  labels:
    app: openclaw
    user-id: ${userId}
spec:
  replicas: 1
  selector:
    matchLabels:
      app: ${podName}
  template:
    metadata:
      labels:
        app: ${podName}
        user-id: ${userId}
    spec:
      imagePullSecrets:
      - name: default-secret
      containers:
      - name: main
        image: ${this.baseImage}
        ports:
        - containerPort: 18789
        env:
        - name: USER_ID
          value: "${userId}"
        - name: OPENCLAW_MODE
          value: "user-dedicated"
        - name: GATEWAY__CONTROLUI__DANGEROUSLYALLOWHOSTHEADERORIGIN
          value: "true"
        - name: GATEWAY__PORT
          value: "18789"
        - name: GATEWAY__AGENT__MODEL
          value: "hwc_maas/deepseek-v3.2"
        - name: GATEWAY__AUTH__MODE
          value: "token"
        - name: GATEWAY__AUTH__TOKEN
          value: "7c7b779db5bdab3cd1d1b33d6421704a6e4b725f254823a2"
        - name: ANTHROPIC_API_KEY
          valueFrom:
            secretKeyRef:
              name: openclaw-api-keys
              key: anthropic-api-key
              optional: true
        - name: OPENAI_API_KEY
          valueFrom:
            secretKeyRef:
              name: openclaw-api-keys
              key: openai-api-key
              optional: true
        - name: LLM_API_KEY
          valueFrom:
            secretKeyRef:
              name: openclaw-api-keys
              key: hwc-maas-api-key
              optional: true
        - name: LLM_API_URL
          value: "https://api.modelarts-maas.com/openai/v1"
        resources:
          requests:
            memory: "256Mi"
            cpu: "100m"
          limits:
            memory: "512Mi"
            cpu: "500m"
---
apiVersion: v1
kind: Service
metadata:
  name: ${podName}
  namespace: ${this.namespace}
spec:
  selector:
    app: ${podName}
  ports:
  - port: 18789
    targetPort: 18789
  type: ClusterIP
`;
  }
  
  /**
   * 应用 Deployment
   */
  private async applyDeployment(yaml: string): Promise<void> {
    // 使用 kubectl apply
    const tempFile = `/tmp/deployment-${Date.now()}.yaml`;
    require('fs').writeFileSync(tempFile, yaml);
    
    try {
      execSync(`kubectl apply -f ${tempFile}`, {
        encoding: 'utf-8'
      });
    } finally {
      require('fs').unlinkSync(tempFile);
    }
  }
  
  /**
   * 等待 Pod 就绪
   */
  private async waitForPodReady(podName: string, timeoutMs: number): Promise<boolean> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeoutMs) {
      const status = await this.getPodStatus(podName);
      if (status === 'running') {
        return true;
      }
      
      // 等待 5 秒后重试
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
    
    return false;
  }
  
  /**
   * 获取 Pod 状态
   */
  private async getPodStatus(podName: string): Promise<string> {
    try {
      const result = execSync(
        `kubectl get pods -n ${this.namespace} -l app=${podName} -o jsonpath='{.items[0].status.phase}'`,
        { encoding: 'utf-8' }
      );
      
      return result === 'Running' ? 'running' : 'pending';
    } catch {
      return 'stopped';
    }
  }
  
  /**
   * 保存实例信息到数据库
   */
  private async saveInstance(instance: OpenClawInstance): Promise<void> {
    await this.supabase
      .from('openclaw_instances')
      .upsert({
        user_id: instance.userId,
        pod_name: instance.podName,
        namespace: instance.namespace,
        status: instance.status,
        endpoint: instance.endpoint,
        created_at: instance.createdAt
      });
  }
}

// 单例
let defaultInstance: OpenClawProvisionService | null = null;

export function getOpenClawProvisionService(): OpenClawProvisionService | null {
  if (!defaultInstance) {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      console.warn('OpenClaw Provision Service: Supabase 配置不完整');
      return null;
    }
    
    defaultInstance = new OpenClawProvisionService(
      supabaseUrl,
      supabaseKey,
      process.env.K8S_NAMESPACE || 'we-are-all-world',
      process.env.OPENCLAW_IMAGE || 'openclaw/openclaw:latest',
      process.env.OPENCLAW_BASE_URL || 'openclaw.weareall.world'
    );
  }
  
  return defaultInstance;
}