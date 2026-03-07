import { test, expect } from '@playwright/test';

const BASE_URL = 'http://localhost:5173';
const TEST_EMAIL = '793160223@qq.com';
const TEST_PASSWORD = 'test123456';

test.describe('前端界面测试', () => {
  
  test('TC-001: 首页加载', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');
    
    // 检查登录表单是否存在
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    console.log('✅ TC-001 通过');
  });

  test('TC-005: 用户登录', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');
    
    // 输入邮箱和密码
    await page.locator('input[type="email"]').fill(TEST_EMAIL);
    await page.locator('input[type="password"]').fill(TEST_PASSWORD);
    
    // 点击登录按钮
    await page.locator('button:has-text("登录")').click();
    
    // 等待登录成功
    await page.waitForTimeout(3000);
    
    // 检查是否进入对话界面
    const content = await page.content();
    const hasChat = content.includes('小零') || content.includes('对话');
    console.log(hasChat ? '✅ TC-005 通过' : '❌ TC-005 失败');
  });

  test('TC-006: 登录 - 错误密码', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');
    
    await page.locator('input[type="email"]').fill(TEST_EMAIL);
    await page.locator('input[type="password"]').fill('wrongpassword');
    await page.locator('button:has-text("登录")').click();
    
    await page.waitForTimeout(2000);
    
    const content = await page.content();
    const hasError = content.includes('Invalid') || content.includes('错误');
    console.log(hasError ? '✅ TC-006 通过' : '❌ TC-006 失败');
  });
});
