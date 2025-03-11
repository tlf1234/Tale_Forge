import { NextResponse } from 'next/server';
import { Chapter } from '@/types/story';

// 后端 API 基础 URL
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

// 创建新章节，保存到数据库
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id: storyId } = params;
    
    // 解析请求体
    let chapterData;
    try {
      chapterData = await request.json();
    } catch (parseError) {
      console.error('解析请求体失败:', parseError);
      return NextResponse.json(
        { error: '无效的请求数据' },
        { status: 400 }
      );
    }
    
    // 调用后端 API 创建章节
    const response = await fetch(`${API_BASE_URL}/api/stories/${storyId}/chapters`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(chapterData)
    });
    
    // 尝试解析响应，处理可能的解析错误
    let responseData;
    try {
      responseData = await response.json();
    } catch (parseError) {
      console.error('解析响应数据失败:', parseError);
      return NextResponse.json(
        { error: '服务器响应格式错误' },
        { status: 500 }
      );
    }
    
    if (!response.ok) {
      return NextResponse.json(
        { error: responseData.error || '创建章节失败' },
        { status: response.status }
      );
    }
    
    return NextResponse.json(responseData);
  } catch (error) {
    console.error('创建章节失败:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '创建章节失败' },
      { status: 500 }
    );
  }
}

// 获取章节列表
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id: storyId } = params;
    
    // 调用后端 API 获取章节列表
    const response = await fetch(`${API_BASE_URL}/api/stories/${storyId}/chapters`);
    
    if (!response.ok) {
      // 尝试解析错误响应，但不要在解析失败时抛出额外错误
      let errorMessage = '获取章节列表失败';
      try {
        const errorData = await response.json();
        if (errorData && errorData.error) {
          errorMessage = errorData.error;
        }
      } catch (parseError) {
        // JSON解析错误，使用默认错误信息
        console.error('解析错误响应失败:', parseError);
      }
      
      return NextResponse.json(
        { error: errorMessage },
        { status: response.status }
      );
    }
    
    // 尝试解析响应JSON，处理可能的解析错误
    let chapters;
    try {
      // 检查响应内容长度
      const contentLength = response.headers.get('content-length');
      if (contentLength === '0') {
        // 空响应体表示没有找到数据，返回空数组
        console.log('服务器返回了空响应体，可能是没有章节');
        return NextResponse.json([]);
      }
      
      chapters = await response.json();
    } catch (parseError) {
      console.error('解析章节列表数据失败:', parseError);
      
      // 如果响应成功但没有返回有效的JSON，返回空数组
      return NextResponse.json([]);
    }
    
    return NextResponse.json(chapters);
  } catch (error) {
    console.error('获取章节列表失败:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '获取章节列表失败' },
      { status: 500 }
    );
  }
}
