/**
 * 天下一家（WeAreAll.World）- LLM 贡献值质量判定服务
 * 
 * 使用大模型智能判断对话质量，替代简单的关键词匹配
 * 
 * 质量等级：
 * - special_memory (+8): 特殊回忆（童年、重要人生事件）
 * - deep_thought (+5): 深度思考（观点、看法、价值观）
 * - experience (+4): 分享经历（今天发生的事）
 * - emotion (+3): 情感表达（开心、难过、担心）
 * - daily (+2): 日常对话
 * - greeting (+1): 日常问候
 */

import { QualityResult } from './quality-judge.service';

// LLM API 配置
const LLM_API_URL = process.env.LLM_BASE_URL || 'https://api.modelarts-maas.com/v2';
const LLM_API_KEY = process.env.LLM_API_KEY || 'yHWayr9vys-0Rr2VepqIpQQJPgZY80BDhAmaPQ_EFQ5MCi9j8k7aduptjL7yusJ42vJeZgzV516EY0SjEW-hOQ';
const LLM_MODEL = process.env.LLM_MODEL || 'glm-5';

/**
 * LLM 质量判定响应格式
 */
interface LLMQualityResponse {
  qualityType: string;
  points: number;
  reason: string;
  emotion: string;
  keyInfo: string | null;
  shouldCreateMemory: boolean;
  memoryContent: string | null;
  dataRarity: string;
  confidence: number;
}

/**
 * LLM 贡献值质量判定服务
 */
export class LLMQualityJudgeService {
  
  /**
   * 使用 LLM 判定对话质量
   * @param message 用户消息
   * @param conversationHistory 对话历史（可选）
   * @returns 质量判定结果
   */
  async calculateQuality(message: string, conversationHistory?: string[]): Promise<QualityResult> {
    try {
      const prompt = this.buildPrompt(message, conversationHistory);
      const llmResult = await this.callLLM(prompt);
      
      return {
        qualityType: llmResult.qualityType,
        points: llmResult.points,
        reason: llmResult.reason,
        emotionDetected: llmResult.emotion,
        keyInfo: llmResult.keyInfo,
        shouldCreateMemory: llmResult.shouldCreateMemory,
        memoryContent: llmResult.memoryContent,
        dataRarity: llmResult.dataRarity
      };
    } catch (error) {
      console.error('LLM 质量判定失败，使用默认规则:', error);
      // 如果 LLM 失败，返回默认的日常对话结果
      return {
        qualityType: 'daily',
        points: 2,
        reason: '日常对话',
        emotionDetected: 'neutral',
        keyInfo: null,
        shouldCreateMemory: false,
        memoryContent: null,
        dataRarity: '活跃数据'
      };
    }
  }
  
  /**
   * 构建 LLM 提示词
   */
  private buildPrompt(message: string, conversationHistory?: string[]): string {
    let context = '';
    if (conversationHistory && conversationHistory.length > 0) {
      context = `\n\n对话历史：
${conversationHistory.slice(-5).join('\n')}`;
    }
    
    return `你是一个对话质量评估专家。请分析以下用户消息的质量，并按照指定格式返回结果。

用户消息：
"${message}"${context}

请从以下维度评估这条消息：

1. **质量类型** (qualityType)：
   - special_memory: 特殊回忆（童年、重要人生事件、深刻记忆）→ +8点
   - deep_thought: 深度思考（观点、看法、价值观、人生感悟）→ +5点
   - experience: 分享经历（今天发生的事、工作学习、日常活动）→ +4点
   - emotion: 情感表达（开心、难过、担心、焦虑等情绪）→ +3点
   - daily: 日常对话（有实质内容的交流）→ +2点
   - greeting: 日常问候（简单的打招呼）→ +1点

2. **情感检测** (emotion)：
   - happy: 开心、高兴、兴奋、幸福
   - sad: 难过、伤心、悲伤、失望
   - worried: 担心、焦虑、紧张、压力
   - tired: 累、疲惫、困倦
   - angry: 生气、愤怒、烦躁
   - touched: 感动、温暖、感激
   - neutral: 中性、无明显情绪

3. **是否创建记忆** (shouldCreateMemory)：
   - special_memory 和 deep_thought 类型应创建记忆
   - experience 类型且内容丰富（超过30字）应创建记忆
   - 其他类型不创建记忆

4. **数据稀缺度** (dataRarity)：
   - special_memory: [绝版·专属生命记忆]
   - deep_thought: [典藏级·人类独有思维特征]
   - experience: [珍贵·人类行为样本]
   - emotion: [稀有·真实情感图谱]
   - daily: 活跃数据
   - greeting: 普通数据

请严格按照以下 JSON 格式返回结果（不要添加任何其他文字）：

{
  "qualityType": "类型代码",
  "points": 点数,
  "reason": "简短的判定理由",
  "emotion": "情感类型",
  "keyInfo": "提取的关键信息（可选）",
  "shouldCreateMemory": true/false,
  "memoryContent": "记忆内容（如果需要创建记忆）",
  "dataRarity": "数据稀缺度",
  "confidence": 0.0-1.0的置信度
}`;
  }
  
