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

// 字数统计组件
const WordCount = memo(({ editor }: { editor: Editor | null }) => {
  const [wordCount, setWordCount] = useState(0);

  useEffect(() => {
    if (!editor) return;

    // 更新字数的函数
    const updateWordCount = () => {
      const text = editor.getText();
      const count = text.replace(/\s+/g, '').length;
      setWordCount(count);
    };

    // 初始计算
    updateWordCount();

    // 监听编辑器内容变化
    editor.on('update', updateWordCount);

    return () => {
      editor.off('update', updateWordCount);
    };
  }, [editor]);

  return (
    <div className={styles.wordCount}>
      <span>{wordCount} 字</span>
    </div>
  );
});

WordCount.displayName = 'WordCount';

// 工具栏组件
const MenuBar = memo(({ editor, onImageClick }: { editor: Editor | null, onImageClick: () => void }) => {
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
        <WordCount editor={editor} />
        <button
          onClick={() => {/* TODO: 实现保存功能 */}}
          title="保存"
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

  if (!editor) {
    return null
  }

  return (
    <div className={styles.editor}>
      {editable && <MenuBar editor={editor} onImageClick={() => {}} />}
      <div className={editable ? styles.content : styles.previewContent}>
        <EditorContent 
          editor={editor} 
          spellCheck="false" 
          autoCorrect="off" 
          autoCapitalize="off" 
        />
      </div>
    </div>
  )
}

export default TiptapEditor; 