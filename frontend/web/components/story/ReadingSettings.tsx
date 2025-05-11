'use client'

import React, { useRef, useEffect } from 'react'
import { IoClose } from 'react-icons/io5'
import { FiRotateCcw } from 'react-icons/fi'
import { useReadingSettings } from '@/context/ReadingSettingsContext'
import styles from './ReadingSettings.module.css'

interface ReadingSettingsProps {
  onClose: () => void;
}

const fontOptions = [
  { value: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif', label: '系统默认' },
  { value: 'serif', label: '宋体' },
  { value: '"Noto Serif SC", serif', label: '思源宋体' },
  { value: '"PingFang SC", sans-serif', label: '苹方' },
  { value: 'monospace', label: '等宽字体' },
]

export default function ReadingSettings({ onClose }: ReadingSettingsProps) {
  const { settings, updateSetting, resetSettings } = useReadingSettings();
  const containerRef = useRef<HTMLDivElement>(null);
  
  // 点击外部关闭设置面板
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        onClose();
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [onClose]);

  const themeOptions = [
    { value: 'default', label: '默认', className: styles.themeOptionLight },
    { value: 'eyeCare', label: '护眼', className: styles.themeOptionSepia },
    { value: 'dark', label: '深色', className: styles.themeOptionDark },
    { value: 'sepia', label: '黄昏', className: styles.sepiaTheme }
  ]

  // 阻止点击面板时关闭
  const handleContainerClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  }

  return (
    <div className={styles.settingsContainer} ref={containerRef} onClick={handleContainerClick}>
      <div className={styles.header}>
        <div className={styles.title}>阅读设置</div>
        <button className={styles.closeButton} onClick={onClose}>
          <IoClose />
        </button>
      </div>

      <div className={styles.settingGroup}>
        <label className={styles.settingLabel}>字体大小</label>
        <div className={styles.rangeControl}>
          <input
            type="range"
            min="12"
            max="32"
            step="1"
            value={settings.fontSize}
            onChange={e => updateSetting('fontSize', Number(e.target.value))}
            className={styles.rangeInput}
          />
          <span className={styles.valueDisplay}>{settings.fontSize}px</span>
        </div>
      </div>

      <div className={styles.settingGroup}>
        <label className={styles.settingLabel}>行间距</label>
        <div className={styles.rangeControl}>
          <input
            type="range"
            min="1.2"
            max="3.0"
            step="0.1"
            value={settings.lineHeight}
            onChange={e => updateSetting('lineHeight', Number(e.target.value))}
            className={styles.rangeInput}
          />
          <span className={styles.valueDisplay}>{settings.lineHeight.toFixed(1)}</span>
        </div>
      </div>

      <div className={styles.settingGroup}>
        <label className={styles.settingLabel}>字间距</label>
        <div className={styles.rangeControl}>
          <input
            type="range"
            min="-2"
            max="3"
            step="0.2"
            value={settings.letterSpacing}
            onChange={e => updateSetting('letterSpacing', Number(e.target.value))}
            className={styles.rangeInput}
          />
          <span className={styles.valueDisplay}>{settings.letterSpacing.toFixed(1)}px</span>
        </div>
      </div>

      <div className={styles.settingGroup}>
        <label className={styles.settingLabel}>字体</label>
        <select
          className={styles.fontSelector}
          value={settings.fontFamily}
          onChange={e => updateSetting('fontFamily', e.target.value)}
          style={{ fontFamily: settings.fontFamily }}
        >
          {fontOptions.map(option => (
            <option key={option.label} value={option.value} style={{ fontFamily: option.value }}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <div className={styles.settingGroup}>
        <label className={styles.settingLabel}>主题</label>
        <div className={styles.themeOptions}>
          {themeOptions.map((option) => (
            <div
              key={option.value}
              className={`${styles.themeOption} ${option.className} ${settings.theme === option.value ? styles.themeOptionActive : ''}`}
              onClick={() => updateSetting('theme', option.value)}
              title={option.label}
            >
              {option.label}
            </div>
          ))}
        </div>
      </div>

      <button className={styles.resetButton} onClick={resetSettings}>
        <FiRotateCcw style={{ marginRight: '6px' }} />
        恢复默认设置
      </button>
    </div>
  )
} 