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
import { AutoFormatter } from '@/utils/autoFormat'
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
} from 'react-icons/fa'
import styles from './TiptapEditor.module.css'
import { ImageExtension } from './extensions/ImageExtension'
import ImageResizer from './components/ImageResizer'
import { TiptapEditorProps } from './types'

// 添加自定义字体大小扩展
declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    fontSize: {
      setFontSize: (size: number) => ReturnType;
    };
  }
}

// 添加自定义缩进扩展
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

// 工具栏组件
const MenuBar = memo(({ editor, onImageClick, onSave }: { editor: Editor | null, onImageClick: () => void, onSave?: () => void }) => {
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showFontSize, setShowFontSize] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const addLink = useCallback(() => {
    if (!editor) return;
    const url = window.prompt('输入链接URL:')
    if (url) {
      editor.chain().focus().setLink({ href: url }).run()
    }
  }, [editor]);

  const setFontSize = useCallback((size: number) => {
    if (!editor) return;
    editor.chain().focus().setMark('textStyle', { fontSize: `${size}px` }).run();
  }, [editor]);

  const setColor = useCallback((color: string) => {
    if (!editor) return;
    editor.chain().focus().setColor(color).run();
  }, [editor]);

  const handleAutoFormat = useCallback(() => {
    if (!editor) return;
    const content = editor.getHTML();
    const formatted = AutoFormatter.format(content);
    editor.commands.setContent(formatted);
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

  // 添加插入缩进的函数
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

  if (!editor) return null;

  return (
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
          onClick={handleAutoFormat}
          title="自动排版"
          className={styles.formatButton}
        >
          <FaMagic />
        </button>
      </div>

      <div className={styles.divider} />

      <div className={styles.toolGroup}>
        <button
          onClick={() => setShowFontSize(!showFontSize)}
          title="字号"
        >
          <FaFont />
        </button>
        {showFontSize && (
          <div className={styles.dropdown}>
            {[12, 14, 16, 18, 20, 24, 28, 32].map(size => (
              <button
                key={size}
                onClick={() => setFontSize(size)}
                className={styles.dropdownItem}
              >
                {size}px
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

      <div className={styles.divider} />

      <div className={styles.toolGroup}>
        <button
          onClick={() => setShowSettings(!showSettings)}
          title="设置"
          className={styles.settingsButton}
        >
          <FaCog />
        </button>
      </div>

      <div className={styles.rightTools}>
        <button
          onClick={handleSave}
          title="保存 (Ctrl+S)"
          className={styles.saveButton}
        >
          <FaSave />
        </button>
      </div>
    </div>
  )
});

MenuBar.displayName = 'MenuBar';

const TiptapEditor: React.FC<TiptapEditorProps> = ({
  initialContent = '',
  onChange,
  editable = true,
  className = '',
  placeholder = '开始写作...',
  onSave
}) => {
  // 添加自定义的 Tab 处理函数
  const handleTabKey = useCallback((editor: Editor) => {
    console.log('自定义 Tab 处理函数被调用');
    
    // 方法 1: 使用 insertContent
    try {
      editor.commands.insertContent('    ');
      return true;
    } catch (error) {
      console.error('方法 1 失败:', error);
    }
    
    // 方法 2: 使用 insertText
    try {
      const { state, view } = editor;
      const { tr } = state;
      const transaction = tr.insertText('    ', state.selection.from, state.selection.to);
      view.dispatch(transaction);
      return true;
    } catch (error) {
      console.error('方法 2 失败:', error);
    }
    
    // 方法 3: 使用 chain
    try {
      editor.chain().focus().insertContent('    ').run();
      return true;
    } catch (error) {
      console.error('方法 3 失败:', error);
    }
    
    return false;
  }, []);
  
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
      ImageExtension,
      TabHandler,
      KeyboardShortcuts,
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

  // 监听 editable 属性变化
  useEffect(() => {
    if (editor) {
      editor.setEditable(editable)
    }
  }, [editor, editable])

  // 监听 initialContent 变化
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

  if (!editor) {
    return null
  }

  return (
    <div className={styles.editor}>
      {editable && <MenuBar editor={editor} onImageClick={() => {}} onSave={onSave} />}
      <div className={editable ? styles.content : styles.previewContent}>
        <EditorContent 
          editor={editor} 
          spellCheck="false" 
          autoCorrect="off" 
          autoCapitalize="off"
          className={styles.preserveWhitespace}
          onKeyDown={(e) => {
            // 处理 Tab 键
            if (e.key === 'Tab') {
              e.preventDefault(); // 阻止默认行为
              console.log('Tab 键被按下，调用自定义处理函数');
              
              if (editor) {
                const success = handleTabKey(editor);
                console.log('Tab 键处理结果:', success ? '成功' : '失败');
              } else {
                console.error('编辑器实例不存在');
              }
            }
          }}
        />
      </div>
    </div>
  )
}

export default TiptapEditor; 