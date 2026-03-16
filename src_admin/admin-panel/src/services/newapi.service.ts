import axios from 'axios';

const NEW_API_BASE_URL = process.env.NEW_API_BASE_URL || 'http://localhost:3001';
const NEW_API_ADMIN_TOKEN = process.env.NEW_API_ADMIN_TOKEN || '';

const api = axios.create({
  baseURL: NEW_API_BASE_URL,
  headers: {
    'Authorization': `Bearer ${NEW_API_ADMIN_TOKEN}`,
    'Content-Type': 'application/json'
  }
});

export const newApiService = {
  /**
   * 创建用户
   */
  async createUser(email: string, name?: string) {
    const username = email.split('@')[0];
    const response = await api.post('/api/user/', {
      username,
      password: `Temp@${Date.now()}`, // 临时密码，用户首次登录后修改
      display_name: name || username
    });

    return {
      id: response.data.data.id,
      token: response.data.data.token,
      quota: response.data.data.quota || 100000
    };
  },

  /**
   * 查询用户额度
   */
  async getQuota(userId: number) {
    const response = await api.get(`/api/user/${userId}`);
    return {
      quota: response.data.data.quota,
      usedQuota: response.data.data.used_quota,
      remainingQuota: response.data.data.quota - response.data.data.used_quota
    };
  },

  /**
   * 生成充值链接（SSO）
   */
  async generateRechargeUrl(userId: number, email: string, amount: number) {
    // New API 内置充值页面
    // 如果配置了 SSO，可以直接跳转
    const baseUrl = NEW_API_BASE_URL;
    return `${baseUrl}/topup?user_id=${userId}&amount=${amount}`;
  },

  /**
   * 查询消费记录
   */
  async getUsage(userId: number) {
    const response = await api.get(`/api/log/?user_id=${userId}`);
    return response.data.data || [];
  },

  /**
   * 充值额度
   */
  async recharge(userId: number, amount: number) {
    const response = await api.post('/api/topup/', {
      user_id: userId,
      amount,
      top_up_code: 'admin_recharge'
    });
    return response.data;
  }
};

export default newApiService;