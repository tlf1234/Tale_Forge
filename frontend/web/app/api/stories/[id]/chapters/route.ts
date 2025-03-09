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
    const chapterData = await request.json();
    
    // 调用后端 API 创建章节
    const response = await fetch(`${API_BASE_URL}/api/stories/${storyId}/chapters`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(chapterData)
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || '创建章节失败');
    }
    
    const chapter = await response.json();
    return NextResponse.json(chapter);
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
      const error = await response.json();
      throw new Error(error.error || '获取章节列表失败');
    }
    
    const chapters = await response.json();
    return NextResponse.json(chapters);
  } catch (error) {
    console.error('获取章节列表失败:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '获取章节列表失败' },
      { status: 500 }
    );
  }
}
