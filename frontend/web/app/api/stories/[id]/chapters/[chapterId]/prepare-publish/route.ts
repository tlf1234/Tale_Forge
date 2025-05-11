import { NextResponse } from 'next/server';

// 后端 API 基础 URL
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

// 准备发布章节
export async function POST(
  request: Request,
  { params }: { params: { id: string; chapterId: string } }
) {
  try {
    const { id: storyId, chapterId } = params;
    console.log('【准备发布章节】API路由被调用，参数:', { storyId, chapterId });
    
    // 解析请求体
    let requestBody;
    try {
      requestBody = await request.json();
      console.log('【准备发布章节】请求体解析成功:', requestBody);
    } catch (parseError) {
      console.error('【准备发布章节】解析请求体失败:', parseError);
      return NextResponse.json(
        { error: '无效的请求数据' },
        { status: 400 }
      );
    }
    
    const { authorAddress, content } = requestBody;
    console.log('【准备发布章节】提取的字段:', { authorAddress });
    
    if (!authorAddress) {
      console.error('【准备发布章节】缺少作者地址');
      return NextResponse.json(
        { error: '缺少作者地址' },
        { status: 400 }
      );
    }

    if (!content) {
      console.error('【准备发布章节】缺少章节内容');
      return NextResponse.json(
        { error: '缺少章节内容' },
        { status: 400 }
      );
    }
    
    // 调用后端 API 准备发布章节
    console.log('【准备发布章节】准备调用后端API:', `${API_BASE_URL}/api/stories/${storyId}/chapters/${chapterId}/prepare-publish`);
    const response = await fetch(`${API_BASE_URL}/api/stories/${storyId}/chapters/${chapterId}/prepare-publish`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ authorAddress, content })
    });
    console.log('【准备发布章节】后端API响应状态:', response.status);
    
    // 尝试解析响应，处理可能的解析错误
    let responseData;
    try {
      responseData = await response.json();
      console.log('【准备发布章节】后端API响应数据:', responseData);
    } catch (parseError) {
      console.error('【准备发布章节】解析响应数据失败:', parseError);
      return NextResponse.json(
        { error: '服务器响应格式错误' },
        { status: 500 }
      );
    }
    
    if (!response.ok) {
      console.error('【准备发布章节】后端API返回错误:', { status: response.status, error: responseData.error });
      return NextResponse.json(
        { error: responseData.error || '准备发布章节失败' },
        { status: response.status }
      );
    }
    
    console.log('【准备发布章节】准备成功，返回数据');
    return NextResponse.json(responseData);
  } catch (error) {
    console.error('【准备发布章节】准备发布失败:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '准备发布章节失败' },
      { status: 500 }
    );
  }
} 