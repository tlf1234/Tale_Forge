import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

// 后端API基础URL
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

// GET /api/stories/[id]/chapters/[chapterId]/comments/[commentId]/replies
export async function GET(
  request: Request,
  { params }: { params: { id: string; chapterId: string; commentId: string } }
) {
  try {
    const { id: storyId, chapterId, commentId } = params;
    const { searchParams } = new URL(request.url)
    
    // 获取查询参数 - 支持page/limit和skip/take两种方式
    const page = searchParams.get('page') || '1'
    const limit = searchParams.get('limit') || '10'
    const userId = searchParams.get('userId') || ''

    console.log(`【获取评论回复】调用后端API: ${API_BASE_URL}/api/stories/${storyId}/chapters/${chapterId}/comments/${commentId}/replies`);
    console.log(`【获取评论回复】请求参数: page=${page}, limit=${limit}, 用户ID=${userId || '未提供'}`);
    
    // 计算skip参数，保留原有的page/limit逻辑，与后端一致
    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 10;
    
    console.log(`【获取评论回复】分页参数: page=${pageNum}, limit=${limitNum}`);
    
    // 直接将page和limit传递给后端API，与后端保持一致
    const response = await fetch(
      `${API_BASE_URL}/api/stories/${storyId}/chapters/${chapterId}/comments/${commentId}/replies?page=${pageNum}&limit=${limitNum}`, 
      {
        headers: {
          'Content-Type': 'application/json',
        },
        cache: 'no-store'
      }
    );

    if (!response.ok) {
      console.error(`【获取评论回复】后端API返回错误: ${response.status} ${response.statusText}`);
      throw new Error(`获取评论回复失败: ${response.statusText || response.status}`);
    }

    const data = await response.json();
    
    // 记录原始数据结构
    console.log(`【获取评论回复】后端返回数据:`, {
      success: !!data,
      total: data.total || 0,
      repliesCount: data.replies?.length || 0,
      hasRepliesArray: Array.isArray(data.replies)
    });
    
    // 确保replies字段存在且为数组
    if (!data.replies || !Array.isArray(data.replies)) {
      console.warn('【获取评论回复】后端返回的replies不是数组，创建空数组');
      data.replies = [];
    }
    
    // 处理响应数据，确保回复中包含正确的用户名称
    if (data.replies && Array.isArray(data.replies)) {
      console.log(`【获取评论回复】处理回复数据, 回复数量: ${data.replies.length}`);
      
      data.replies = data.replies.map((reply: any) => {
        const user = reply.user || {};
        
        // 记录原始用户信息
        console.log(`【获取评论回复】回复 ${reply.id} 的用户信息:`, {
          userId: reply.userId,
          backendUserId: user.id,
          backendNickname: user.nickname,
          backendAuthorName: user.authorName
        });
        
        const processedReply = {
          ...reply,
          author: {
            id: user.id || reply.userId,
            name: user.nickname || user.authorName || '用户' + (user.id?.substring(0, 6) || ''),
            avatar: user.avatar || '/images/avatars/default-avatar.svg'
          },
          // 处理点赞状态
          isLiked: userId ? reply.likes?.some((like: any) => like.userId === userId) : false,
          likes: reply.likes?.length || 0
        };
        
        // 记录处理后的用户信息
        console.log(`【获取评论回复】回复 ${reply.id} 处理后的作者信息:`, {
          id: processedReply.author.id,
          name: processedReply.author.name,
          hasAvatar: !!processedReply.author.avatar,
          isLiked: processedReply.isLiked,
          likeCount: processedReply.likes
        });
        
        return processedReply;
      });
    }
    
    // 返回前端期望的数据结构，根据page和limit计算hasMore
    const result = {
      total: data.total || 0,
      replies: data.replies || [],
      hasMore: data.replies.length === limitNum && (pageNum * limitNum) < (data.total || 0)
    };
    
    console.log(`【获取评论回复】处理完成, 返回数据:`, {
      total: result.total,
      repliesCount: result.replies.length,
      hasMore: result.hasMore,
      page: pageNum,
      limit: limitNum
    });
    
    return NextResponse.json(result);
  } catch (error) {
    console.error('获取评论回复失败:', error);
    return NextResponse.json(
      { error: '加载回复失败', message: error instanceof Error ? error.message : '未知错误' },
      { status: 500 }
    );
  }
}

