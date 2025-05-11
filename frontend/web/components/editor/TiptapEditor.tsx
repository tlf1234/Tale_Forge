'use client'

import React, { useCallback, useState, useEffect, memo, useRef, useMemo } from 'react'
import { useEditor, EditorContent, Editor } from '@tiptap/react'
import { Extension } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import Placeholder from '@tiptap/extension-placeholder'
import TextAlign from '@tiptap/extension-text-align'
import Underline from '@tiptap/extension-underline'
import TextStyle from '@tiptap/extension-text-style'
import { Color } from '@tiptap/extension-color'
import { FontSize } from './extensions/fontSize'
import { Indent } from './extensions/indent'
import { ResizableImageNode } from './extensions/ResizableImageNode'
import { AutoFormatter } from '../../utils/autoFormat'
import {
  FaBold,
  FaItalic,
  FaUnderline,
  FaStrikethrough,
  FaQuoteRight,
  FaListUl,
  FaListOl,
  FaImage,
  FaLink,
  FaCog,
  FaAlignLeft,
  FaAlignCenter,
  FaAlignRight,
  FaSave,
  FaHistory,
  FaFont,
  FaPalette,
  FaCheck,
  FaIndent,
  FaOutdent,
  FaMagic,
  FaRobot,
  FaDownload,
  FaEdit,
  FaTimes,
  FaExchangeAlt
} from 'react-icons/fa'
import styles from './TiptapEditor.module.css'
import { ImageExtension } from './extensions/ImageExtension'
import ImageResizer from './components/ImageResizer'
import { TiptapEditorProps } from './types'
import AIImageGenerator from '../common/AIImageGenerator'
import { toast } from 'react-hot-toast'
import { FontFamily } from './extensions/fontFamily'
import FormatSelector from './FormatSelector'

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    fontSize: {
      setFontSize: (size: number) => ReturnType;
      unsetFontSize: () => ReturnType;
    };
  }
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    indent: {
      indent: () => ReturnType;
      outdent: () => ReturnType;
    };
  }
}

// 添加自定义扩展来处理 Tab 键
const TabHandler = Extension.create({
  name: 'tabHandler',
  
  addKeyboardShortcuts() {
    return {
      Tab: ({ editor }) => {
        // 阻止默认行为
        const event = window.event;
        if (event) {
          event.preventDefault();
        }
        
        // 插入不间断空格而不是使用缩进功能
        return editor.commands.insertContent('\u00A0\u00A0\u00A0\u00A0');
      },
      'Shift-Tab': ({ editor }) => {
        // 阻止默认行为
        const event = window.event;
        if (event) {
          event.preventDefault();
        }
        
        // 使用减少缩进功能
        return editor.commands.outdent();
      }
    }
  },
})

// 添加自定义扩展来处理键盘快捷键
const KeyboardShortcuts = Extension.create({
  name: 'keyboardShortcuts',
  
  addKeyboardShortcuts() {
    return {
      // 保存快捷键
      'Mod-s': () => {
        // 触发保存按钮点击
        const saveButton = document.querySelector(`.${styles.saveButton}`) as HTMLButtonElement;
        if (saveButton) {
          saveButton.click();
        }
        return true;
      },
      
      // 其他快捷键可以在这里添加
    }
  },
})