  /**
   * 调用 LLM API
   */
  private async callLLM(prompt: string): Promise<LLMQualityResponse> {
    const apiUrl = `${LLM_API_URL}/chat/completions`;
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${LLM_API_KEY}`
      },
      body: JSON.stringify({
        model: LLM_MODEL,
        messages: [
          {
            role: 'system',
            content: '你是一个对话质量评估专家。请严格按照JSON格式返回结果，不要添加任何其他文字。'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.3,  // 较低的温度以获得更一致的结果
        max_tokens: 500
      })
    });
    
    if (!response.ok) {
      throw new Error(`LLM API 请求失败: ${response.status}`);
    }
    
    const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
    const content = data.choices?.[0]?.message?.content;
    
    if (!content) {
      throw new Error('LLM 返回内容为空');
    }
    
    // 解析 JSON 响应
    return this.parseLLMResponse(content);
  }
  
  /**
   * 解析 LLM 响应
   */
  private parseLLMResponse(content: string): LLMQualityResponse {
    try {
      // 尝试提取 JSON 部分
      let jsonStr = content.trim();
      
      // 如果响应包含 markdown 代码块，提取其中的 JSON
      const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        jsonStr = jsonMatch[1].trim();
      }
      
      // 移除可能的前后文字
      const jsonStart = jsonStr.indexOf('{');
      const jsonEnd = jsonStr.lastIndexOf('}');
      if (jsonStart !== -1 && jsonEnd !== -1) {
        jsonStr = jsonStr.substring(jsonStart, jsonEnd + 1);
      }
      
      const result = JSON.parse(jsonStr);
      
      // 验证并规范化结果
      return this.validateAndNormalize(result);
    } catch (error) {
      console.error('解析 LLM 响应失败:', error, '原始内容:', content);
      throw new Error('无法解析 LLM 响应');
    }
  }
  
  /**
   * 验证并规范化结果
   */
  private validateAndNormalize(result: any): LLMQualityResponse {
    const validTypes = ['special_memory', 'deep_thought', 'experience', 'emotion', 'daily', 'greeting'];
    const validEmotions = ['happy', 'sad', 'worried', 'tired', 'angry', 'touched', 'neutral'];
    
    const typePoints: Record<string, number> = {
      'special_memory': 8,
      'deep_thought': 5,
      'experience': 4,
      'emotion': 3,
      'daily': 2,
      'greeting': 1
    };
    
    const typeRarity: Record<string, string> = {
      'special_memory': '[绝版·专属生命记忆]',
      'deep_thought': '[典藏级·人类独有思维特征]',
      'experience': '[珍贵·人类行为样本]',
      'emotion': '[稀有·真实情感图谱]',
      'daily': '活跃数据',
      'greeting': '普通数据'
    };
    
    // 规范化质量类型
    let qualityType = result.qualityType?.toLowerCase() || 'daily';
    if (!validTypes.includes(qualityType)) {
      qualityType = 'daily';
    }
    
    // 规范化情感
    let emotion = result.emotion?.toLowerCase() || 'neutral';
    if (!validEmotions.includes(emotion)) {
      emotion = 'neutral';
    }
    
    return {
      qualityType,
      points: typePoints[qualityType] || 2,
      reason: result.reason || '日常对话',
      emotion,
      keyInfo: result.keyInfo || null,
      shouldCreateMemory: Boolean(result.shouldCreateMemory),
      memoryContent: result.memoryContent || null,
      dataRarity: typeRarity[qualityType] || '活跃数据',
      confidence: Math.min(1, Math.max(0, result.confidence || 0.8))
    };
  }
  
  /**
   * 批量判定质量（用于处理历史数据）
   */
  async batchCalculateQuality(messages: string[]): Promise<QualityResult[]> {
    const results: QualityResult[] = [];
    
    for (const message of messages) {
      const result = await this.calculateQuality(message);
      results.push(result);
      
      // 避免请求过快
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    return results;
  }
}

// 导出单例
export const llmQualityJudgeService = new LLMQualityJudgeService();