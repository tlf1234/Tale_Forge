import React, { useState } from 'react';
import { Editor } from '@tiptap/react';
import { toast } from 'react-hot-toast';
import styles from './FormatSelector.module.css';
import { FaTimes, FaCog, FaCheck } from 'react-icons/fa';
import { AutoFormatter, FormatOptions } from '../../utils/autoFormat';

// 格式选项接口
export interface FormatOption {
  id: string;
  name: string;
  description: string;
  applyFormat: (editor: Editor) => void;
  options?: FormatOptions;
}

// 网文常用排版格式
export const formatOptions: FormatOption[] = [
  {
    id: 'professional',
    name: '专业排版格式',
    description: '结合多种优化，打造专业级别的网文排版效果',
    applyFormat: (editor) => {
      // 获取当前内容
      const content = editor.getHTML();
      
      // 使用professionalFormat方法格式化
      const formattedContent = AutoFormatter.professionalFormat(content);
      
      // 设置格式化后的内容
      editor.commands.setContent(formattedContent);
    },
    options: {
      paragraphIndent: 2,
      paragraphSpacing: 0.5,
      lineHeight: 1.5,
      convertPunctuation: true,
      dialogIndent: true,
      chapterFormat: true,
      addSpaceAfterPunctuation: false
    }
  },
  {
    id: 'traditional',
    name: '传统网文格式',
    description: '段落首行缩进两个中文空格，适合大多数网文',
    applyFormat: (editor) => {
      // 获取当前内容
      const content = editor.getHTML();
      
      // 使用traditionalFormat方法格式化
      const formattedContent = AutoFormatter.traditionalFormat(content);
      
      // 设置格式化后的内容
      editor.commands.setContent(formattedContent);
    },
    options: {
      paragraphIndent: 2,
      paragraphSpacing: 0.2,
      lineHeight: 1.5,
      convertPunctuation: true,
      dialogIndent: true,
      chapterFormat: false
    }
  },
  {
    id: 'modern',
    name: '现代小说格式',
    description: '无首行缩进，段落间保留空行，适合现代小说',
    applyFormat: (editor) => {
      // 获取当前内容
      const content = editor.getHTML();
      
      // 使用modernFormat方法格式化
      const formattedContent = AutoFormatter.modernFormat(content);
      
      // 设置格式化后的内容
      editor.commands.setContent(formattedContent);
    },
    options: {
      paragraphIndent: 0,
      paragraphSpacing: 1,
      lineHeight: 1.8,
      convertPunctuation: true,
      dialogIndent: false,
      chapterFormat: true,
      useModernLayout: true
    }
  },
  {
    id: 'dialog',
    name: '对话优化格式',
    description: '对话段落（以引号开头）不缩进，其他段落缩进',
    applyFormat: (editor) => {
      // 获取当前内容
      const content = editor.getHTML();
      
      // 使用dialogFormat方法格式化
      const formattedContent = AutoFormatter.dialogFormat(content);
      
      // 设置格式化后的内容
      editor.commands.setContent(formattedContent);
    },
    options: {
      paragraphIndent: 2,
      paragraphSpacing: 0.5,
      lineHeight: 1.5,
      convertPunctuation: true,
      dialogIndent: false,
      chapterFormat: false
    }
  },
  {
    id: 'chapter',
    name: '章节优化格式',
    description: '识别并突出章节标题，其他段落保持缩进',
    applyFormat: (editor) => {
      // 获取当前内容
      const content = editor.getHTML();
      
      // 使用chapterFormat方法格式化
      const formattedContent = AutoFormatter.chapterFormat(content);
      
      // 设置格式化后的内容
      editor.commands.setContent(formattedContent);
    },
    options: {
      paragraphIndent: 2,
      paragraphSpacing: 0.5,
      lineHeight: 1.5,
      convertPunctuation: true,
      dialogIndent: true,
      chapterFormat: true
    }
  },
  {
    id: 'readable',
    name: '舒适阅读格式',
    description: '舒适的行距和段间距，优化长时间阅读体验',
    applyFormat: (editor) => {
      // 获取当前内容
      const content = editor.getHTML();
      
      // 使用readableFormat方法格式化
      const formattedContent = AutoFormatter.readableFormat(content);
      
      // 设置格式化后的内容
      editor.commands.setContent(formattedContent);
    },
    options: {
      paragraphIndent: 1.5,
      paragraphSpacing: 0.7,
      lineHeight: 1.8,
      convertPunctuation: true,
      dialogIndent: true,
      chapterFormat: true,
      fontSize: 18
    }
  },
  {
    id: 'compact',
    name: '紧凑格式',
    description: '减小行距和段间距，显示更多内容',
    applyFormat: (editor) => {
      // 获取当前内容
      const content = editor.getHTML();
      
      // 使用compactFormat方法格式化
      const formattedContent = AutoFormatter.compactFormat(content);
      
      // 设置格式化后的内容
      editor.commands.setContent(formattedContent);
    },
    options: {
      paragraphIndent: 1,
      paragraphSpacing: 0.3,
      lineHeight: 1.3,
      convertPunctuation: true,
      dialogIndent: true,
      chapterFormat: true
    }
  },
  {
    id: 'mobile',
    name: '手机阅读格式',
    description: '为小屏幕设备优化的阅读体验',
    applyFormat: (editor) => {
      // 获取当前内容
      const content = editor.getHTML();
      
      // 使用mobileFormat方法格式化
      const formattedContent = AutoFormatter.mobileFormat(content);
      
      // 设置格式化后的内容
      editor.commands.setContent(formattedContent);
    },
    options: {
      paragraphIndent: 1,
      paragraphSpacing: 0.5,
      lineHeight: 1.7,
      convertPunctuation: true,
      dialogIndent: true,
      chapterFormat: true,
      fontSize: 16,
      preserveInlineStyles: true,
      preserveFontStyles: false,
      overrideExistingStyles: true
    }
  },
  {
    id: 'unified',
    name: '完全统一格式',
    description: '统一所有样式，移除所有已设置的格式',
    applyFormat: (editor) => {
      // 获取当前内容
      const content = editor.getHTML();
      
      // 使用unifiedFormat方法格式化
      const formattedContent = AutoFormatter.unifiedFormat(content);
      
      // 设置格式化后的内容
      editor.commands.setContent(formattedContent);
    },
    options: {
      paragraphIndent: 2,
      paragraphSpacing: 0.5,
      lineHeight: 1.6,
      convertPunctuation: true,
      dialogIndent: true,
      chapterFormat: true,
      fontSize: 16,
      fontFamily: '"微软雅黑", "Microsoft YaHei", sans-serif',
      preserveInlineStyles: false, 
      preserveFontStyles: false,
      overrideExistingStyles: true
    }
  },
  {
    id: 'custom',
    name: '自定义格式',
    description: '根据个人喜好自定义排版格式',
    applyFormat: (editor) => {
      // 自定义格式在界面上通过配置项设置
      // 实际应用时，会使用customOptions中的设置
    },
    options: {
      paragraphIndent: 2,
      paragraphSpacing: 0.5,
      lineHeight: 1.5,
      convertPunctuation: true,
      dialogIndent: true,
      chapterFormat: true,
      preserveInlineStyles: true,
      preserveFontStyles: true,
      overrideExistingStyles: false
    }
  }
];

