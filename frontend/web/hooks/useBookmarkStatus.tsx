import { useState, useEffect } from 'react';
import { useAuth } from './useAuth';

/**
 * 自定义钩子，用于检查一个故事是否被当前用户收藏
 * @param storyId 故事ID
 * @returns 包含收藏状态的对象
 */
export function useBookmarkStatus(storyId: string) {
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const { user, isAuthenticated } = useAuth();

  useEffect(() => {
    async function checkBookmarkStatus() {
      try {
        if (!storyId || !isAuthenticated || !user?.address) {
          setIsLoading(false);
          setIsBookmarked(false);
          return;
        }
        
        // 调用API检查收藏状态
        const response = await fetch(`/api/users/${user.address}/favorites/check?storyId=${storyId}`);
        
        if (!response.ok) {
          console.error('检查收藏状态失败:', response.status);
          setIsBookmarked(false);
          return;
        }
        
        const data = await response.json();
        setIsBookmarked(data.isBookmarked);
      } catch (error) {
        console.error('检查收藏状态异常:', error);
        setIsBookmarked(false);
      } finally {
        setIsLoading(false);
      }
    }

    checkBookmarkStatus();
  }, [storyId, user?.address, isAuthenticated]);

  // 切换收藏状态的函数
  const toggleBookmark = async () => {
    try {
      if (!isAuthenticated || !user) {
        console.log('用户未登录，无法收藏');
        return false;
      }
      
      const address = user.address;
      if (!address) {
        console.log('无法获取钱包地址');
        return false;
      }
      
      // 根据当前收藏状态调用添加或移除收藏的API
      const method = isBookmarked ? 'DELETE' : 'POST';
      
      const response = await fetch(`/api/stories/${storyId}/favorite`, {
        method,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ address })
      });
      
      if (!response.ok) {
        const error = await response.json();
        console.error('收藏操作失败:', error);
        return false;
      }
      
      // 更新收藏状态
      setIsBookmarked(!isBookmarked);
      return true;
    } catch (error) {
      console.error('收藏操作异常:', error);
      return false;
    }
  };

  return { isBookmarked, isLoading, toggleBookmark };
} 