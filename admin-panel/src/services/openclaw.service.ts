import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const HELM_REPO = 'openclaw';
const HELM_REPO_URL = 'https://serhanekicii.github.io/openclaw-helm';
const DOMAIN = process.env.OPENCLAW_DOMAIN || 'yourdomain.com';

interface CreateInstanceOptions {
  customerId: string;
  subdomain: string;
  plan?: 'basic' | 'pro' | 'enterprise';
}

// 套餐配置
const PLANS = {
  basic: {
    cpu: '500m',
    memory: '1Gi',
    storage: '5Gi'
  },
  pro: {
    cpu: '1000m',
    memory: '2Gi',
    storage: '10Gi'
  },
  enterprise: {
    cpu: '2000m',
    memory: '4Gi',
    storage: '20Gi'
  }
};

export const openclawService = {
  /**
   * 初始化 Helm 仓库
   */
  async initHelmRepo() {
    try {
      await execAsync(`helm repo add ${HELM_REPO} ${HELM_REPO_URL} 2>/dev/null || true`);
      await execAsync('helm repo update');
      return true;
    } catch (error) {
      console.error('Failed to init helm repo:', error);
      return false;
    }
  },

  /**
   * 创建 OpenClaw 实例
   */
  async createInstance(options: CreateInstanceOptions) {
    const { customerId, subdomain, plan = 'basic' } = options;
    const instanceId = `openclaw-${customerId}`;
    const namespace = instanceId;
    const planConfig = PLANS[plan];

    // Helm 安装命令
    const helmCommand = `helm install ${instanceId} ${HELM_REPO}/openclaw \
      --namespace ${namespace} --create-namespace \
      --set app-template.ingress.main.enabled=true \
      --set app-template.ingress.main.hosts[0].host=${subdomain}.${DOMAIN} \
      --set app-template.controllers.main.containers.main.resources.requests.cpu=${planConfig.cpu} \
      --set app-template.controllers.main.containers.main.resources.requests.memory=${planConfig.memory} \
      --set app-template.persistence.data.size=${planConfig.storage}`;

    try {
      const { stdout, stderr } = await execAsync(helmCommand);
      console.log('Helm install output:', stdout);

      return {
        instanceId,
        url: `https://${subdomain}.${DOMAIN}`,
        status: 'creating'
      };
    } catch (error: any) {
      console.error('Failed to create instance:', error.message);
      throw new Error(`创建实例失败: ${error.message}`);
    }
  },

  /**
   * 获取实例状态
   */
  async getInstanceStatus(instanceId: string) {
    try {
      const { stdout } = await execAsync(
        `kubectl get deployment ${instanceId} -n ${instanceId} -o jsonpath='{.status}'`
      );
      return JSON.parse(stdout);
    } catch (error) {
      return { status: 'not_found' };
    }
  },

  /**
   * 删除实例
   */
  async deleteInstance(instanceId: string) {
    const namespace = instanceId;

    try {
      // 删除 Helm release
      await execAsync(`helm uninstall ${instanceId} -n ${namespace}`);

      // 删除 namespace
      await execAsync(`kubectl delete namespace ${namespace}`);

      return true;
    } catch (error: any) {
      console.error('Failed to delete instance:', error.message);
      throw new Error(`删除实例失败: ${error.message}`);
    }
  },

  /**
   * 列出所有实例
   */
  async listInstances() {
    try {
      const { stdout } = await execAsync(
        `helm list -A -o json | jq '[.[] | select(.name | startswith("openclaw-"))]'`
      );
      return JSON.parse(stdout);
    } catch (error) {
      return [];
    }
  }
};

// 初始化时添加 Helm 仓库
openclawService.initHelmRepo();

export default openclawService;