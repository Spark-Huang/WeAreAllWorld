import { chromium } from 'playwright';

async function testI18n() {
  console.log('🧪 开始国际化功能测试...\n');
  
  // 使用系统 Chromium
  const browser = await chromium.launch({
    headless: true,
    executablePath: '/usr/bin/chromium-browser',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  // 测试1: 英文用户
  console.log('### 测试1: 英文用户（en-US）');
  const enContext = await browser.newContext({
    locale: 'en-US',
    viewport: { width: 1280, height: 720 }
  });
  const enPage = await enContext.newPage();
  
  await enPage.goto('http://localhost:5175', { waitUntil: 'networkidle' });
  await enPage.waitForTimeout(3000);
  
  // 截图
  await enPage.screenshot({ path: 'tests/screenshots/en-home.png', fullPage: true });
  console.log('✅ 截图保存: tests/screenshots/en-home.png');
  
  // 检查页面内容
  const enTitle = await enPage.title();
  console.log(`页面标题: ${enTitle}`);
  
  // 检查品牌名称
  const enBrandName = await enPage.locator('h1').first().textContent();
  console.log(`品牌名称: ${enBrandName}`);
  
  if (enBrandName?.includes('Great Unity World')) {
    console.log('✅ 英文品牌名称正确\n');
  } else if (enBrandName?.includes('天下一家')) {
    console.log('⚠️ 显示中文（可能是 localStorage 缓存）\n');
  } else {
    console.log(`⚠️ 品牌名称: ${enBrandName}\n`);
  }
  
  await enContext.close();
  
  // 测试2: 中文用户
  console.log('### 测试2: 中文用户（zh-CN）');
  const zhContext = await browser.newContext({
    locale: 'zh-CN',
    viewport: { width: 1280, height: 720 }
  });
  const zhPage = await zhContext.newPage();
  
  await zhPage.goto('http://localhost:5175', { waitUntil: 'networkidle' });
  await zhPage.waitForTimeout(3000);
  
  // 截图
  await zhPage.screenshot({ path: 'tests/screenshots/zh-home.png', fullPage: true });
  console.log('✅ 截图保存: tests/screenshots/zh-home.png');
  
  // 检查品牌名称
  const zhBrandName = await zhPage.locator('h1').first().textContent();
  console.log(`品牌名称: ${zhBrandName}`);
  
  if (zhBrandName?.includes('天下一家')) {
    console.log('✅ 中文品牌名称正确\n');
  } else if (zhBrandName?.includes('Great Unity World')) {
    console.log('⚠️ 显示英文（可能是 localStorage 缓存）\n');
  } else {
    console.log(`⚠️ 品牌名称: ${zhBrandName}\n`);
  }
  
  await zhContext.close();
  
  // 测试3: 语言切换
  console.log('### 测试3: 语言切换功能');
  const switchContext = await browser.newContext({
    locale: 'en-US',
    viewport: { width: 1280, height: 720 }
  });
  const switchPage = await switchContext.newPage();
  
  await switchPage.goto('http://localhost:5175', { waitUntil: 'networkidle' });
  await switchPage.waitForTimeout(2000);
  
  // 查找语言切换按钮
  const langButton = switchPage.locator('button:has-text("中文")');
  const isVisible = await langButton.isVisible().catch(() => false);
  
  if (isVisible) {
    console.log('找到语言切换按钮');
    await langButton.click();
    await switchPage.waitForTimeout(2000);
    
    // 截图
    await switchPage.screenshot({ path: 'tests/screenshots/after-switch.png', fullPage: true });
    console.log('✅ 截图保存: tests/screenshots/after-switch.png');
    
    // 检查是否切换到中文
    const afterSwitchName = await switchPage.locator('h1').first().textContent();
    console.log(`切换后品牌名称: ${afterSwitchName}`);
    
    if (afterSwitchName?.includes('天下一家')) {
      console.log('✅ 语言切换成功\n');
    } else {
      console.log('⚠️ 语言切换结果: ' + afterSwitchName + '\n');
    }
  } else {
    console.log('⚠️ 语言切换按钮未找到\n');
  }
  
  await switchContext.close();
  
  await browser.close();
  
  console.log('🎉 测试完成！');
}

testI18n().catch(console.error);
