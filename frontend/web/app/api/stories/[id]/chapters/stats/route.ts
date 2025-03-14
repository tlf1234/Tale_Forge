import { NextRequest, NextResponse } from 'next/server';

// 后端 API 基础 URL
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

// 获取章节统计信息
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const storyId = params.id;
    
    // 验证故事ID
    if (!storyId) {
      return NextResponse.json({ error: '故事ID不能为空' }, { status: 400 });
    }
    
    // 调用后端API获取章节统计信息
    const response = await fetch(`${API_BASE_URL}/api/stories/${storyId}/chapters/stats`);
    
    // 检查响应状态
    if (!response.ok) {
      let errorMessage = '获取章节统计信息失败';
      try {
        const errorData = await response.json();
        if (errorData && errorData.error) {
          errorMessage = errorData.error;
        }
      } catch (parseError) {
        console.error('解析错误响应失败:', parseError);
      }
      
      return NextResponse.json({ error: errorMessage }, { status: response.status });
    }
    
    // 解析响应数据
    const statsData = await response.json();
    
    // 返回统计信息
    return NextResponse.json(statsData);
  } catch (error) {
    console.error('获取章节统计信息失败:', error);
    return NextResponse.json({ error: '获取章节统计信息失败' }, { status: 500 });
  }
} 