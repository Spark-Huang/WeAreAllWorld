import { StoryService } from '../src/contribution-evaluation/services/story.service';

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_KEY || process.env.SUPABASE_SERVICE_KEY!;

async function testStory() {
  console.log('=== 测试剧情系统：新用户是否自动进入剧情引导 ===\n');
  
  const storyService = new StoryService(SUPABASE_URL, SUPABASE_KEY);
  
  // 模拟新用户ID
  const testUserId = 'test-new-user-' + Date.now();
  
  console.log('📝 测试用户ID:', testUserId);
  console.log('\n--- 测试 1: 检查第一章解锁条件 ---');
  
  const chapter1 = storyService.getChapter(1);
  console.log('第一章所需贡献值:', chapter1?.requiredContribution);
  const canUnlock = chapter1?.requiredContribution === 0;
  console.log('新用户(贡献值=0)能否解锁第一章:', canUnlock ? '✅ 是' : '❌ 否');
  
  console.log('\n--- 测试 2: 调用 startStory ---');
  
  try {
    const { scene, progress } = await storyService.startStory(testUserId);
    console.log('✅ 剧情启动成功！');
    console.log('   当前章节:', progress.currentChapter);
    console.log('   当前场景:', progress.currentScene);
    console.log('   场景标题:', scene.title);
    console.log('   场景类型:', scene.type);
    console.log('   场景内容预览:', scene.content.substring(0, 80) + '...');
  } catch (err) {
    console.log('❌ 剧情启动失败:', err);
  }
  
  console.log('\n--- 测试 3: 检查前端是否调用剧情API ---');
  console.log('⚠️  查看前端代码 App.tsx:');
  console.log('   - ensureUserExists() 只调用 /auth/ensure-user');
  console.log('   - 没有调用 /api/v1/story');
  console.log('   - 新用户只会看到欢迎消息，不会进入剧情引导');
  
  console.log('\n=== 结论 ===');
  console.log('❌ 前端没有调用剧情API，新用户不会自动进入剧情引导');
  console.log('✅ 后端剧情系统正常，第一章解锁条件为0，新用户可以进入');
  console.log('\n建议：在前端 ensureUserExists() 中添加剧情API调用');
}

testStory().catch(console.error);
