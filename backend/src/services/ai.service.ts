import OpenAI from "openai";
import 'dotenv/config';
import fs from "node:fs";
import axios from "axios";
import FormData from "form-data";

// 文本内容审核使用 DeepSeek
const deepseekClient = new OpenAI({
    baseURL: 'https://api.deepseek.com',
    apiKey: process.env.DEEPSEEK_API_KEY || '<DeepSeek API Key>'
});
// 图片内容审核使用 qwenOmni
const qwenOmniClient = new OpenAI({
    baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    apiKey: process.env.QWEN_OMNI_API_KEY || '<Qwen Omni API Key>'
});


// 图片生成使用 Stability
const STABILItY_API_KEY = process.env.STABILITY_API_KEY || '<Stability API Key>'

// 语音生成使用 ElevenLabs
const elevenLabsClient = new OpenAI({
    baseURL: process.env.ELEVENLABS_API_URL || 'https://api.elevenlabs.io',
    apiKey: process.env.ELEVENLABS_API_KEY || '<ElevenLabs API Key>'
});

export class AIService {
    /**
     * 审查内容
     * @param content 要审查的内容
     * @returns 是否通过审核
     */
    public async reviewContent(content: string, base64Images?: string[]): Promise<boolean> {
        try {
            const completionContent = await deepseekClient.chat.completions.create({
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

            if (base64Images) {
                // 处理所有图片
                const imagePromises = base64Images.map(async base64Image => {
                    const stream = await qwenOmniClient.chat.completions.create({
                        model: "qwen-omni-turbo",
                        messages: [
                            {
                                "role": "system",
                                "content": [{ "type": "text", "text": "你是一个专业的图片审核助手。请检查内容是否包含过度的色情等违规内容。如果内容安全返回true，否则返回false。" }]
                            },
                            {
                                "role": "user",
                                "content": [{
                                    "type": "image_url",
                                    "image_url": { "url": `data:image/png;base64,${base64Image}` },
                                },
                                { "type": "text", "text": "判断图片中是否有违规内容，如果未违规返回true，否则返回false。" }]
                            }],
                        stream: true,
                        stream_options: {
                            include_usage: true
                        },
                        modalities: ["text"],
                    });

                    let result = '';
                    for await (const chunk of stream) {
                        if (chunk.choices[0]?.delta?.content) {
                            result += chunk.choices[0].delta.content;
                        }
                    }
                    return result;
                });

                // 等待所有图片审核完成
                const imageResults = await Promise.all(imagePromises);
                console.log('【AI 图片审核】审核结果:', imageResults);

                // 检查是否有任何图片审核未通过
                const hasInvalidImage = imageResults.some(result => result.toLowerCase() !== 'true');

                if (hasInvalidImage) {
                    return false;
                }
            }

            const response = completionContent.choices[0].message.content || 'false';
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
    public async generateImage(prompt: string): Promise<{ success: boolean; imageUrl: string }> {
        try {
            console.log('【AI 生成图片】升级提示词');
            const completion = await deepseekClient.chat.completions.create({
                messages: [
                    {
                        role: "system",
                        content: `你是一个提示词专家，请根据用户的输入，生成一个英文的提示词，要求：
                            1. 提示词要和用户输入的描述相同，不能改变描述的含义；
                            2. 提示词要能够准确描述图片的内容；
                            直接返回新的提示词`
                    },
                    {
                        role: "user",
                        content: `请修改以下提示词：
                                ${prompt}
                                `
                    }
                ],
                model: "deepseek-chat",
                temperature: 0.3
            });

            const new_prompt = completion.choices[0].message.content
            console.log('【AI 生成图片】新的提示词:', new_prompt);
            const payload = {
                prompt: new_prompt,
                aspect_ratio: "16:9",
                style_preset: "pixel-art",
                output_format: "png"
            };

            const response = await axios.postForm(
                `https://api.stability.ai/v2beta/stable-image/generate/core`,
                axios.toFormData(payload, new FormData()),
                {
                    validateStatus: undefined,
                    responseType: "arraybuffer",
                    headers: {
                        Authorization: `Bearer ${STABILItY_API_KEY}`,
                        Accept: "image/*"
                    },
                },
            );

            if (response.status === 200) {
                // 将图片数据转换为base64
                const base64Image = Buffer.from(response.data).toString('base64');
                return {
                    success: true,
                    imageUrl: `data:image/png;base64,${base64Image}`
                };
            } else {
                throw new Error(`${response.status}: ${response.data.toString()}`);
            }
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