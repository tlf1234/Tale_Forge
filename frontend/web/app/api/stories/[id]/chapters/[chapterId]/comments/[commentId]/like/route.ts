import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

// 后端API基础URL
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

// POST /api/stories/[id]/chapters/[chapterId]/comments/[commentId]/like
export async function POST(
  request: Request,
  { params }: { params: { id: string; chapterId: string; commentId: string } }
) {
  try {
    const { id: storyId, chapterId, commentId } = params;
    
    // 获取认证令牌 - 从Authorization header获取
    const authorization = request.headers.get('Authorization');
    const token = authorization?.startsWith('Bearer ') 
      ? authorization.substring(7) 
      : null;
    
    if (!token) {
      return NextResponse.json(
        { error: '未认证，请先登录' },
        { status: 401 }
      )
    }
    
    console.log(`【点赞评论】调用后端API: ${API_BASE_URL}/api/stories/${storyId}/chapters/${chapterId}/comments/${commentId}/like`);
    
    const response = await fetch(
      `${API_BASE_URL}/api/stories/${storyId}/chapters/${chapterId}/comments/${commentId}/like`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
      }
    );

    if (!response.ok) {
      throw new Error(`点赞评论失败: ${response.statusText || response.status}`);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('点赞评论失败:', error);
    return NextResponse.json(
      { error: '点赞失败' },
      { status: 500 }
    );
  }
} 