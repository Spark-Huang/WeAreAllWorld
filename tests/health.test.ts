/**
 * 基础健康检查测试
 * 用于验证 Jest 配置和生成覆盖率报告
 */

describe('Health Check', () => {
  test('Jest 配置正常', () => {
    expect(true).toBe(true);
  });

  test('Node.js 环境正常', () => {
    expect(process.version).toBeDefined();
    expect(process.version).toMatch(/^v\d+\.\d+\.\d+/);
  });

  test('环境变量加载', () => {
    // 检查是否有基本的环境配置
    expect(process.env.NODE_ENV).toBeDefined();
  });
});

describe('项目配置检查', () => {
  test('package.json 存在', () => {
    const fs = require('fs');
    const path = require('path');
    const packagePath = path.join(__dirname, '..', 'package.json');
    expect(fs.existsSync(packagePath)).toBe(true);
  });

  test('tsconfig.json 存在', () => {
    const fs = require('fs');
    const path = require('path');
    const tsconfigPath = path.join(__dirname, '..', 'tsconfig.json');
    expect(fs.existsSync(tsconfigPath)).toBe(true);
  });

  test('LICENSE 存在', () => {
    const fs = require('fs');
    const path = require('path');
    const licensePath = path.join(__dirname, '..', 'LICENSE');
    expect(fs.existsSync(licensePath)).toBe(true);
  });
});