// POST /api/stories/[id]/chapters/[chapterId]/comments/[commentId]/replies
export async function POST(
  request: Request,
  { params }: { params: { id: string; chapterId: string; commentId: string } }
) {
  try {
    const { id: storyId, chapterId, commentId } = params;
    const body = await request.json();
    
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
    
    // 用于前端显示的临时用户信息
    let currentUser = null;
    
    // 从token中解析用户ID
    try {
      // 尝试解析JWT
      const parts = token.split('.');
      if (parts.length === 3) {
        const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
        console.log('【添加回复】解析JWT payload:', {
          userId: payload.userId,
          hasAddress: !!payload.address,
          hasEmail: !!payload.email
        });
        
        if (payload.userId) {
          // 尝试获取用户信息 - 使用新的用户资料API
          console.log('【添加回复】开始获取用户信息, userId:', payload.userId);
          
          // 构建完整的URL，包含协议和主机名
          const userApiUrl = new URL(`/api/users/profile/${payload.userId}`, request.url);
          console.log(`【添加回复】用户信息请求URL: ${userApiUrl.toString()}`);
          
          const userResponse = await fetch(
            userApiUrl,
            {
              headers: {
                'Content-Type': 'application/json',
                ...(token ? { Authorization: `Bearer ${token}` } : {})
              }
            }
          );
          
          console.log('【添加回复】用户信息API响应状态:', userResponse.status);
          
          if (userResponse.ok) {
            currentUser = await userResponse.json();
            console.log('【添加回复】成功获取用户信息:', {
              userId: currentUser.id,
              nickname: currentUser.nickname,
              authorName: currentUser.authorName,
              hasAvatar: !!currentUser.avatar
            });
          } else {
            console.warn('【添加回复】获取用户信息失败:', {
              status: userResponse.status,
              statusText: userResponse.statusText
            });
          }
        }
      }
    } catch (e) {
      console.error('【添加回复】解析用户信息失败:', e);
    }
    
    console.log(`【添加评论回复】调用后端API: ${API_BASE_URL}/api/stories/${storyId}/chapters/${chapterId}/comments/${commentId}/replies`);
    console.log('【添加评论回复】请求体:', {
      content: body.content,
      replyToId: body.replyToId,
      replyToName: body.replyToName
    });
    
    const response = await fetch(
      `${API_BASE_URL}/api/stories/${storyId}/chapters/${chapterId}/comments/${commentId}/replies`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': authorization || ''
        },
        body: JSON.stringify({
          content: body.content,
          replyToId: body.replyToId,
          replyToName: body.replyToName
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`添加评论回复失败: ${response.statusText || response.status}`);
    }

    const data = await response.json();
    
    // 记录原始回复数据
    console.log('【添加回复】后端返回的回复数据:', {
      replyId: data.id,
      hasUser: !!data.user,
      userId: data.userId,
      content: data.content?.substring(0, 20) + (data.content?.length > 20 ? '...' : '')
    });
    
    // 确保返回的数据包含作者信息
    if (data) {
      // 获取用户信息，优先使用从后端返回的user信息
      const user = data.user || {};
      
      console.log('【添加回复】准备处理作者信息:', {
        dataHasUser: !!data.user,
        dataUserId: data.userId,
        backendUserId: user.id,
        backendNickname: user.nickname,
        backendAuthorName: user.authorName,
        currentUserNickname: currentUser?.nickname,
        currentUserAuthorName: currentUser?.authorName
      });
      
      // 将用户信息转换为前端User格式
      data.author = {
        id: user.id || data.userId || (currentUser ? currentUser.id : ''),
        name: user.nickname || user.authorName || 
              (currentUser ? (currentUser.nickname || currentUser.authorName) : '') || 
              '用户' + (user.id?.substring(0, 6) || ''),
        avatar: user.avatar || (currentUser ? currentUser.avatar : '') || 
                '/images/avatars/default-avatar.svg'
      };
      
      console.log('【添加回复】最终作者信息:', {
        id: data.author.id,
        name: data.author.name,
        hasAvatar: !!data.author.avatar
      });
    } else {
      console.warn('【添加回复】缺少回复数据');
    }
    
    return NextResponse.json(data);
  } catch (error) {
    console.error('添加评论回复失败:', error);
    return NextResponse.json(
      { error: '发送回复失败' },
      { status: 500 }
    );
  }
} 