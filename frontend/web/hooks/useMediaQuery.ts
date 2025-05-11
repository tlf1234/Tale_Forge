import { useState, useEffect } from 'react';

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);
  
  useEffect(() => {
    // 在服务器端渲染时不执行此逻辑
    if (typeof window === 'undefined') {
      return;
    }
    
    const media = window.matchMedia(query);
    
    // 初始匹配状态
    setMatches(media.matches);
    
    // 创建媒体查询监听器
    const listener = (event: MediaQueryListEvent) => {
      setMatches(event.matches);
    };
    
    // 添加监听器
    media.addEventListener('change', listener);
    
    // 清理函数
    return () => {
      media.removeEventListener('change', listener);
    };
  }, [query]);
  
  return matches;
} 