interface FormatSelectorProps {
  editor: Editor | null;
  onClose: () => void;
}

const FormatSelector: React.FC<FormatSelectorProps> = ({ editor, onClose }) => {
  const [selectedFormatId, setSelectedFormatId] = useState<string | null>('professional');
  const [showCustomOptions, setShowCustomOptions] = useState(false);
  const [customOptions, setCustomOptions] = useState<FormatOptions>({
    paragraphIndent: 2,
    paragraphSpacing: 0.5,
    lineHeight: 1.5,
    convertPunctuation: true,
    dialogIndent: true,
    chapterFormat: true,
    addSpaceAfterPunctuation: false,
    fontSize: 16,
    preserveInlineStyles: true,
    preserveFontStyles: true,
    overrideExistingStyles: false
  });

  const handleFormatSelect = (formatId: string) => {
    setSelectedFormatId(formatId);
    
    // 如果选择的是自定义格式，显示自定义选项
    if (formatId === 'custom') {
      setShowCustomOptions(true);
    } else {
      setShowCustomOptions(false);
      
      // 更新自定义选项为所选格式的选项
      const selectedFormat = formatOptions.find(option => option.id === formatId);
      if (selectedFormat && selectedFormat.options) {
        setCustomOptions({...selectedFormat.options});
      }
    }
  };

  const handleApplyFormat = () => {
    if (!editor || !selectedFormatId) return;

    try {
      if (selectedFormatId === 'custom') {
        // 对于自定义格式，使用customOptions应用
        const content = editor.getHTML();
        const formattedContent = AutoFormatter.customFormat(content, customOptions);
        editor.commands.setContent(formattedContent);
      } else {
        // 对于预设格式，使用applyFormat方法
        const selectedFormat = formatOptions.find(option => option.id === selectedFormatId);
        if (!selectedFormat) return;
        selectedFormat.applyFormat(editor);
      }
      
      toast.success(`已应用${selectedFormatId === 'custom' ? '自定义' : formatOptions.find(f => f.id === selectedFormatId)?.name}格式`);
      onClose();
    } catch (error) {
      console.error('格式应用失败:', error);
      toast.error('格式应用失败，请重试');
    }
  };

  const handleCustomOptionChange = (key: keyof FormatOptions, value: any) => {
    setCustomOptions(prev => ({
      ...prev,
      [key]: value
    }));
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.formatContainer} onClick={e => e.stopPropagation()}>
        <div className={styles.header}>
          <h2>选择排版格式</h2>
          <button className={styles.button} onClick={onClose}>
            <FaTimes />
          </button>
        </div>
        
        <div className={styles.optionsList}>
          {formatOptions.map(option => (
            <div 
              key={option.id} 
              className={`${styles.formatOption} ${selectedFormatId === option.id ? styles.selected : ''}`}
              onClick={() => handleFormatSelect(option.id)}
            >
              <div className={styles.formatIcon}>
                {selectedFormatId === option.id && <div className={styles.selected} />}
                {option.id === 'custom' && <FaCog />}
              </div>
              <div className={styles.formatInfo}>
                <h4 className={styles.formatName}>{option.name}</h4>
                <p className={styles.formatDescription}>
                  {option.description}
                </p>
              </div>
            </div>
          ))}
        </div>
        
        {showCustomOptions && (
          <div className={styles.customOptions}>
            <h3 className={styles.customTitle}>自定义排版选项</h3>
            
            <div className={styles.optionRow}>
              <label className={styles.optionLabel}>段落缩进（em）</label>
              <input 
                type="range" 
                min="0" 
                max="4" 
                step="0.5"
                value={customOptions.paragraphIndent || 0}
                onChange={e => handleCustomOptionChange('paragraphIndent', parseFloat(e.target.value))}
                className={styles.slider}
              />
              <span className={styles.valueDisplay}>{customOptions.paragraphIndent}</span>
            </div>
            
            <div className={styles.optionRow}>
              <label className={styles.optionLabel}>段落间距（em）</label>
              <input 
                type="range" 
                min="0" 
                max="2" 
                step="0.1"
                value={customOptions.paragraphSpacing || 0}
                onChange={e => handleCustomOptionChange('paragraphSpacing', parseFloat(e.target.value))}
                className={styles.slider}
              />
              <span className={styles.valueDisplay}>{customOptions.paragraphSpacing}</span>
            </div>
            
            <div className={styles.optionRow}>
              <label className={styles.optionLabel}>行高</label>
              <input 
                type="range" 
                min="1" 
                max="3" 
                step="0.1"
                value={customOptions.lineHeight || 1.5}
                onChange={e => handleCustomOptionChange('lineHeight', parseFloat(e.target.value))}
                className={styles.slider}
              />
              <span className={styles.valueDisplay}>{customOptions.lineHeight}</span>
            </div>
            
            <div className={styles.optionRow}>
              <label className={styles.optionLabel}>字体大小（px）</label>
              <input 
                type="range" 
                min="12" 
                max="24" 
                step="1"
                value={customOptions.fontSize || 16}
                onChange={e => handleCustomOptionChange('fontSize', parseInt(e.target.value))}
                className={styles.slider}
              />
              <span className={styles.valueDisplay}>{customOptions.fontSize}</span>
            </div>
            
            <div className={styles.optionGroup}>
              <div className={styles.checkboxRow}>
                <label className={styles.checkboxLabel}>
                  <input 
                    type="checkbox"
                    checked={customOptions.convertPunctuation || false}
                    onChange={e => handleCustomOptionChange('convertPunctuation', e.target.checked)}
                    className={styles.checkbox}
                  />
                  转换标点符号
                </label>
              </div>
              
              <div className={styles.checkboxRow}>
                <label className={styles.checkboxLabel}>
                  <input 
                    type="checkbox"
                    checked={customOptions.dialogIndent || false}
                    onChange={e => handleCustomOptionChange('dialogIndent', e.target.checked)}
                    className={styles.checkbox}
                  />
                  对话段落缩进
                </label>
              </div>
              
              <div className={styles.checkboxRow}>
                <label className={styles.checkboxLabel}>
                  <input 
                    type="checkbox"
                    checked={customOptions.chapterFormat || false}
                    onChange={e => handleCustomOptionChange('chapterFormat', e.target.checked)}
                    className={styles.checkbox}
                  />
                  特殊格式化章节标题
                </label>
              </div>
              
              <div className={styles.checkboxRow}>
                <label className={styles.checkboxLabel}>
                  <input 
                    type="checkbox"
                    checked={customOptions.useModernLayout || false}
                    onChange={e => handleCustomOptionChange('useModernLayout', e.target.checked)}
                    className={styles.checkbox}
                  />
                  使用现代排版（段落间空行，无缩进）
                </label>
              </div>
              
              <div className={styles.checkboxRow}>
                <label className={styles.checkboxLabel}>
                  <input 
                    type="checkbox"
                    checked={customOptions.addSpaceAfterPunctuation || false}
                    onChange={e => handleCustomOptionChange('addSpaceAfterPunctuation', e.target.checked)}
                    className={styles.checkbox}
                  />
                  在标点符号后添加空格
                </label>
              </div>
              
              <h4 className={styles.optionSubtitle}>样式处理选项</h4>
              
              <div className={styles.checkboxRow}>
                <label className={styles.checkboxLabel}>
                  <input 
                    type="checkbox"
                    checked={customOptions.preserveInlineStyles || false}
                    onChange={e => handleCustomOptionChange('preserveInlineStyles', e.target.checked)}
                    className={styles.checkbox}
                  />
                  保留内联样式（粗体、斜体等）
                </label>
              </div>
              
              <div className={styles.checkboxRow}>
                <label className={styles.checkboxLabel}>
                  <input 
                    type="checkbox"
                    checked={customOptions.preserveFontStyles || false}
                    onChange={e => handleCustomOptionChange('preserveFontStyles', e.target.checked)}
                    className={styles.checkbox}
                  />
                  保留字体样式（字体、大小、颜色）
                </label>
              </div>
              
              <div className={styles.checkboxRow}>
                <label className={styles.checkboxLabel}>
                  <input 
                    type="checkbox"
                    checked={customOptions.overrideExistingStyles || false}
                    onChange={e => handleCustomOptionChange('overrideExistingStyles', e.target.checked)}
                    className={styles.checkbox}
                  />
                  覆盖已有的样式（强制应用新格式）
                </label>
              </div>
            </div>
          </div>
        )}
        
        <div className={styles.actions}>
          <button 
            className={styles.cancelButton} 
            onClick={onClose}
          >
            取消
          </button>
          <button 
            className={`${styles.applyButton} ${!selectedFormatId ? styles.disabled : ''}`}
            onClick={handleApplyFormat}
            disabled={!selectedFormatId}
          >
            {selectedFormatId === 'custom' ? '应用自定义格式' : '应用排版格式'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default FormatSelector; 