// AI 生图提示框组件
const AIPromptModal = ({ onClose, onSubmit, initialValue = '' }: { 
  onClose: () => void, 
  onSubmit: (prompt: string, resolution: string, style?: string, referenceImage?: string) => void,
  initialValue?: string 
}) => {
  const [prompt, setPrompt] = useState(initialValue);
  const [style, setStyle] = useState<string | null>(null);
  const [resolution, setResolution] = useState('1024:1024');
  const [referenceImage, setReferenceImage] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [showStyle, setShowStyle] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      if (prompt.trim()) {
        onSubmit(prompt.trim(), resolution, style || undefined, referenceImage || undefined);
        onClose();
      }
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      handleImageUpload(file);
    }
  };

  const handleImageUpload = (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('请上传图片文件');
      return;
    }

    // 检查文件大小（5MB限制）
    if (file.size > 5 * 1024 * 1024) {
      toast.error('图片大小不能超过5MB');
      return;
    }

    try {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          
          const MAX_WIDTH = 800;
          const MAX_HEIGHT = 800;
          
          let width = img.width;
          let height = img.height;
          
          if (width > height) {
            if (width > MAX_WIDTH) {
              height = Math.round((height * MAX_WIDTH) / width);
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width = Math.round((width * MAX_HEIGHT) / height);
              height = MAX_HEIGHT;
            }
          }
          
          canvas.width = width;
          canvas.height = height;
          
          if (ctx) {
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            ctx.drawImage(img, 0, 0, width, height);
            
            const base64String = canvas.toDataURL('image/jpeg', 0.8);
            const base64Data = base64String.split(',')[1];
            if (!base64Data || !/^[A-Za-z0-9+/=]+$/.test(base64Data)) {
              throw new Error('Invalid base64 data');
            }
            setReferenceImage(base64Data);
          }
        };
        img.onerror = () => {
          toast.error('图片加载失败，请重试');
        };
        img.src = e.target?.result as string;
      };
      reader.onerror = () => {
        toast.error('文件读取失败，请重试');
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error('图片处理失败:', error);
      toast.error('图片处理失败，请重试');
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleImageUpload(file);
    }
  };

  const handleRemoveImage = () => {
    setReferenceImage(null);
  };

  const handleToggleUpload = () => {
    setShowUpload(!showUpload);
    if (!showUpload) {
      setReferenceImage(null);
    }
  };

  const styleOptions = [
    { value: 'manhua', label: '漫画' },
    { value: 'xieshi', label: '写实' },
    { value: 'dongman', label: '动漫' },
    { value: '3dxuanran', label: '3D渲染' },
    { value: 'riman', label: '日漫动画' },
    { value: 'bianping', label: '扁平插画' },
    { value: 'xiangsu', label: '像素插画' },
    { value: 'saibopengke', label: '赛博朋克' },
  ];

  const resolutionOptions = [
    { value: '1024:1024', label: '1 ： 1' },
    { value: '768:1024', label: '3 ： 4' },
    { value: '1024:768', label: '4 ： 3' },
    { value: '720:1280', label: '9 ： 16' },
    { value: '1280:720', label: '16 ： 9' }
  ];

  return (
    <AIImageGenerator isOpen={true} onClose={onClose} title="AI 生图">
      <textarea
        ref={textareaRef}
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="描述您想要生成的图片，例如：一只可爱的猫咪在阳光下玩耍"
        rows={4}
        className={styles.promptTextarea}
      />
      <div className={styles.uploadToggle}>
        <button
          onClick={handleToggleUpload}
          className={`${styles.toggleButton} ${showUpload ? styles.toggleButtonActive : ''}`}
        >
          <FaImage className={styles.toggleIcon} />
          {showUpload ? '关闭参考图片' : '添加参考图片'}
        </button>
      </div>
      {showUpload && (
        <div 
          className={`${styles.uploadArea} ${isDragging ? styles.dragging : ''}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            type="file"
            ref={fileInputRef}
            accept="image/*"
            onChange={handleFileInputChange}
            style={{ display: 'none' }}
          />
          {referenceImage ? (
            <div style={{ position: 'relative', width: '100%', maxWidth: '300px', margin: '0 auto' }}>
              <img 
                src={`data:image/jpeg;base64,${referenceImage}`}
                alt="参考图片" 
                className={styles.previewImage}
                style={{ 
                  width: '100%', 
                  height: 'auto', 
                  borderRadius: '8px',
                  boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
                  objectFit: 'contain'
                }} 
              />
              <button 
                className={styles.removeImage} 
                onClick={handleRemoveImage}
                style={{
                  position: 'absolute',
                  top: '8px',
                  right: '8px',
                  background: 'rgba(0, 0, 0, 0.5)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '50%',
                  width: '24px',
                  height: '24px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                <FaTimes />
              </button>
            </div>
          ) : (
            <>
              <div className={styles.uploadIcon}>
                <FaImage />
              </div>
              <div className={styles.uploadText}>
                点击或拖拽图片到此处上传
              </div>
              <div className={styles.uploadHint}>
                支持 jpg、png... 格式，最大 5MB
              </div>
            </>
          )}
        </div>
      )}
      <div className={styles.promptOptions}>
        <div className={styles.optionGroup}>
          <label className={styles.optionLabel}>图片风格</label>
          <select
            value={style || ''}
            onChange={(e) => setStyle(e.target.value || null)}
            className={styles.optionSelect}
          >
            <option value="">默认风格</option>
            {styleOptions.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className={styles.promptOptions}>
        <div className={styles.optionGroup}>
          <label className={styles.optionLabel}>分辨率</label>
          <select
            value={resolution}
            onChange={(e) => setResolution(e.target.value)}
            className={styles.optionSelect}
          >
            {resolutionOptions.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className={styles.promptButtons}>
        <button
          onClick={onClose}
          className={styles.cancelButton}
        >
          取消
        </button>
        <button
          onClick={() => {
            if (prompt.trim()) {
              onSubmit(prompt.trim(), resolution, style || undefined, referenceImage || undefined);
              onClose();
            }
          }}
          disabled={!prompt.trim()}
          className={styles.generateButton}
        >
          生成图片
        </button>
      </div>
    </AIImageGenerator>
  );
};

// 工具栏组件
const MenuBar = memo(({ editor, onImageClick, onSave, onImageSelect }: { 
  editor: Editor | null, 
  onImageClick: () => void, 
  onSave?: () => void,
  onImageSelect?: (event: React.ChangeEvent<HTMLInputElement>) => void 
}) => {
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showFontSize, setShowFontSize] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showAIPrompt, setShowAIPrompt] = useState(false);
  const [showFontFamily, setShowFontFamily] = useState(false);
  const [showFormatSelector, setShowFormatSelector] = useState(false);
  const [currentFont, setCurrentFont] = useState('字体');
  const [currentFontSize, setCurrentFontSize] = useState<number | null>(null);

  const addLink = useCallback(() => {
    if (!editor) return;
    const url = window.prompt('输入链接URL:')
    if (url) {
      editor.chain().focus().setLink({ href: url }).run()
    }
  }, [editor]);

  const setFontSize = useCallback((size: number) => {
    if (!editor) return;
    
    // 确保编辑器有焦点并且文本被选中
    if (editor.state.selection.empty) {
      toast.error('请先选择要设置字号的文本');
      return;
    }
    
    // 应用字号样式
    editor.chain().focus().setFontSize(size).run();
    
    // 更新当前字号显示
    setCurrentFontSize(size);
    
    // 关闭下拉菜单
    setShowFontSize(false);
    
    // 添加成功提示
    toast.success(`已应用${size}px字号`);
  }, [editor]);

  const setColor = useCallback((color: string) => {
    if (!editor) return;
    editor.chain().focus().setColor(color).run();
  }, [editor]);

  const handleAutoFormat = useCallback(() => {
    if (!editor) return;
    const content = editor.getHTML();
    // 使用统一格式化方法完全统一所有文本格式
    const formatted = AutoFormatter.unifiedFormat(content);
    editor.commands.setContent(formatted);
    toast.success('已应用统一格式，所有特殊格式已被移除');
  }, [editor]);

  const handleShowFormatSelector = useCallback(() => {
    if (!editor) return;
    setShowFormatSelector(true);
  }, [editor]);

  const handleImageUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    if (!editor || !event.target.files?.length) return;

    const file = event.target.files[0];
    const reader = new FileReader();

    reader.onload = (e) => {
      const imageUrl = e.target?.result as string;
      if (imageUrl) {
        const imgElement = document.createElement('img');
        imgElement.onload = () => {
          const maxWidth = 800;
          let width = imgElement.naturalWidth;
          let height = imgElement.naturalHeight;

          if (width > maxWidth) {
            const ratio = maxWidth / width;
            width = maxWidth;
            height = Math.round(height * ratio);
          }

          editor.commands.setImage({ 
            src: imageUrl,
            alt: file.name,
            title: file.name,
            width,
            height
          });
        };
        imgElement.src = imageUrl;
      }
    };

    reader.readAsDataURL(file);
    event.target.value = '';
  }, [editor]);


  const insertIndent = useCallback(() => {
    if (!editor) return;
    console.log('通过按钮插入缩进');
    editor.commands.insertContent('    ');
  }, [editor]);

  const handleSave = useCallback(() => {
    if (onSave) {
      onSave();
    } else {
      console.log('保存功能未实现');
    }
  }, [onSave]);

  const handleAIImage = useCallback(async () => {
    if (!editor) return;
    
    try {
      const selectedText = editor.state.selection.empty 
        ? null 
        : editor.state.doc.textBetween(editor.state.selection.from, editor.state.selection.to);

      setShowAIPrompt(true);
      
      if (selectedText) {
        setTimeout(() => {
          const textarea = document.querySelector(`.${styles.promptTextarea}`) as HTMLTextAreaElement;
          if (textarea) {
            textarea.value = selectedText;
          }
        }, 0);
      }
    } catch (error) {
      console.error('AI 生图失败:', error);
      alert('生成图片失败，请重试');
    }
  }, [editor]);

  const generateImage = async (prompt: string, resolution: string, style?: string, referenceImage?: string) => {
    if (!editor) return;
    
    let progressInterval: NodeJS.Timeout | undefined;
    let loadingDialog: HTMLDivElement | undefined;
    
    try {
      loadingDialog = document.createElement('div');
      loadingDialog.className = styles.imagePreviewDialog;
      loadingDialog.innerHTML = `
        <div class="${styles.imagePreviewContent}">
          <div class="${styles.loadingContainer}">
            <div class="${styles.loadingSpinner}"></div>
            <div class="${styles.loadingText}">正在生成图片...</div>
            <div class="${styles.progressBar}">
              <div class="${styles.progressFill}"></div>
            </div>
          </div>
        </div>
      `;
      document.body.appendChild(loadingDialog);

      let progress = 0;
      progressInterval = setInterval(() => {
        progress += 5;
        const progressFill = loadingDialog?.querySelector(`.${styles.progressFill}`) as HTMLElement;
        if (progressFill) {
          progressFill.style.width = `${Math.min(progress, 90)}%`;
        }
      }, 500);

      const requestBody = {
        prompt,
        resolution,
        ...(style && { style }),
        ...(referenceImage && { referenceImage }) 
      };

      const response = await fetch('/api/ai/generate-image', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        clearInterval(progressInterval);
        document.body.removeChild(loadingDialog);
        throw new Error('生成图片失败');
      }

      const { imageUrl } = await response.json();

      const imgLoader = new Image();
      imgLoader.src = imageUrl;

      await new Promise((resolve, reject) => {
        imgLoader.onload = resolve;
        imgLoader.onerror = reject;
      });

      clearInterval(progressInterval);
      document.body.removeChild(loadingDialog);

      const previewDialog = document.createElement('div');
      previewDialog.className = styles.imagePreviewDialog;
      previewDialog.innerHTML = `
        <div class="${styles.imagePreviewContent}">
          <div class="${styles.imageContainer}" style="
            width: 100%;
            max-width: 90vw;
            max-height: 80vh;
            overflow: auto;
            display: flex;
            justify-content: center;
            align-items: center;
            padding: 20px;
            background: #f5f5f5;
            border-radius: 8px;
            margin-bottom: 20px;
          ">
            <img src="${imageUrl}" alt="${prompt}" style="
              max-width: 100%;
              max-height: 70vh;
              object-fit: contain;
              border-radius: 4px;
              box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
            " />
          </div>
          <div class="${styles.imageActions}" style="
            display: flex;
            gap: 12px;
            justify-content: center;
            margin-top: 20px;
          ">
            <button class="${styles.downloadButton}" style="
              padding: 8px 16px;
              background: #4CAF50;
              color: white;
              border: none;
              border-radius: 4px;
              cursor: pointer;
              display: flex;
              align-items: center;
              gap: 8px;
              transition: background 0.2s;
            ">
              <span class="${styles.buttonIcon}"><i class="fas fa-download"></i></span>
              下载图片
            </button>
            <button class="${styles.insertButton}" style="
              padding: 8px 16px;
              background: #2196F3;
              color: white;
              border: none;
              border-radius: 4px;
              cursor: pointer;
              display: flex;
              align-items: center;
              gap: 8px;
              transition: background 0.2s;
            ">
              <span class="${styles.buttonIcon}"><i class="fas fa-edit"></i></span>
              插入到编辑器
            </button>
            <button class="${styles.cancelButton}" style="
              padding: 8px 16px;
              background: #f44336;
              color: white;
              border: none;
              border-radius: 4px;
              cursor: pointer;
              display: flex;
              align-items: center;
              gap: 8px;
              transition: background 0.2s;
            ">
              <span class="${styles.buttonIcon}"><i class="fas fa-times"></i></span>
              取消
            </button>
          </div>
        </div>
      `;

      previewDialog.querySelector(`.${styles.downloadButton}`)?.addEventListener('click', () => {
        window.open(imageUrl, '_blank');
      });

      previewDialog.querySelector(`.${styles.insertButton}`)?.addEventListener('click', () => {
        editor.chain().focus().setImage({ 
          src: imageUrl,
          alt: prompt,
          title: prompt
        }).run();
        document.body.removeChild(previewDialog);
      });

      previewDialog.querySelector(`.${styles.cancelButton}`)?.addEventListener('click', () => {
        document.body.removeChild(previewDialog);
      });


      const buttons = previewDialog.querySelectorAll('button');
      buttons.forEach(button => {
        button.addEventListener('mouseover', () => {
          button.style.opacity = '0.9';
        });
        button.addEventListener('mouseout', () => {
          button.style.opacity = '1';
        });
      });


      document.body.appendChild(previewDialog);
    } catch (error) {
      console.error('AI 生图失败:', error);
      if (typeof progressInterval !== 'undefined') {
        clearInterval(progressInterval);
      }
      if (loadingDialog && document.body.contains(loadingDialog)) {
        document.body.removeChild(loadingDialog);
      }
      toast.error('生成图片失败，请重试');
    }
  };

  const fontFamilyOptions = [
    { value: 'Arial, sans-serif', label: 'Arial' },
    { value: '"Times New Roman", Times, serif', label: 'Times New Roman' },
    { value: '"微软雅黑", "Microsoft YaHei", sans-serif', label: '微软雅黑' },
    { value: '宋体, SimSun, serif', label: '宋体' },
    { value: '黑体, SimHei, sans-serif', label: '黑体' },
    { value: '楷体, KaiTi, serif', label: '楷体' },
    { value: '"Courier New", Courier, monospace', label: 'Courier New' },
    { value: 'Georgia, serif', label: 'Georgia' }
  ];

  // 根据字体标签获取对应的CSS值
  const getFontFamilyValue = (fontLabel: string): string => {
    const fontOption = fontFamilyOptions.find(f => f.label === fontLabel);
    return fontOption ? fontOption.value : '"微软雅黑", sans-serif';
  };

  const setFontFamily = useCallback((fontFamily: string) => {
    if (!editor) return;
    
    // 确保编辑器有焦点并且文本被选中
    if (editor.state.selection.empty) {
      toast.error('请先选择要设置字体的文本');
      return;
    }
    
    // 应用字体样式
    editor.chain().focus().setFontFamily(fontFamily).run();
    
    // 更新当前字体显示
    const fontOption = fontFamilyOptions.find(f => f.value === fontFamily);
    setCurrentFont(fontOption?.label || '字体');
    
    // 关闭下拉菜单
    setShowFontFamily(false);
    
    // 添加成功提示
    toast.success(`已应用"${fontOption?.label || fontFamily}"字体`);
  }, [editor, fontFamilyOptions]);

  useEffect(() => {
    if (!editor) return;

    // 监听编辑器选择变化事件
    const onSelectionUpdate = () => {
      try {
        // 获取当前选择的文本样式
        const attrs = editor.getAttributes('textStyle');
        console.log('当前文本样式:', attrs);
        
        // 获取字体和字号属性
        const fontSize = attrs.fontSize;
        const fontFamily = attrs.fontFamily;

        // 更新字号显示
        if (fontSize) {
          setCurrentFontSize(parseInt(fontSize, 10));
        } else {
          // 尝试从节点类型获取
          const markAttrs = editor.getAttributes('fontSize');
          if (markAttrs.fontSize) {
            setCurrentFontSize(parseInt(markAttrs.fontSize, 10));
          } else {
            setCurrentFontSize(null);
          }
        }

        // 更新字体显示
        if (fontFamily) {
          const fontOption = fontFamilyOptions.find(f => 
            f.value === fontFamily || 
            fontFamily.includes(f.value.replace(/['"]/g, '')) ||
            f.value.includes(fontFamily.replace(/['"]/g, ''))
          );
          
          if (fontOption) {
            setCurrentFont(fontOption.label);
          } else {
            // 如果没有找到匹配的预设字体，显示部分字体名称
            const cleanFontFamily = fontFamily.replace(/['"]/g, '').split(',')[0].trim();
            setCurrentFont(cleanFontFamily);
          }
        } else {
          // 尝试从节点类型获取
          const markAttrs = editor.getAttributes('fontFamily');
          if (markAttrs.fontFamily) {
            const fontOption = fontFamilyOptions.find(f => 
              f.value === markAttrs.fontFamily || 
              markAttrs.fontFamily.includes(f.value.replace(/['"]/g, '')) ||
              f.value.includes(markAttrs.fontFamily.replace(/['"]/g, ''))
            );
            
            if (fontOption) {
              setCurrentFont(fontOption.label);
            } else {
              const cleanFontFamily = markAttrs.fontFamily.replace(/['"]/g, '').split(',')[0].trim();
              setCurrentFont(cleanFontFamily);
            }
          } else {
            setCurrentFont('字体');
          }
        }
      } catch (error) {
        console.error('获取文本样式失败:', error);
      }
    };

    // 注册多种事件监听器以确保能够捕获所有可能的选择状态变化
    editor.on('selectionUpdate', onSelectionUpdate);
    editor.on('focus', onSelectionUpdate);
    editor.on('update', onSelectionUpdate);
    editor.on('transaction', onSelectionUpdate);
    
    // 监听点击事件，确保点击后能获取样式
    const handleClick = () => {
      setTimeout(onSelectionUpdate, 10);
    };

    // 监听选择变化事件
    const handleSelectionChange = () => {
      setTimeout(onSelectionUpdate, 10);
    };

    // 添加DOM事件监听器
    editor.view.dom.addEventListener('click', handleClick);
    document.addEventListener('selectionchange', handleSelectionChange);
    
    // 初始化时检查一次
    setTimeout(onSelectionUpdate, 100);

    // 组件卸载时清理监听器
    return () => {
      editor.off('selectionUpdate', onSelectionUpdate);
      editor.off('focus', onSelectionUpdate);
      editor.off('update', onSelectionUpdate);
      editor.off('transaction', onSelectionUpdate);
      editor.view.dom.removeEventListener('click', handleClick);
      document.removeEventListener('selectionchange', handleSelectionChange);
    };
  }, [editor, fontFamilyOptions]);

  // 添加标点符号转换函数
  const handleConvertPunctuation = useCallback(() => {
    if (!editor) return;
    
    // 获取当前内容
    const content = editor.getHTML();
    
    // 使用AutoFormatter处理标点符号转换
    // 仅应用标点符号转换，不进行其他格式调整
    const result = AutoFormatter.customFormat(content, {
      convertPunctuation: true,
      paragraphIndent: undefined, // 不修改段落缩进
      paragraphSpacing: undefined, // 不修改段落间距
      lineHeight: undefined, // 不修改行高
      dialogIndent: undefined, // 不特殊处理对话段落
      chapterFormat: undefined // 不特殊处理章节标题
    });
    
    // 设置处理后的内容
    editor.commands.setContent(result);
    toast.success('已将英文标点符号转换为中文标点符号');
  }, [editor]);

  if (!editor) return null;

  return (
    <>
      <div className={styles.menuBar}>
        <div className={styles.toolGroup}>
          <button
            onClick={() => editor.chain().focus().toggleBold().run()}
            className={editor.isActive('bold') ? styles.isActive : ''}
            title="粗体"
          >
            <FaBold />
          </button>
          <button
            onClick={() => editor.chain().focus().toggleItalic().run()}
            className={editor.isActive('italic') ? styles.isActive : ''}
            title="斜体"
          >
            <FaItalic />
          </button>
          <button
            onClick={() => editor.chain().focus().toggleUnderline().run()}
            className={editor.isActive('underline') ? styles.isActive : ''}
            title="下划线"
          >
            <FaUnderline />
          </button>
        </div>

        <div className={styles.divider} />

        <div className={styles.toolGroup}>
          <button
            onClick={() => editor.chain().focus().indent().run()}
            title="增加缩进"
          >
            <FaIndent />
          </button>
          <button
            onClick={() => editor.chain().focus().outdent().run()}
            title="减少缩进"
          >
            <FaOutdent />
          </button>
          <button
            onClick={insertIndent}
            title="插入空格缩进"
            className={styles.indentButton}
          >
            空格缩进
          </button>
        </div>

        <div className={styles.divider} />

        <div className={styles.toolGroup}>
          <button
            onClick={handleConvertPunctuation}
            title="英文标点转中文标点"
          >
            <FaExchangeAlt />
          </button>
        </div>

        <div className={styles.divider} />

        <div className={styles.toolGroup}>
          <button
            onClick={() => setShowFontSize(!showFontSize)}
            title="字号"
            className={`${styles.fontSizeButton} ${showFontSize ? styles.isActiveDropdown : ''} ${currentFontSize ? styles.isActiveFormat : ''}`}
          >
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '4px',
              position: 'relative'
            }}>
              <FaFont style={{ flexShrink: 0 }} />
              <span style={{ 
                fontWeight: currentFontSize ? '500' : 'normal',
                fontSize: currentFontSize ? `${Math.min(16, currentFontSize / 16 * 14)}px` : 'inherit'
              }}>
                {currentFontSize ? `${currentFontSize}px` : '字号'}
              </span>
            </div>
          </button>
          {showFontSize && (
            <div className={styles.dropdown}>
              {[12, 14, 16, 18, 20, 24, 28, 32].map(size => (
                <button
                  key={size}
                  onClick={() => setFontSize(size)}
                  className={`${styles.dropdownItem} ${currentFontSize === size ? styles.active : ''}`}
                >
                  <div className={styles.fontSizeItem}>
                    <span className={styles.fontSizeLabel} style={{ fontSize: `${size}px` }}>
                      {size}px
                    </span>
                    <span className={styles.fontSizePreview}>
                      Aa
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
          
          <button
            onClick={() => setShowColorPicker(!showColorPicker)}
            title="文字颜色"
          >
            <FaPalette />
          </button>
          {showColorPicker && (
            <div className={styles.colorPicker}>
              {['#000000', '#FF0000', '#00FF00', '#0000FF', '#FFA500', '#800080'].map(color => (
                <button
                  key={color}
                  onClick={() => setColor(color)}
                  className={styles.colorButton}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          )}
        </div>

        <div className={styles.divider} />

        <div className={styles.toolGroup}>
          <button
            onClick={() => setShowFontFamily(!showFontFamily)}
            title="字体"
            className={`${styles.fontFamilyButton} ${showFontFamily ? styles.isActiveDropdown : ''} ${currentFont !== '字体' ? styles.isActiveFormat : ''}`}
          >
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '4px',
              position: 'relative',
              width: '100%',
              overflow: 'hidden'
            }}>
              <FaFont style={{ flexShrink: 0 }} />
              <span style={{ 
                fontWeight: currentFont !== '字体' ? '500' : 'normal',
                maxWidth: '100%',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
              }}>
                {currentFont}
              </span>
            </div>
          </button>
          {showFontFamily && (
            <div className={`${styles.dropdown} ${styles.fontFamilyDropdown}`}>
              {fontFamilyOptions.map(font => (
                <button
                  key={font.value}
                  onClick={() => setFontFamily(font.value)}
                  className={`${styles.dropdownItem} ${currentFont === font.label ? styles.active : ''}`}
                >
                  <span style={{ fontFamily: font.value }}>{font.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className={styles.divider} />

        <div className={styles.toolGroup}>
          <button
            onClick={() => editor.chain().focus().setTextAlign('left').run()}
            className={editor.isActive({ textAlign: 'left' }) ? styles.isActive : ''}
            title="左对齐"
          >
            <FaAlignLeft />
          </button>
          <button
            onClick={() => editor.chain().focus().setTextAlign('center').run()}
            className={editor.isActive({ textAlign: 'center' }) ? styles.isActive : ''}
            title="居中"
          >
            <FaAlignCenter />
          </button>
          <button
            onClick={() => editor.chain().focus().setTextAlign('right').run()}
            className={editor.isActive({ textAlign: 'right' }) ? styles.isActive : ''}
            title="右对齐"
          >
            <FaAlignRight />
          </button>
        </div>

        <div className={styles.divider} />

        <div className={styles.toolGroup}>
          <input
            type="file"
            ref={imageInputRef}
            accept="image/*"
            onChange={handleImageUpload}
            style={{ display: 'none' }}
          />
          <button 
            onClick={() => imageInputRef.current?.click()} 
            title="插入图片"
          >
            <FaImage />
          </button>
          <button onClick={addLink} title="插入链接">
            <FaLink />
          </button>
        </div>

        <div className={styles.rightTools}>
          <button
            onClick={handleAutoFormat}
            title="一键排版"
            className={styles.formatButton}
          >
            <FaMagic />
          </button>
          <button 
            onClick={handleShowFormatSelector}
            title="选择排版格式"
            className={styles.formatButton}
          >
            <FaEdit />
          </button>
          <button 
            onClick={handleAIImage} 
            title="AI 生图"
            className={styles.aiButton}
          >
            <FaRobot />
          </button>
        </div>
      </div>
      {showAIPrompt && (
        <AIPromptModal
          onClose={() => setShowAIPrompt(false)}
          onSubmit={generateImage}
          initialValue={editor.state.selection.empty 
            ? '' 
            : editor.state.doc.textBetween(editor.state.selection.from, editor.state.selection.to)
          }
        />
      )}
      
      {showFormatSelector && editor && (
        <FormatSelector 
          editor={editor} 
          onClose={() => setShowFormatSelector(false)} 
        />
      )}
    </>
  )
});

MenuBar.displayName = 'MenuBar';

//
const TiptapEditor: React.FC<TiptapEditorProps> = ({
  initialContent = '',
  onChange,
  editable = true,
  className = '',
  placeholder = '开始写作...',
  onSave,
  storyId,
  chapterId,
  chapterTitle = ''
}) => {
  const handleTabKey = useCallback((editor: Editor) => {
    console.log('自定义 Tab 处理函数被调用');
    
    try {
      editor.commands.insertContent('    ');
      return true;
    } catch (error) {
      console.error('方法 1 失败:', error);
    }
    
    try {
      const { state, view } = editor;
      const { tr } = state;
      const transaction = tr.insertText('    ', state.selection.from, state.selection.to);
      view.dispatch(transaction);
      return true;
    } catch (error) {
      console.error('方法 2 失败:', error);
    }
    
    try {
      editor.chain().focus().insertContent('    ').run();
      return true;
    } catch (error) {
      console.error('方法 3 失败:', error);
    }
    
    return false;
  }, []);
  

  // 添加图片输入引用
  const imageInputRef = useRef<HTMLInputElement>(null);
  
  

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        paragraph: {
          HTMLAttributes: {
            class: 'editor-paragraph',
            spellcheck: 'false',
          },
        },
        heading: {
          levels: [1, 2, 3],
          HTMLAttributes: {
            class: 'editor-heading',
            spellcheck: 'false',
          },
        },
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'editor-link',
          spellcheck: 'false',
        },
      }),
      Placeholder.configure({
        placeholder,
        showOnlyCurrent: false,
      }),
      TextAlign.configure({
        types: ['heading', 'paragraph'],
        alignments: ['left', 'center', 'right'],
        defaultAlignment: 'left',
      }),
      Underline.configure({
        HTMLAttributes: {
          class: 'editor-underline',
          spellcheck: 'false',
        },
      }),
      TextStyle,
      Color,
      FontSize,
      Indent,
      ImageExtension.configure({
        inline: true,
        allowBase64: false,
        HTMLAttributes: {
          class: 'chapter-image',
        },
      }),
      TabHandler,
      KeyboardShortcuts,
      FontFamily.configure({
        types: ['textStyle'],
      }),
    ],
    content: initialContent,
    editable,
    enablePasteRules: true,
    enableInputRules: true,
    onUpdate: ({ editor }) => {
      const html = editor.getHTML()
      console.log('编辑器内容更新:', html)
      onChange?.(html)
    },
    editorProps: {
      attributes: {
        spellcheck: 'false',
        autocorrect: 'off',
        autocapitalize: 'off',
      },
    },
  })

  useEffect(() => {
    if (editor) {
      editor.setEditable(editable)
    }
  }, [editor, editable])

  useEffect(() => {
    if (editor && initialContent !== editor.getHTML()) {
      console.log('更新编辑器内容:', initialContent)
      editor.commands.setContent(initialContent)
    }
  }, [editor, initialContent])

  // 添加全局键盘事件监听器
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 如果按下 Ctrl+S
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault(); // 阻止浏览器默认的保存行为
        if (onSave) {
          onSave();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onSave]);

  // 添加图片处理函数
  const handleImageSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    if (!editor || !event.target.files?.length) return;

    const file = event.target.files[0];
    
    // 验证文件类型和大小
    if (!file.type.startsWith('image/')) {
      toast.error('请选择图片文件');
      return;
    }

    // 验证文件大小（5MB）
    if (file.size > 5 * 1024 * 1024) {
      toast.error('图片大小不能超过5MB');
      return;
    }

    // 创建临时URL并插入图片
    const tempUrl = URL.createObjectURL(file);
    const imgElement = document.createElement('img');
    imgElement.onload = () => {
      const maxWidth = 800;
      let width = imgElement.naturalWidth;
      let height = imgElement.naturalHeight;

      if (width > maxWidth) {
        const ratio = maxWidth / width;
        width = maxWidth;
        height = Math.round(height * ratio);
      }

      editor.commands.setImage({ 
        src: tempUrl,
        alt: file.name,
        title: file.name,
        width,
        height
      });

      // 在组件卸载时清理临时URL
      window.addEventListener('beforeunload', () => {
        URL.revokeObjectURL(tempUrl);
      });
    };
    imgElement.src = tempUrl;

    // 清除input值，允许重复选择同一文件
    event.target.value = '';
  }, [editor]);

  if (!editor) {
    return null
  }

  return (
    <div className={styles.editor}>
      {editable && <MenuBar editor={editor} onImageClick={() => {}} onSave={onSave} onImageSelect={handleImageSelect} />}
      <div className={editable ? styles.content : styles.previewContent}>
        {!editable && chapterTitle && (
          <div className={styles.previewChapterTitle}>
            {chapterTitle}
          </div>
        )}
        <input
          ref={imageInputRef}
          type="file"
          accept="image/*"
          onChange={handleImageSelect}
          style={{ display: 'none' }}
        />
        <EditorContent 
          editor={editor} 
          spellCheck="false" 
          autoCorrect="off" 
          autoCapitalize="off"
          className={styles.preserveWhitespace}
          onKeyDown={(e) => {
            if (e.key === 'Tab') {
              e.preventDefault();
              if (editor) {
                const success = handleTabKey(editor);
                console.log('Tab 键处理结果:', success ? '成功' : '失败');
              }
            }
          }}
        />
        {editable && 
          <div className={styles.editorBottomBoundary}>
            文档结束
          </div>
        }
      </div>
    </div>
  )
}

export default TiptapEditor; 