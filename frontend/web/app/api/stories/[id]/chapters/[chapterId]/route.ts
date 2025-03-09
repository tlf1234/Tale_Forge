import { NextResponse } from 'next/server';
import { Chapter } from '@/types/story';

// 后端 API 基础 URL
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

// 获取章节
export async function GET(
  request: Request,
  { params }: { params: { id: string; chapterId: string } }
) {
  try {
    const { id: storyId, chapterId } = params;
    
    // 调用后端 API 获取章节详情
    const response = await fetch(`${API_BASE_URL}/api/stories/${storyId}/chapters/${chapterId}`);
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || '获取章节失败');
    }
    
    const chapter = await response.json();
    return NextResponse.json(chapter);
  } catch (error) {
    console.error('获取章节失败:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '获取章节失败' },
      { status: 500 }
    );
  }
}

// 更新章节
export async function PUT(
  request: Request,
  { params }: { params: { id: string; chapterId: string } }
) {
  try {
    const { id: storyId, chapterId } = params;
    const updates = await request.json();
    
    // 调用后端 API 更新章节
    const response = await fetch(`${API_BASE_URL}/api/stories/${storyId}/chapters/${chapterId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(updates)
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || '更新章节失败');
    }
    
    const updatedChapter = await response.json();
    return NextResponse.json(updatedChapter);
  } catch (error) {
    console.error('更新章节失败:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '更新章节失败' },
      { status: 500 }
    );
  }
}

// 发布章节
export async function POST(
  request: Request,
  { params }: { params: { id: string; chapterId: string } }
) {
  try {
    const { id: storyId, chapterId } = params;
    const { authorAddress } = await request.json();
    
    if (!authorAddress) {
      return NextResponse.json(
        { error: '缺少作者地址' },
        { status: 400 }
      );
    }
    
    // 调用后端 API 发布章节
    const response = await fetch(`${API_BASE_URL}/api/stories/${storyId}/chapters/${chapterId}/publish`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ authorAddress })
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || '发布章节失败');
    }
    
    const publishedChapter = await response.json();
    return NextResponse.json(publishedChapter);
  } catch (error) {
    console.error('发布章节失败:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '发布章节失败' },
      { status: 500 }
    );
  }
}

// 删除章节
export async function DELETE(
  request: Request,
  { params }: { params: { id: string; chapterId: string } }
) {
  try {
    const { id: storyId, chapterId } = params;
    
    // 调用后端 API 删除章节
    const response = await fetch(`${API_BASE_URL}/api/stories/${storyId}/chapters/${chapterId}`, {
      method: 'DELETE'
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || '删除章节失败');
    }
    
    const result = await response.json();
    return NextResponse.json(result);
  } catch (error) {
    console.error('删除章节失败:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '删除章节失败' },
      { status: 500 }
    );
  }
}
