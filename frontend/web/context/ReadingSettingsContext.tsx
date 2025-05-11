'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

// 默认阅读设置
const defaultSettings = {
  fontSize: 18,
  lineHeight: 1.6,
  paragraphSpacing: 1.0,
  fontFamily: 'Sans-serif',
  theme: 'light',
  letterSpacing: 0,
  textColor: '#1f2937'
};

// 类型定义
export interface ReadingSettings {
  fontSize: number;
  lineHeight: number;
  paragraphSpacing?: number;
  letterSpacing: number;
  textColor: string;
  fontFamily: string;
  theme: 'light' | 'dark' | 'sepia' | 'eyeCare' | string;
}

interface ReadingSettingsContextType {
  settings: ReadingSettings;
  updateSetting: <K extends keyof ReadingSettings>(key: K, value: ReadingSettings[K]) => void;
  resetSettings: () => void;
  isSettingsOpen: boolean;
  setIsSettingsOpen: (isOpen: boolean) => void;
}

// 创建Context
const ReadingSettingsContext = createContext<ReadingSettingsContextType | undefined>(undefined);

interface ReadingSettingsProviderProps {
  children: ReactNode;
}

// Context Provider组件
export const ReadingSettingsProvider: React.FC<ReadingSettingsProviderProps> = ({ children }) => {
  // 从localStorage加载设置，如果没有则使用默认设置
  const [settings, setSettings] = useState<ReadingSettings>(defaultSettings);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // 在组件挂载时从localStorage加载设置
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const savedSettings = localStorage.getItem('readingSettings');
    if (savedSettings) {
      try {
        const parsedSettings = JSON.parse(savedSettings);
        setSettings({...defaultSettings, ...parsedSettings});
      } catch (error) {
        console.error('Error parsing reading settings:', error);
      }
    }
  }, []);

  // 当设置变化时保存到localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return;
    localStorage.setItem('readingSettings', JSON.stringify(settings));
    
    // 应用主题到body
    document.body.dataset.theme = settings.theme;

    // 根据主题添加对应的类名到body
    const bodyClassList = document.body.classList;
    // 先移除所有主题相关类
    bodyClassList.remove('light-theme', 'dark-theme', 'sepia-theme', 'eyeCare-theme');
    
    // 添加当前主题对应的类
    if (settings.theme === 'dark') {
      bodyClassList.add('dark-theme');
      // 强制深色模式
      document.documentElement.style.colorScheme = 'dark';
    } else if (settings.theme === 'sepia') {
      bodyClassList.add('sepia-theme');
      document.documentElement.style.colorScheme = 'light';
    } else if (settings.theme === 'eyeCare') {
      bodyClassList.add('eyeCare-theme');
      document.documentElement.style.colorScheme = 'light';
    } else {
      bodyClassList.add('light-theme');
      document.documentElement.style.colorScheme = 'light';
    }
  }, [settings]);

  // 更新单个设置项
  const updateSetting = <K extends keyof ReadingSettings>(
    key: K,
    value: ReadingSettings[K]
  ) => {
    setSettings(prev => ({
      ...prev,
      [key]: value
    }));
  };

  // 重置设置为默认值
  const resetSettings = () => {
    setSettings(defaultSettings);
  };

  // 构建提供给Context的值
  return (
    <ReadingSettingsContext.Provider
      value={{
        settings,
        updateSetting,
        resetSettings,
        isSettingsOpen,
        setIsSettingsOpen
      }}
    >
      {children}
    </ReadingSettingsContext.Provider>
  );
};

// 自定义Hook，用于在组件中消费Context
export const useReadingSettings = (): ReadingSettingsContextType => {
  const context = useContext(ReadingSettingsContext);
  if (context === undefined) {
    throw new Error('useReadingSettings must be used within a ReadingSettingsProvider');
  }
  return context;
}; 