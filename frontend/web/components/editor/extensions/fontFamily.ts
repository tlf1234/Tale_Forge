import { Extension } from '@tiptap/core'

export interface FontFamilyOptions {
  types: string[]
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    fontFamily: {
      setFontFamily: (fontFamily: string) => ReturnType
      unsetFontFamily: () => ReturnType
    }
  }
}

// 获取字体对应的CSS类名
const getFontClass = (fontFamily: string): string => {
  if (!fontFamily) return '';
  
  // 清理掉引号和额外空格
  const cleanFont = fontFamily.replace(/['"]/g, '').trim();
  
  // 根据字体名称生成对应的类名
  if (cleanFont.includes('Arial')) return 'is-font-Arial';
  if (cleanFont.includes('Times New Roman') || cleanFont.includes('Times')) return 'is-font-Times';
  if (cleanFont.includes('微软雅黑') || cleanFont.includes('Microsoft YaHei')) return 'is-font-Microsoft';
  if (cleanFont.includes('宋体') || cleanFont.includes('SimSun')) return 'is-font-SimSun';
  if (cleanFont.includes('黑体') || cleanFont.includes('SimHei')) return 'is-font-SimHei';
  if (cleanFont.includes('楷体') || cleanFont.includes('KaiTi')) return 'is-font-KaiTi';
  if (cleanFont.includes('Courier New') || cleanFont.includes('Courier')) return 'is-font-Courier';
  if (cleanFont.includes('Georgia')) return 'is-font-Georgia';
  
  // 默认返回原始字体名作为类名
  return `is-font-${cleanFont.split(',')[0].replace(/[^a-zA-Z0-9]/g, '')}`;
};

export const FontFamily = Extension.create<FontFamilyOptions>({
  name: 'fontFamily',

  addOptions() {
    return {
      types: ['textStyle'],
    }
  },

  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          fontFamily: {
            default: null,
            parseHTML: element => element.style.fontFamily?.replace(/['"]/g, ''),
            renderHTML: attributes => {
              if (!attributes.fontFamily) {
                return {}
              }

              const fontClass = getFontClass(attributes.fontFamily);
              
              return {
                style: `font-family: ${attributes.fontFamily}`,
                class: fontClass,
              }
            },
          },
        },
      },
    ]
  },

  addCommands() {
    return {
      setFontFamily:
        (fontFamily: string) =>
        ({ chain }) => {
          return chain()
            .setMark('textStyle', { fontFamily })
            .run()
        },
      unsetFontFamily:
        () =>
        ({ chain }) => {
          return chain()
            .setMark('textStyle', { fontFamily: null })
            .removeEmptyTextStyle()
            .run()
        },
    }
  },
}) 