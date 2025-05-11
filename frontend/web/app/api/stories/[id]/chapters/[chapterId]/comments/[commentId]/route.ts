import { NextResponse } from 'next/server'

// 后端API基础URL
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

// DELETE /api/stories/[id]/chapters/[chapterId]/comments/[commentId]
export async function DELETE(
  request: Request,
  { params }: { params: { id: string; chapterId: string; commentId: string } }
) {
  try {
    const { id: storyId, chapterId, commentId } = params;
    
    if (!commentId) {
      return NextResponse.json(
        { error: '评论ID不能为空' },
        { status: 400 }
      )
    }

    console.log(`【删除评论】调用后端API: ${API_BASE_URL}/api/stories/${storyId}/chapters/${chapterId}/comments/${commentId}`);
    
    const response = await fetch(
      `${API_BASE_URL}/api/stories/${storyId}/chapters/${chapterId}/comments/${commentId}`,
      {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`删除评论失败: ${response.statusText || response.status}`);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('删除评论失败:', error);
    return NextResponse.json(
      { error: '删除评论失败' },
      { status: 500 }
    );
  }
} 