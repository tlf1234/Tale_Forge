/**
 * 同步服务 - 负责将本地存储的阅读记录同步到服务器
 */

/**
 * 从localStorage中获取阅读历史记录
 * @returns 本地阅读历史记录对象
 */
export function getLocalReadingHistory(): Record<string, any> {
  try {
    const savedHistory = localStorage.getItem('reading_history');
    if (savedHistory) {
      return JSON.parse(savedHistory);
    }
  } catch (err) {
    console.error('[同步服务] 读取本地阅读历史失败:', err);
  }
  return {};
}

/**
 * 清空本地阅读历史记录
 */
export function clearLocalReadingHistory(): void {
  try {
    localStorage.setItem('reading_history', JSON.stringify({}));
    console.log('[同步服务] 本地阅读历史已清空');
  } catch (err) {
    console.error('[同步服务] 清空本地阅读历史失败:', err);
  }
}

/**
 * 同步单条阅读记录到服务器
 * @param record 阅读记录对象
 * @param userId 用户ID
 * @param address 用户钱包地址
 * @param token 认证令牌
 * @returns 同步结果
 */
async function syncRecord(
  record: { storyId: string; chapterOrder: number },
  userId?: string,
  address?: string,
  token?: string
): Promise<{ success: boolean; error?: any }> {
  try {
    // 准备请求头
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };
    
    // 如果有token则添加到请求头
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    // 构建请求体
    const body = {
      storyId: record.storyId,
      chapterOrder: record.chapterOrder,
      userId,
      address
    };
    
    // 确保用户信息
    if (!userId && !address) {
      console.log('[同步服务] 缺少用户标识，无法同步记录');
      return { success: false, error: '缺少用户标识' };
    }
    
    // API端点
    const baseUrl = `/api/users/reading-history`;
    
    // 创建超时控制
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5秒超时
    
    // 发送请求
    const response = await fetch(baseUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (response.ok) {
      console.log('[同步服务] 记录同步成功:', {
        storyId: record.storyId,
        chapterOrder: record.chapterOrder
      });
      return { success: true };
    } else {
      const errorData = await response.text();
      console.log('[同步服务] 服务器返回错误:', {
        status: response.status,
        error: errorData
      });
      return { 
        success: false, 
        error: errorData
      };
    }
  } catch (error) {
    console.error('[同步服务] 同步记录失败:', error);
    return { 
      success: false, 
      error 
    };
  }
}

/**
 * 记录最后全局同步时间到localStorage
 */
export function saveLastGlobalSyncTime(): void {
  try {
    localStorage.setItem('last_global_sync_time', Date.now().toString());
    console.log('[同步服务] 已记录最后全局同步时间');
  } catch (err) {
    console.error('[同步服务] 记录同步时间失败:', err);
  }
}

/**
 * 同步所有本地阅读历史到服务器
 * @param userId 用户ID
 * @param address 用户钱包地址
 * @param token 认证令牌
 * @returns 同步是否成功
 */
export async function syncReadingHistory(
  userId?: string,
  address?: string,
  token?: string
): Promise<boolean> {
  try {
    console.log('[同步服务] 开始同步本地阅读历史');
    
    // 获取本地历史记录
    const localHistory = getLocalReadingHistory();
    
    // 检查是否有本地历史需要同步
    if (Object.keys(localHistory).length === 0) {
      console.log('[同步服务] 无本地阅读历史需要同步');
      saveLastGlobalSyncTime();
      return true;
    }
    
    console.log('[同步服务] 找到本地阅读历史记录:', Object.keys(localHistory).length);
    
    // 同步所有记录
    const results = await Promise.all(
      Object.entries(localHistory).map(([key, record]) => 
        syncRecord(record, userId, address, token)
      )
    );
    
    // 检查所有记录是否同步成功
    const allSuccess = results.every(r => r.success);
    const successCount = results.filter(r => r.success).length;
    
    console.log('[同步服务] 同步完成:', {
      总数: results.length,
      成功: successCount,
      全部成功: allSuccess
    });
    
    // 记录同步时间，无论是否全部成功
    saveLastGlobalSyncTime();
    
    // 如果全部同步成功，清空本地历史
    if (allSuccess && successCount > 0) {
      clearLocalReadingHistory();
    }
    
    return allSuccess;
  } catch (error) {
    console.error('[同步服务] 同步过程出错:', error);
    return false;
  }
} 