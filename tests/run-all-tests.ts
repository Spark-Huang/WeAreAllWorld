/**
 * 大同世界 - 完整回归测试套件
 * 运行所有测试并生成报告
 */

import { spawn } from 'child_process';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

interface TestResult {
  name: string;
  passed: number;
  failed: number;
  duration: number;
  status: 'PASS' | 'FAIL';
}

const results: TestResult[] = [];

async function runTest(name: string, command: string, args: string[] = []): Promise<TestResult> {
  console.log(`\n${'='.repeat(50)}`);
  console.log(`🧪 运行: ${name}`);
  console.log('='.repeat(50));
  
  const start = Date.now();
  
  return new Promise((resolve) => {
    const proc = spawn(command, args, { 
      shell: true, 
      stdio: 'inherit',
      cwd: process.cwd()
    });
    
    proc.on('close', (code) => {
      const duration = Date.now() - start;
      const result: TestResult = {
        name,
        passed: 0,
        failed: 0,
        duration,
        status: code === 0 ? 'PASS' : 'FAIL'
      };
      results.push(result);
      resolve(result);
    });
  });
}

async function main() {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║           大同世界 - 完整回归测试套件                         ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  
  // 1. 单元测试
  await runTest('单元测试', 'npx ts-node tests/regression/unit/unit-test.ts');
  
  // 2. 端到端测试
  await runTest('端到端测试', 'npx ts-node tests/regression/e2e/e2e-test.ts');
  
  // 3. 安全测试
  await runTest('安全测试', 'npx ts-node tests/regression/security/security-test.ts');
  
  // 生成报告
  console.log('\n' + '='.repeat(50));
  console.log('📊 测试报告汇总');
  console.log('='.repeat(50));
  
  let totalPassed = 0;
  let totalFailed = 0;
  
  for (const r of results) {
    const status = r.status === 'PASS' ? '✅' : '❌';
    console.log(`${status} ${r.name}: ${r.duration}ms`);
  }
  
  const reportPath = join(process.cwd(), 'tests/reports', `test-report-${Date.now()}.json`);
  mkdirSync(join(process.cwd(), 'tests/reports'), { recursive: true });
  writeFileSync(reportPath, JSON.stringify(results, null, 2));
  console.log(`\n📄 报告已保存: ${reportPath}`);
}

main().catch(console.error);
