import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from './useAuth';
import { getLocalReadingHistory, clearLocalReadingHistory, syncReadingHistory } from '@/services/syncService';

// 阅读历史项类型
export interface ReadingHistoryItem {
  id: string;
  storyId: string;
  title: string;
  coverCid: string;
  author: string;
  lastRead: string;
  lastChapterOrder: number;
}

// 分页阅读历史数据类型
export interface ReadingHistoryData {
  total: number;
  currentPage: number;
  totalPages: number;
  items: ReadingHistoryItem[];
}

/**
 * 自定义钩子，用于管理用户阅读历史
 */
export function useReadingHistory() {
  const [historyData, setHistoryData] = useState<ReadingHistoryData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const { user, token, isAuthenticated } = useAuth();
  const [localHistory, setLocalHistory] = useState<Record<string, any>>({});
  
  // 添加防抖保护的引用
  const lastRecordTimeRef = useRef<Record<string, number>>({});
  const pendingRequestsRef = useRef<Record<string, boolean>>({});
  // 添加同步状态追踪
  const syncStatusRef = useRef<{
    lastSyncTime: number,
    isSyncing: boolean
  }>({
    lastSyncTime: 0,
    isSyncing: false
  });

  // 初始化加载本地阅读记录
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        // 使用同步服务中的函数
        const history = getLocalReadingHistory();
        setLocalHistory(history);
        console.log('[阅读历史钩子] 从localStorage加载本地阅读历史:', {
          count: Object.keys(history).length
        });
      } catch (err) {
        console.error('[阅读历史钩子] 加载本地阅读历史失败:', err);
      }
    }
  }, []);

  // 保存本地阅读记录
  const saveLocalHistory = useCallback((updatedHistory: Record<string, any>) => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('reading_history', JSON.stringify(updatedHistory));
        setLocalHistory(updatedHistory);
      } catch (err) {
        console.error('[阅读历史钩子] 保存本地阅读历史失败:', err);
      }
    }
  }, []);

  // 同步本地历史记录到服务器 - 整合同步服务
  const syncLocalHistoryToServer = useCallback(async () => {
    // 防止重复同步
    if (syncStatusRef.current.isSyncing) {
      console.log('[阅读历史钩子] 同步已在进行中，跳过');
      return;
    }
    
    // 检查最后同步时间（防止频繁同步 - 2分钟内不重复同步）
    const now = Date.now();
    if (now - syncStatusRef.current.lastSyncTime < 120000) {
      console.log('[阅读历史钩子] 上次同步时间过近，跳过');
      return;
    }
    
    // 必要条件检查
    if (!isAuthenticated || (!user?.address && !user?.id) || Object.keys(localHistory).length === 0) {
      return;
    }

    console.log('[阅读历史钩子] 开始同步本地阅读历史到服务器');
    
    // 更新同步状态
    syncStatusRef.current.isSyncing = true;
    
    try {
      // 调用同步服务
      const success = await syncReadingHistory(
        user.id, 
        user.address, 
        token || undefined
      );
      
      if (success) {
        // 同步成功，更新本地状态
        setLocalHistory({});
      }
      
      // 更新同步时间
      syncStatusRef.current.lastSyncTime = Date.now();
    } catch (error) {
      console.error('[阅读历史钩子] 同步过程出错:', error);
    } finally {
      // 重置同步状态
      syncStatusRef.current.isSyncing = false;
    }
  }, [isAuthenticated, user, token, localHistory]);

  // 监听用户登录状态，登录后尝试同步本地数据
  // 修改为只在组件挂载时检查一次，避免与全局同步重复
  useEffect(() => {
    // 只在组件挂载时检查一次是否需要同步
    if (isAuthenticated && (user?.address || user?.id) && Object.keys(localHistory).length > 0) {
      // 检查上次全局同步时间，如果在2分钟内已经同步过，则跳过
      const lastSyncTime = localStorage.getItem('last_global_sync_time');
      const now = Date.now();
      
      if (lastSyncTime && now - parseInt(lastSyncTime) < 120000) {
        console.log('[阅读历史钩子] 全局同步已执行，跳过组件内同步');
        return;
      }
      
      syncLocalHistoryToServer();
    }
  // 依赖数组移除localHistory，使其只在组件挂载和认证状态改变时执行
  }, [isAuthenticated, user, syncLocalHistoryToServer]);

  // 获取阅读历史数据
  const fetchReadingHistory = async (page = 1, limit = 10) => {
    if (!isAuthenticated || (!user?.address && !user?.id)) {
      // 未登录用户展示本地阅读历史
      try {
        console.log('[阅读历史钩子] 用户未登录，展示本地阅读历史');
        
        // 将本地阅读历史转换为ReadingHistoryData格式
        const localItems = Object.values(localHistory).map((item, index) => ({
          id: `local-${index}`,
          storyId: item.storyId,
          title: item.title || '未知标题',
          coverCid: item.coverCid || '',
          author: item.author || '未知作者',
          lastRead: item.timestamp,
          lastChapterOrder: item.chapterOrder
        }));
        
        // 简单分页处理
        const total = localItems.length;
        const sortedItems = localItems.sort((a, b) => 
          new Date(b.lastRead).getTime() - new Date(a.lastRead).getTime()
        );
        const paginatedItems = sortedItems.slice((page - 1) * limit, page * limit);
        
        const localData: ReadingHistoryData = {
          total,
          currentPage: page,
          totalPages: Math.ceil(total / limit),
          items: paginatedItems
        };
        
        setHistoryData(localData);
        setCurrentPage(page);
      } catch (err) {
        console.error('[阅读历史钩子] 处理本地阅读历史异常:', err);
        setHistoryData(null);
      }
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // 构建请求URL和参数
      const queryParams = new URLSearchParams();
      queryParams.append('page', page.toString());
      queryParams.append('limit', limit.toString());
      
      // 添加认证参数
      if (user?.id) {
        queryParams.append('userId', user.id);
      } else if (user?.address) {
        queryParams.append('address', user.address);
      }
      
      // 使用适当的URL路径
      const baseUrl = `/api/users/reading-history`;
      
      const requestUrl = `${baseUrl}?${queryParams.toString()}`;
      
      console.log('[阅读历史钩子] 请求URL:', requestUrl, {
        userId: user?.id,
        address: user?.address,
        hasToken: !!token,
        page
      });
      
      // 准备请求头
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      };
      
      // 如果有token则添加到请求头
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(requestUrl, { headers });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '获取阅读历史失败');
      }

      const data = await response.json();
      setHistoryData(data);
      setCurrentPage(page);
    } catch (err) {
      console.error('[阅读历史钩子] 获取阅读历史异常:', err);
      setError((err as Error).message || '获取阅读历史失败');
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * 记录章节阅读
   * 无论用户是否登录，都会记录阅读历史
   * 登录用户: 发送到服务器
   * 未登录用户: 保存在localStorage
   */
  const recordChapterRead = (storyId: string, chapterOrder: number, storyInfo?: { title?: string, coverCid?: string, author?: string }) => {
    // 创建历史记录唯一键
    const historyKey = `${storyId}-${chapterOrder}`;
    
    // 检查是否有待处理的请求
    if (pendingRequestsRef.current[historyKey]) {
      console.log('[阅读历史钩子] 该记录已有待处理请求，跳过:', historyKey);
      return;
    }
    
    // 检查防抖间隔 (30秒内不重复记录相同章节)
    const now = Date.now();
    const lastRecordTime = lastRecordTimeRef.current[historyKey] || 0;
    if (now - lastRecordTime < 30000) {
      console.log('[阅读历史钩子] 该记录在防抖间隔内，跳过:', {
        historyKey,
        secondsAgo: Math.round((now - lastRecordTime) / 1000)
      });
      return;
    }
    
    // 更新最后记录时间
    lastRecordTimeRef.current[historyKey] = now;
    
    // 为本地存储准备数据
    const timestamp = new Date().toISOString();
    
    // 先保存到本地存储 (所有用户，包括已登录用户)
    const newLocalHistory = {
      ...localHistory,
      [historyKey]: {
        storyId,
        chapterOrder,
        timestamp,
        title: storyInfo?.title,
        coverCid: storyInfo?.coverCid,
        author: storyInfo?.author
      }
    };
    
    // 更新本地存储
    saveLocalHistory(newLocalHistory);
    console.log('[阅读历史钩子] 保存本地阅读记录:', {
      storyId,
      chapterOrder,
      timestamp
    });
    
    // 如果用户已登录，同时发送到服务器
    if (isAuthenticated && (user?.id || user?.address)) {
      // 获取用户信息
      let userId = user?.id;
      let address = user?.address;
      
      // 如果没有用户ID和地址，尝试从localStorage获取
      if ((!userId && !address) && typeof window !== 'undefined') {
        try {
          const savedUser = localStorage.getItem('user');
          if (savedUser) {
            const parsedUser = JSON.parse(savedUser);
            userId = parsedUser.id;
            address = parsedUser.address;
          }
        } catch (err) {
          console.error('[阅读历史钩子] 从localStorage获取用户信息失败:', err);
        }
      }
      
      // 确保用户信息齐全
      if (!userId && !address) {
        console.log('[阅读历史钩子] 用户信息不完整，跳过服务器记录');
        return;
      }

      // 标记该记录有待处理的请求
      pendingRequestsRef.current[historyKey] = true;
      
      // 使用setTimeout避免阻塞UI
      setTimeout(() => {
        try {
          console.log('[阅读历史钩子] 准备记录章节阅读到服务器:', {
            storyId,
            chapterOrder,
            userId,
            address,
            hasToken: !!token
          });
          
          // 构建请求URL和头部
          const baseUrl = `/api/users/reading-history`;
          
          // 准备请求头
          const headers: HeadersInit = {
            'Content-Type': 'application/json',
          };
          
          // 如果有token则添加到请求头
          if (token) {
            headers['Authorization'] = `Bearer ${token}`;
          }
          
          // 构建请求体，只包含章节信息和用户标识
          const body = {
            storyId,
            chapterOrder,
            userId,
            address
          };

          // 创建超时控制
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 5000); // 5秒超时
          
          // 使用fetch API发送请求
          fetch(baseUrl, {
            method: 'POST',
            headers,
            body: JSON.stringify(body),
            signal: controller.signal
          })
          .then(response => {
            clearTimeout(timeoutId);
            
            if (response.ok) {
              console.log('[阅读历史钩子] 章节阅读记录成功发送到服务器');
              return response.json();
            } else {
              return response.text().then(text => {
                try {
                  return JSON.parse(text);
                } catch {
                  return { error: text };
                }
              }).then(data => {
                console.log('[阅读历史钩子] 服务器返回错误:', {
                  status: response.status,
                  error: data.error
                });
                throw new Error(data.error || `服务器返回错误: ${response.status}`);
              });
            }
          })
          .catch(error => {
            clearTimeout(timeoutId);
            
            if (error.name === 'AbortError') {
              console.log('[阅读历史钩子] 请求超时，已取消');
            } else {
              console.error('[阅读历史钩子] 记录章节阅读异常:', error.message);
            }
          })
          .finally(() => {
            // 完成后清除请求标记
            pendingRequestsRef.current[historyKey] = false;
          });
        } catch (err) {
          console.error('[阅读历史钩子] 章节阅读记录请求准备失败:', err);
          // 错误时也要清除请求标记
          pendingRequestsRef.current[historyKey] = false;
        }
      }, 300);
    }
  };

  // 监听用户登录状态变化，自动加载阅读历史
  useEffect(() => {
    fetchReadingHistory(1);
  }, [isAuthenticated, user?.address, user?.id]);

  return {
    historyData,
    isLoading,
    error,
    currentPage,
    fetchReadingHistory,
    recordChapterRead,
    localHistory,
    syncLocalHistoryToServer
  };
}