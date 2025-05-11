import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import type { Comment } from '@/types/comment'

// 后端API基础URL
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

// GET /api/stories/[id]/chapters/[chapterId]/comments
// 获取评论列表
export async function GET(
  request: Request,
  { params }: { params: { id: string; chapterId: string } }
) {
  try {
    const { id: storyId, chapterId } = params;
    const { searchParams } = new URL(request.url)
    const page = searchParams.get('page') || '1'
    const limit = searchParams.get('limit') || '20'

    console.log(`【获取评论】调用后端API: ${API_BASE_URL}/api/stories/${storyId}/chapters/${chapterId}/comments?page=${page}&limit=${limit}`);
    
    const response = await fetch(
      `${API_BASE_URL}/api/stories/${storyId}/chapters/${chapterId}/comments?page=${page}&limit=${limit}`, 
      {
        headers: {
          'Content-Type': 'application/json',
        },
        cache: 'no-store'
      }
    );

    if (!response.ok) {
      throw new Error(`获取评论失败: ${response.statusText || response.status}`);
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('获取评论失败:', error);
    return NextResponse.json(
      { error: '加载评论失败' },
      { status: 500 }
    );
  }
}

// POST /api/stories/[id]/chapters/[chapterId]/comments
// 添加评论
export async function POST(
  request: Request,
  { params }: { params: { id: string; chapterId: string } }
) {
  try {
    const { id: storyId, chapterId } = params;
    const body = await request.json();
    console.log('【添加评论】body:', body);
    
    // 获取认证令牌 - 从Authorization header获取
    const authorization = request.headers.get('Authorization');
    const token = authorization?.startsWith('Bearer ') 
      ? authorization.substring(7) 
      : null;
    
    console.log(`【添加评论】调用后端API: ${API_BASE_URL}/api/stories/${storyId}/chapters/${chapterId}/comments`);
    
    if (!token) {
      return NextResponse.json(
        { error: '未认证，请先登录' },
        { status: 401 }
      )
    }
    
    // 用于前端显示的临时用户信息
    let currentUser = null;
    
    // 从token中解析用户ID
    try {
      // 尝试解析JWT
      const parts = token.split('.');
      if (parts.length === 3) {
        const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
        console.log('【添加评论】解析JWT payload:', {
          userId: payload.userId,
          hasAddress: !!payload.address,
          hasEmail: !!payload.email
        });
        
        if (payload.userId) {
          // 尝试获取用户信息 - 使用新的用户资料API
          console.log(`【添加评论】开始获取用户信息, userId: ${payload.userId}`);
          
          // 构建完整的URL，包含协议和主机名
          const userApiUrl = new URL(`/api/users/profile/${payload.userId}`, request.url)
          console.log(`【添加评论】用户信息请求URL: ${userApiUrl.toString()}`);
          
          const userResponse = await fetch(userApiUrl, {
            headers: {
              'Content-Type': 'application/json',
              ...(token ? { Authorization: `Bearer ${token}` } : {})
            }
          });
          
          console.log('【添加评论】用户信息API响应状态:', userResponse.status);
          
          if (userResponse.ok) {
            currentUser = await userResponse.json();
            console.log('【添加评论】成功获取用户信息:', {
              userId: currentUser.id,
              nickname: currentUser.nickname,
              authorName: currentUser.authorName,
              hasAvatar: !!currentUser.avatar
            });
          } else {
            console.warn('【添加评论】获取用户信息失败:', {
              status: userResponse.status,
              statusText: userResponse.statusText
            });
          }
        }
      }
    } catch (e) {
      console.error('【添加评论】解析用户信息失败:', e);
    }
    
    const response = await fetch(
      `${API_BASE_URL}/api/stories/${storyId}/chapters/${chapterId}/comments`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(body),
      }
    );

    if (!response.ok) {
      throw new Error(`添加评论失败: ${response.statusText || response.status}`);
    }

    const data = await response.json();
    
    // 确保返回的数据包含完整的作者信息
    if (data && currentUser) {
      // 获取用户信息
      const user = data.user || {};
      console.log('【添加评论】准备处理作者信息:', {
        dataHasUser: !!data.user,
        dataUserId: data.userId,
        backendUserId: user.id,
        backendNickname: user.nickname,
        backendAuthorName: user.authorName,
        currentUserNickname: currentUser.nickname,
        currentUserAuthorName: currentUser.authorName
      });
      
      // 将用户信息转换为前端User格式
      data.author = {
        id: user.id || data.userId || currentUser.id,
        name: user.nickname || user.authorName || currentUser.nickname || currentUser.authorName || '用户',
        avatar: user.avatar || currentUser.avatar || '/images/avatars/default-avatar.svg'
      };
      
      console.log('【添加评论】最终作者信息:', {
        id: data.author.id,
        name: data.author.name,
        hasAvatar: !!data.author.avatar
      });
    } else {
      console.warn('【添加评论】缺少用户信息:', {
        hasData: !!data,
        hasCurrentUser: !!currentUser,
        dataHasUser: data ? !!data.user : false,
        dataHasUserId: data ? !!data.userId : false
      });
    }
    
    return NextResponse.json(data);
  } catch (error) {
    console.error('添加评论失败:', error);
    return NextResponse.json(
      { error: '发送评论失败' },
      { status: 500 }
    );
  }
}

// DELETE /api/stories/[id]/chapters/[chapterId]/comments/[commentId]
export async function DELETE(
  request: Request,
  { params }: { params: { id: string; chapterId: string } }
) {
  try {
    const { id: storyId, chapterId } = params;
    const url = new URL(request.url)
    const commentId = url.pathname.split('/').pop()
    
    if (!commentId) {
      return NextResponse.json(
        { error: '评论ID不能为空' },
        { status: 400 }
      )
    }

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

    console.log(`【删除评论】调用后端API: ${API_BASE_URL}/api/stories/${storyId}/chapters/${chapterId}/comments/${commentId}`);
    
    const response = await fetch(
      `${API_BASE_URL}/api/stories/${storyId}/chapters/${chapterId}/comments/${commentId}`,
      {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
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