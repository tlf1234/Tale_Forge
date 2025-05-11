import { useState, useCallback, useEffect, useContext } from 'react'
import type { Comment } from '@/types/comment'
import { useAuth } from './useAuth'
import { useLoginModal } from '@/context/LoginModalContext'
import { toast } from 'react-hot-toast'

const COMMENTS_PER_PAGE = 20

export function useComments(storyId: string, chapterId: string) {
  console.log('【useComments】初始化，storyId:', storyId, 'chapterId:', chapterId)
  const [comments, setComments] = useState<Comment[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const [hasMore, setHasMore] = useState(true)
  const [page, setPage] = useState(1)
  const [totalComments, setTotalComments] = useState(0)
  const { isAuthenticated, token } = useAuth()

  // 获取登录弹窗上下文
  const { openLoginModal } = useLoginModal()

  // 加载评论列表
  const loadComments = useCallback(async (pageNum: number = 1) => {
    console.log(`【loadComments】开始加载评论, 页码: ${pageNum}, 每页数量: ${COMMENTS_PER_PAGE}`)
    try {
      setLoading(true)
      setError(null)
      
      const apiUrl = `/api/stories/${storyId}/chapters/${chapterId}/comments?page=${pageNum}&limit=${COMMENTS_PER_PAGE}`
      console.log('【loadComments】API请求URL:', apiUrl)
      
      const response = await fetch(apiUrl)
      
      console.log('【loadComments】API响应状态:', response.status, response.statusText)
      
      if (!response.ok) {
        throw new Error(response.statusText || '加载评论失败')
      }

      const data = await response.json()
      console.log(`【loadComments】获取到评论数据:`, data)
      
      // 确保服务器返回了评论数组和总数
      if (!data.comments) {
        console.error('【loadComments】服务器返回格式不正确:', data)
        // 不抛出错误，而是使用空数组
        setComments(pageNum === 1 ? [] : prev => prev)
        setTotalComments(0)
        setHasMore(false)
        setPage(pageNum)
        return
      }

      const fetchedComments = Array.isArray(data.comments) ? data.comments : []
      const total = data.total || fetchedComments.length
      
      console.log(`【loadComments】评论数量: ${fetchedComments.length}, 总数: ${total}`)
      
      // 验证并修复评论数据，确保author字段存在
      const validatedComments = fetchedComments.map((comment: any) => {
        // 确保comment是有效对象
        if (!comment) return null;
        
        // 确保作者信息存在
        const safeAuthor = comment.author || { 
          id: '0', 
          name: '未知用户', 
          avatar: '/images/avatars/default-avatar.svg' 
        };
        
        // 确保回复数组存在且每个回复都有作者信息
        const safeReplies = Array.isArray(comment.replies) 
          ? comment.replies.map((reply: any) => {
              if (!reply) return null;
              return {
                ...reply,
                author: reply.author || { 
                  id: '0', 
                  name: '未知用户', 
                  avatar: '/images/avatars/default-avatar.svg' 
                }
              };
            }).filter(Boolean)
          : [];
        
        // 返回修复后的评论对象
        return {
          ...comment,
          author: safeAuthor,
          replies: safeReplies,
          // 确保其他必要字段存在
          content: comment.content || '',
          createdAt: comment.createdAt || new Date().toISOString(),
          likes: comment.likes || 0,
          isLiked: !!comment.isLiked,
          replyCount: comment.replyCount || safeReplies.length
        };
      }).filter(Boolean); // 过滤掉null值
      
      setComments(prev => {
        const updatedComments = pageNum === 1 ? validatedComments : [...prev, ...validatedComments]
        console.log(`【loadComments】加载完成, 总评论数: ${updatedComments.length}, 是否有更多: ${fetchedComments.length === COMMENTS_PER_PAGE && pageNum * COMMENTS_PER_PAGE < total}`)
        return updatedComments
      })
      
      setTotalComments(total)
      // 判断是否还有更多评论可加载
      setHasMore(fetchedComments.length === COMMENTS_PER_PAGE && pageNum * COMMENTS_PER_PAGE < total)
      setPage(pageNum)
      
    } catch (err) {
      console.error('【loadComments】加载评论失败:', err)
      setError(err instanceof Error ? err : new Error('加载评论失败'))
      // 确保不影响已有的评论显示
      if (pageNum === 1) {
        setComments([])
        setTotalComments(0)
        setHasMore(false)
      }
    } finally {
      setLoading(false)
    }
  }, [storyId, chapterId])

  // 加载更多评论
  const loadMore = useCallback(() => {
    if (!loading && hasMore) {
      console.log(`【loadMore】加载更多评论, 当前页码: ${page}, 下一页: ${page + 1}`)
      loadComments(page + 1)
    } else {
      console.log(`【loadMore】未触发加载, 原因: ${loading ? '正在加载中' : '没有更多评论'}`)
    }
  }, [loading, hasMore, page, loadComments])

  // 添加评论
  const addComment = useCallback(async (content: string) => {
    console.log('【addComment】开始添加评论, 内容长度:', content.length)
    
    // 只检查token是否存在
    const token = localStorage.getItem('token')
    if (!token) {
      console.log('【addComment】用户未登录，无法添加评论')
      // 使用登录弹窗
      openLoginModal()
      throw new Error('用户未登录')
    }
    
    try {
      // 获取当前用户信息，确保显示正确的用户名
      const userStr = localStorage.getItem('user')
      let currentUser = null
      try {
        if (userStr) {
          currentUser = JSON.parse(userStr)
        }
      } catch (e) {
        console.error('【addComment】解析用户信息失败:', e)
      }
      
      const apiUrl = `/api/stories/${storyId}/chapters/${chapterId}/comments`
      console.log('【addComment】API请求URL:', apiUrl)
      
      const response = await fetch(
        apiUrl,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ content }),
        }
      )

      console.log('【addComment】API响应状态:', response.status, response.statusText)
      
      if (!response.ok) {
        if (response.status === 401) {
          // 如果后端认为token无效，清除本地存储
          localStorage.removeItem('token')
          localStorage.removeItem('user')
          // 使用登录弹窗
          toast.error('登录已过期，请重新登录')
          openLoginModal()
          throw new Error('认证失败')
        }
        throw new Error(response.statusText || '发送评论失败')
      }

      const newComment = await response.json()
      console.log('【addComment】新评论数据:', newComment)
      
      // 确保新评论包含正确的作者信息
      if (currentUser && (!newComment.author || newComment.author.id === '0')) {
        newComment.author = {
          id: currentUser.id,
          name: currentUser.nickname || '用户' + currentUser.id.substring(0, 6),
          avatar: currentUser.avatar || '/images/avatars/default-avatar.svg'
        }
      }
      
      // 更新评论列表，将新评论添加到顶部
      setComments(prev => {
        console.log('【addComment】更新前评论数:', prev.length)
        const updated = [newComment, ...prev]
        console.log('【addComment】更新后评论数:', updated.length)
        return updated
      })
      
      // 更新总评论数
      setTotalComments(prevTotal => prevTotal + 1)
      
      return newComment
    } catch (err) {
      console.error('【addComment】添加评论失败:', err)
      throw err instanceof Error ? err : new Error('发送评论失败')
    }
  }, [storyId, chapterId, openLoginModal])

  // 添加回复
  const addReply = useCallback(async (commentId: string, content: string, replyToId?: string, replyToName?: string) => {
    console.log(`【addReply】开始添加回复, 评论ID: ${commentId}, 内容长度: ${content.length}, 回复目标ID: ${replyToId || '无'}, 回复目标用户: ${replyToName || '无'}`)
    
    // 只检查token是否存在
    const token = localStorage.getItem('token')
    if (!token) {
      console.log('【addReply】用户未登录，无法添加回复')
      // 使用登录弹窗
      openLoginModal()
      throw new Error('用户未登录')
    }
    
    try {
      // 获取当前用户信息，确保显示正确的用户名
      const userStr = localStorage.getItem('user')
      let currentUser = null
      try {
        if (userStr) {
          currentUser = JSON.parse(userStr)
        }
      } catch (e) {
        console.error('【addReply】解析用户信息失败:', e)
      }
      
      // 确定是否为二级回复(回复别人的回复)
      const isSecondLevelReply = !!replyToId;
      console.log(`【addReply】回复类型: ${isSecondLevelReply ? '二级回复' : '一级回复'}, replyToId=${replyToId}, replyToName=${replyToName}`)
      
      const requestBody = { 
        content,
        ...(isSecondLevelReply ? { replyToId, replyToName } : {})
      };
      
      console.log('【addReply】请求体:', JSON.stringify(requestBody))
      
      const response = await fetch(
        `/api/stories/${storyId}/chapters/${chapterId}/comments/${commentId}/replies`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(requestBody),
        }
      )

      console.log('【addReply】API响应状态:', response.status, response.statusText)
      
      if (!response.ok) {
        if (response.status === 401) {
          // 如果后端认为token无效，清除本地存储
          localStorage.removeItem('token')
          localStorage.removeItem('user')
          // 使用登录弹窗
          toast.error('登录已过期，请重新登录')
          openLoginModal()
          throw new Error('认证失败')
        }
        throw new Error(response.statusText || '发送回复失败')
      }

      const newReply = await response.json()
      console.log('【addReply】新回复数据:', newReply)
      
      // 确保新回复的作者信息存在
      const safeNewReply = {
        ...newReply,
        author: newReply.author?.id !== '0' ? newReply.author : (
          currentUser ? {
            id: currentUser.id,
            name: currentUser.nickname || '用户' + currentUser.id.substring(0, 6),
            avatar: currentUser.avatar || '/images/avatars/default-avatar.svg'
          } : { 
            id: '0', 
            name: '未知用户', 
            avatar: '/images/avatars/default-avatar.svg' 
          }
        ),
        // 确保回复目标信息存在，但只有二级回复才设置replyToName
        replyToId: replyToId || newReply.replyToId,
        // 只有存在replyToId的情况下才设置replyToName
        ...(replyToId ? { replyToName: replyToName || newReply.replyToName } : {})
      }
      
      console.log('【addReply】处理后的回复:', {
        id: safeNewReply.id,
        replyToId: safeNewReply.replyToId,
        replyToName: safeNewReply.replyToName
      })
      
      // 更新评论列表中的回复
      setComments(prev => {
        const updated = prev.map(comment => 
          comment.id === commentId
            ? {
                ...comment,
                replies: [...comment.replies, safeNewReply],
                replyCount: comment.replyCount + 1
              }
            : comment
        )
        console.log(`【addReply】更新状态, 找到评论: ${prev.some(c => c.id === commentId)}`)
        return updated
      })
      
      return safeNewReply
    } catch (err) {
      console.error('【addReply】添加回复失败:', err)
      throw err instanceof Error ? err : new Error('发送回复失败')
    }
  }, [storyId, chapterId, openLoginModal])

  // 加载更多回复
  const loadMoreReplies = useCallback(async (commentId: string, skip: number = 0) => {
    console.log(`【useComments.loadMoreReplies】开始执行, 评论ID: ${commentId}, skip=${skip}`);
    
    // 检查参数
    if (!commentId) {
      console.error('【useComments.loadMoreReplies】评论ID为空');
      alert('加载回复失败：缺少评论ID');
      return { replies: [], hasMore: false };
    }
    
    // 每页加载的回复数量
    const REPLIES_PER_PAGE = 10;
    
    try {
      // 设置加载状态
      setLoading(true);
      
      // 找到当前评论以计算已加载的回复数和总回复数
      const currentComment = comments.find(c => c.id === commentId);
      if (!currentComment) {
        console.error(`【useComments.loadMoreReplies】未找到评论: ${commentId}`);
        return { replies: [], hasMore: false };
      }
      
      // 计算还有多少回复需要加载
      const loadedRepliesCount = currentComment.replies.length;
      const totalRepliesCount = currentComment.replyCount;
      const remainingReplies = totalRepliesCount - loadedRepliesCount;
      
      console.log(`【useComments.loadMoreReplies】当前回复状态: 已加载=${loadedRepliesCount}, 总数=${totalRepliesCount}, 剩余=${remainingReplies}`);
      
      if (remainingReplies <= 0) {
        console.log('【useComments.loadMoreReplies】没有更多回复可加载');
        return { replies: [], hasMore: false };
      }
      
      // 记录已加载回复的ID集合，用于去重
      const loadedReplyIds = new Set(currentComment.replies.map(reply => reply.id));
      
      // 请求一次加载部分剩余的回复
      const take = REPLIES_PER_PAGE;
      
      // 构建API请求URL - 适配后端API格式，后端接受page和limit参数
      // 但我们内部使用skip和take逻辑
      // 将skip转换为page参数
      const page = Math.floor(skip / take) + 1;
      const limit = take;
      
      const apiUrl = `/api/stories/${storyId}/chapters/${chapterId}/comments/${commentId}/replies?page=${page}&limit=${limit}`;
      console.log(`【useComments.loadMoreReplies】API请求URL: ${apiUrl}, 请求参数: page=${page}, limit=${limit}, 对应skip=${skip}, take=${take}`);
      
      // 发送请求
      const response = await fetch(apiUrl);
      console.log(`【useComments.loadMoreReplies】API响应状态: ${response.status}`);
      
      if (!response.ok) {
        const errorText = await response.text().catch(() => '无错误详情');
        console.error(`【useComments.loadMoreReplies】API响应错误: ${response.status} ${response.statusText}`, errorText);
        throw new Error(response.statusText || '加载回复失败');
      }
      
      // 解析响应
      const data = await response.json();
      console.log(`【useComments.loadMoreReplies】获取到回复数据:`, {
        totalReplies: data.total || 'unknown',
        receivedReplies: data.replies?.length || 0
      });
      
      if (!data.replies || !Array.isArray(data.replies)) {
        console.error('【useComments.loadMoreReplies】服务器返回格式不正确:', data);
        throw new Error('服务器返回格式不正确');
      }
      
      // 处理回复数据
      const fetchedReplies = data.replies;
      const total = data.total || totalRepliesCount; // 使用服务器返回的总数，如果没有则使用当前已知的总数
      
      // 验证并处理回复数据，同时去除可能的重复项
      const validatedReplies = fetchedReplies
        .filter((reply: any) => reply && !loadedReplyIds.has(reply.id)) // 过滤掉已加载的回复
        .map((reply: any) => {
          if (!reply) return null;
          
          return {
            ...reply,
            author: reply.author || { 
              id: '0', 
              name: '未知用户', 
              avatar: '/images/avatars/default-avatar.svg' 
            },
            content: reply.content || '',
            createdAt: reply.createdAt || new Date().toISOString(),
            likes: reply.likes || 0,
            isLiked: !!reply.isLiked,
          };
        }).filter(Boolean);
      
      console.log(`【useComments.loadMoreReplies】处理后的回复数量: ${validatedReplies.length}, 原始数量: ${fetchedReplies.length}`);
      
      // 更新评论列表中的回复
      setComments(prev => {
        console.log(`【useComments.loadMoreReplies】更新评论状态, 之前评论数: ${prev.length}`);
        
        // 找到当前评论
        const currentComment = prev.find(c => c.id === commentId);
        if (currentComment) {
          console.log(`【useComments.loadMoreReplies】找到评论: ${commentId}, 当前回复数: ${currentComment.replies.length}, 要添加数: ${validatedReplies.length}`);
        } else {
          console.warn(`【useComments.loadMoreReplies】未找到评论: ${commentId}`);
        }
        
        // 更新评论中的回复 - 将新获取的回复添加到现有回复后面
        return prev.map(comment => 
          comment.id === commentId
            ? {
                ...comment,
                // 合并现有回复和新获取的回复
                replies: [...comment.replies, ...validatedReplies],
                replyCount: total
              }
            : comment
        );
      });
      
      // 计算是否还有更多回复可以加载
      const newTotalLoaded = loadedRepliesCount + validatedReplies.length;
      const hasMore = newTotalLoaded < total;
      
      console.log(`【useComments.loadMoreReplies】加载完成: 已加载=${newTotalLoaded}, 总数=${total}, 是否有更多=${hasMore}`);
      
      // 返回结果
      return {
        replies: validatedReplies,
        hasMore: hasMore
      };
    } catch (err) {
      console.error('【useComments.loadMoreReplies】出错:', err);
      throw err instanceof Error ? err : new Error('加载回复失败');
    } finally {
      setLoading(false);
    }
  }, [storyId, chapterId, comments]);

  // 点赞评论
  const likeComment = useCallback(async (commentId: string) => {
    console.log(`【likeComment】开始点赞评论, 评论ID: ${commentId}`)
    
    // 只检查token是否存在
    const token = localStorage.getItem('token')
    if (!token) {
      console.log('【likeComment】用户未登录，无法点赞评论')
      // 使用登录弹窗
      openLoginModal()
      throw new Error('用户未登录')
    }
    
    try {
      // 先获取当前评论对象
      const comment = comments.find(c => c.id === commentId)
      if (!comment) {
        throw new Error('评论不存在')
      }
      
      // 先乐观更新UI
      setComments(prev => {
        const origComment = prev.find(c => c.id === commentId)
        console.log(`【likeComment】原评论点赞状态: ${origComment?.isLiked ? '已点赞' : '未点赞'}, 点赞数: ${origComment?.likes || 0}`)
        
        const updated = prev.map(comment =>
          comment.id === commentId
            ? {
                ...comment,
                likes: comment.isLiked ? comment.likes - 1 : comment.likes + 1,
                isLiked: !comment.isLiked
              }
            : comment
        )
        
        const newComment = updated.find(c => c.id === commentId)
        console.log(`【likeComment】新评论点赞状态: ${newComment?.isLiked ? '已点赞' : '未点赞'}, 点赞数: ${newComment?.likes || 0}`)
        
        return updated
      })
      
      // 根据当前状态决定是点赞还是取消点赞
      const apiUrl = comment.isLiked 
        ? `/api/stories/${storyId}/chapters/${chapterId}/comments/${commentId}/unlike` 
        : `/api/stories/${storyId}/chapters/${chapterId}/comments/${commentId}/like`
      
      console.log(`【likeComment】调用API: ${apiUrl}`)
      
      const response = await fetch(
        apiUrl, 
        { 
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      )
      
      if (!response.ok) {
        // 如果API调用失败，回滚状态
        setComments(prev => {
          return prev.map(comment =>
            comment.id === commentId
              ? {
                  ...comment,
                  likes: comment.isLiked ? comment.likes - 1 : comment.likes + 1,
                  isLiked: !comment.isLiked
                }
              : comment
          )
        })
        
        if (response.status === 401) {
          // 如果后端认为token无效，清除本地存储
          localStorage.removeItem('token')
          localStorage.removeItem('user')
          // 使用登录弹窗
          toast.error('登录已过期，请重新登录')
          openLoginModal()
          throw new Error('认证失败')
        }
        
        throw new Error(response.statusText || '点赞操作失败')
      }
    } catch (err) {
      console.error('【likeComment】点赞评论失败:', err)
      throw err instanceof Error ? err : new Error('点赞失败')
    }
  }, [storyId, chapterId, comments, openLoginModal])

  // 删除评论
  const deleteComment = useCallback(async (commentId: string) => {
    console.log(`【deleteComment】开始删除评论, 评论ID: ${commentId}`)
    
    // 只检查token是否存在
    const token = localStorage.getItem('token')
    if (!token) {
      console.log('【deleteComment】用户未登录，无法删除评论')
      // 使用登录弹窗
      openLoginModal()
      throw new Error('用户未登录')
    }
    
    try {
      // 先乐观更新UI
      const originalComments = [...comments]
      setComments(prev => {
        console.log(`【deleteComment】删除前评论数: ${prev.length}`)
        const updated = prev.filter(comment => comment.id !== commentId)
        console.log(`【deleteComment】删除后评论数: ${updated.length}`)
        return updated
      })
      
      // 更新总评论数
      setTotalComments(prevTotal => Math.max(0, prevTotal - 1))
      
      const apiUrl = `/api/stories/${storyId}/chapters/${chapterId}/comments/${commentId}`
      console.log('【deleteComment】API请求URL:', apiUrl)
      
      const response = await fetch(
        apiUrl,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      )

      console.log('【deleteComment】API响应状态:', response.status, response.statusText)
      
      if (!response.ok) {
        // 如果API调用失败，回滚状态
        setComments(originalComments)
        setTotalComments(originalComments.length)
        
        if (response.status === 401) {
          // 如果后端认为token无效，清除本地存储
          localStorage.removeItem('token')
          localStorage.removeItem('user')
          // 使用登录弹窗
          toast.error('登录已过期，请重新登录')
          openLoginModal()
          throw new Error('认证失败')
        }
        throw new Error(response.statusText || '删除评论失败')
      }
    } catch (err) {
      console.error('【deleteComment】删除评论失败:', err)
      throw err instanceof Error ? err : new Error('删除评论失败')
    }
  }, [storyId, chapterId, comments, openLoginModal])

  // 初始加载
  useEffect(() => {
    console.log('【useComments】开始初始加载评论')
    loadComments()
    return () => {
      console.log('【useComments】组件卸载，清理评论')
    }
  }, [loadComments])

  return {
    comments,
    loading,
    error,
    hasMore,
    totalComments,
    loadMore,
    addComment,
    addReply,
    loadMoreReplies,
    likeComment,
    deleteComment,
    reload: () => loadComments(1)
  }
} 