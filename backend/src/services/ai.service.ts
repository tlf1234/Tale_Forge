import OpenAI from "openai";
import 'dotenv/config';

const openai = new OpenAI({
    baseURL: 'https://api.deepseek.com',
    apiKey: process.env.DEEPSEEK_API_KEY || '<DeepSeek API Key>'
});

export class AIService {
    /**
     * 审查内容
     * @param content 要审查的内容
     * @returns 是否通过审核
     */
    public async reviewContent(content: string): Promise<boolean> {
        try {
            const completion = await openai.chat.completions.create({
                messages: [
                    {
                        role: "system",
                        content: "你是一个专业的内容审核助手。请检查内容是否包含过度的暴力、色情、仇恨言论等违规内容。如果内容安全返回true，否则返回false。"
                    },
                    {
                        role: "user",
                        content: `请审查一下以下的内容：
                                ${content}
                                `
                        //模型过于敏感，可以通过添加案例来提高审核的准确性；或则更换模型
                    }
                ],
                model: "deepseek-chat",
                temperature: 0.3
            });

            const response = completion.choices[0].message.content || 'false';
            console.log('【AI 内容审核】审核结果:', response);
            return response.toLowerCase() === 'true';
        } catch (error) {
            console.error('内容审查失败:', error);
            throw new Error('内容审查服务暂时不可用');
        }
    }

    /**
     * 生成图片
     * @param prompt 图片描述
     * @returns 图片URL
     */
    public async generateImage(prompt: string): Promise<string> {
        try {
            // TODO: 实现AI生图功能
            throw new Error('AI生图功能尚未实现');
        } catch (error) {
            console.error('生成图片失败:', error);
            throw new Error('图片生成服务暂时不可用');
        }
    }

    /**
     * 生成语音
     * @param text 要转换的文本
     * @param voice 声音类型
     * @returns 音频URL
     */
    public async generateVoice(text: string, voice: string = 'default'): Promise<string> {
        try {
            // TODO: 实现AI生声功能
            throw new Error('AI生声功能尚未实现');
        } catch (error) {
            console.error('生成语音失败:', error);
            throw new Error('语音生成服务暂时不可用');
        }
    }
}