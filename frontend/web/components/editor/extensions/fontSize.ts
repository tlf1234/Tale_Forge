import { Extension } from '@tiptap/core'

export interface FontSizeOptions {
  types: string[]
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    fontSize: {
      /**
       * Set the font size
       */
      setFontSize: (size: number) => ReturnType
      /**
       * Unset the font size
       */
      unsetFontSize: () => ReturnType
    }
  }
}

// 添加CSS类
const getFontSizeClass = (fontSize: number): string => {
  return `is-font-size-${fontSize}`;
};

export const FontSize = Extension.create<FontSizeOptions>({
  name: 'fontSize',

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
          fontSize: {
            default: null,
            parseHTML: element => element.style.fontSize?.replace(/[^\d]/g, ''),
            renderHTML: attributes => {
              if (!attributes.fontSize) {
                return {}
              }

              const size = attributes.fontSize;
              const fontSizeClass = getFontSizeClass(size);
              
              return {
                style: `font-size: ${size}px`,
                class: fontSizeClass,
              }
            },
          },
        },
      },
    ]
  },

  addCommands() {
    return {
      setFontSize: (size: number) => ({ chain }) => {
        return chain()
          .setMark('textStyle', { fontSize: size })
          .run()
      },
      unsetFontSize: () => ({ chain }) => {
        return chain()
          .setMark('textStyle', { fontSize: null })
          .removeEmptyTextStyle()
          .run()
      },
    }
  },
}) 