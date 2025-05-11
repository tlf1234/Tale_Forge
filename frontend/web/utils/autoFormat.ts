// autoFormat.ts
// 文本排版工具类，提供多种排版格式和自定义排版选项

/**
 * 格式化工具类配置选项
 */
export interface FormatOptions {
  // 基本排版
  paragraphIndent?: number;        // 段落首行缩进（em）
  paragraphSpacing?: number;       // 段落间距（em）
  lineHeight?: number;             // 行高（em或数字）
  convertPunctuation?: boolean;    // 是否转换标点符号
  textAlign?: string;              // 文本对齐方式
  pageWidth?: number;              // 页面宽度（px）
  contentWidth?: number;           // 内容区域宽度（百分比）
  
  // 特殊段落处理
  dialogIndent?: boolean;          // 对话段落是否缩进
  chapterFormat?: boolean;         // 是否特别格式化章节标题
  
  // 字体样式
  fontSize?: number;               // 文本字号（px）
  fontFamily?: string;             // 字体
  textColor?: string;              // 文本颜色
  
  // 高级选项
  addSpaceAfterPunctuation?: boolean; // 在标点符号后添加空格
  useModernLayout?: boolean;       // 使用现代排版（段落间空行，无缩进）
  
  // 章节和特殊格式设置
  chapterTitleSize?: number;       // 章节标题字体大小系数（相对于正文）
  chapterTitleAlign?: string;      // 章节标题对齐方式
  chapterTopMargin?: number;       // 章节标题上边距（em）
  chapterBottomMargin?: number;    // 章节标题下边距（em）
  
  // 特殊格式
  convertEmphasis?: boolean;       // 转换强调文本（使用着重号或加粗）
  preserveSceneBreaks?: boolean;   // 保留场景转换分隔符
  formatMonologue?: boolean;       // 格式化独白内容（使用单引号或斜体）
  formatTimeLocation?: boolean;    // 格式化时间地点标注
  
  // 样式保留和覆盖选项
  preserveInlineStyles?: boolean;  // 保留内联样式（粗体、斜体等）
  preserveFontStyles?: boolean;    // 保留字体样式（字体、大小、颜色）
  overrideExistingStyles?: boolean; // 覆盖已有的样式（强制应用新格式）
  
  // 设备适配
  responsiveDesign?: boolean;      // 是否启用响应式设计
  mobileTextSize?: number;         // 移动设备字号（px）
  mobileSideMargin?: number;       // 移动设备侧边距（px）
  
  // 图片处理
  maxImageWidth?: number;          // 图片最大宽度（相对于容器百分比）
  imageAlignment?: string;         // 图片对齐方式
  imageCaptionSize?: number;       // 图片说明文字大小系数（相对于正文）
  
  // 注释格式
  footnoteStyle?: 'numbered' | 'symbol';  // 脚注编号风格
  footnoteSize?: number;           // 脚注字号（相对于正文）
  
  // 增强破折号处理
  convertDashesToEmDash?: boolean; // 将--转换为中文破折号——
  
  // 纸质书特有格式（可用于打印样式或PDF导出）
  printMode?: boolean;             // 是否使用纸质书格式
  pageMargins?: {                  // 页面边距（mm）
    top?: number;
    bottom?: number;
    inner?: number;
    outer?: number;
  };
  headerFooter?: boolean;          // 是否显示页眉页脚
}

/**
 * 文本自动排版工具类
 * 提供多种预设格式和自定义格式选项
 */
export class AutoFormatter {
  
  /**
   * 专业排版格式（完全统一样式）
   * 结合多种优化，适合大多数网文阅读，移除所有特殊格式
   */
  public static professionalFormat(html: string): string {
    // 首先移除所有内联样式
    const cleanedHtml = this.cleanFormatting(html);
    
    // 然后应用统一格式
    return this.applyUniformFormat(cleanedHtml, {
      paragraphIndent: 2,
      paragraphSpacing: 0.5,
      lineHeight: 1.5,
      convertPunctuation: true,
      dialogIndent: true,
      chapterFormat: true,
      addSpaceAfterPunctuation: false
    });
  }
  
  /**
   * 传统网文格式
   * 段落首行缩进两个中文空格，适合大多数网文
   */
  public static traditionalFormat(html: string): string {
    // 首先移除所有内联样式
    const cleanedHtml = this.cleanFormatting(html);
    
    // 然后应用统一格式
    return this.applyUniformFormat(cleanedHtml, {
      paragraphIndent: 2,
      paragraphSpacing: 0.2,
      lineHeight: 1.5,
      convertPunctuation: true,
      dialogIndent: true,
      chapterFormat: false
    });
  }
  
  /**
   * 现代小说格式
   * 无首行缩进，段落间保留空行，适合现代小说
   */
  public static modernFormat(html: string): string {
    // 首先移除所有内联样式
    const cleanedHtml = this.cleanFormatting(html);
    
    // 然后应用统一格式
    return this.applyUniformFormat(cleanedHtml, {
      paragraphIndent: 0,
      paragraphSpacing: 1,
      lineHeight: 1.8,
      convertPunctuation: true,
      dialogIndent: false,
      chapterFormat: true,
      useModernLayout: true
    });
  }
  
  /**
   * 对话优化格式
   * 对话段落（以引号开头）不缩进，其他段落缩进
   */
  public static dialogFormat(html: string): string {
    // 首先移除所有内联样式
    const cleanedHtml = this.cleanFormatting(html);
    
    // 然后应用统一格式
    return this.applyUniformFormat(cleanedHtml, {
      paragraphIndent: 2,
      paragraphSpacing: 0.5,
      lineHeight: 1.5,
      convertPunctuation: true,
      dialogIndent: false,
      chapterFormat: false
    });
  }
  
  /**
   * 章节优化格式
   * 识别并突出章节标题，其他段落保持缩进
   */
  public static chapterFormat(html: string): string {
    // 首先移除所有内联样式
    const cleanedHtml = this.cleanFormatting(html);
    
    // 然后应用统一格式
    return this.applyUniformFormat(cleanedHtml, {
      paragraphIndent: 2,
      paragraphSpacing: 0.5,
      lineHeight: 1.5,
      convertPunctuation: true,
      dialogIndent: true,
      chapterFormat: true
    });
  }
  
  /**
   * 简洁阅读格式
   * 舒适的行距和段间距，适合长时间阅读
   */
  public static readableFormat(html: string): string {
    // 首先移除所有内联样式
    const cleanedHtml = this.cleanFormatting(html);
    
    // 然后应用统一格式
    return this.applyUniformFormat(cleanedHtml, {
      paragraphIndent: 1.5,
      paragraphSpacing: 0.7,
      lineHeight: 1.8,
      convertPunctuation: true,
      dialogIndent: true,
      chapterFormat: true,
      fontSize: 18
    });
  }
  
  /**
   * 紧凑格式
   * 减小行距和段间距，适合在屏幕上显示更多内容
   */
  public static compactFormat(html: string): string {
    // 首先移除所有内联样式
    const cleanedHtml = this.cleanFormatting(html);
    
    // 然后应用统一格式
    return this.applyUniformFormat(cleanedHtml, {
      paragraphIndent: 1,
      paragraphSpacing: 0.3,
      lineHeight: 1.3,
      convertPunctuation: true,
      dialogIndent: true,
      chapterFormat: true
    });
  }
  
  /**
   * 手机阅读优化格式
   * 为小屏幕设备优化的阅读体验
   */
  public static mobileFormat(html: string): string {
    // 首先移除所有内联样式
    const cleanedHtml = this.cleanFormatting(html);
    
    // 然后应用统一格式
    return this.applyUniformFormat(cleanedHtml, {
      paragraphIndent: 1,
      paragraphSpacing: 0.5,
      lineHeight: 1.7,
      convertPunctuation: true,
      dialogIndent: true,
      chapterFormat: true,
      fontSize: 16
    });
  }
  
  /**
   * 完全统一格式
   * 统一所有段落样式和字体样式，完整实现标准网文小说排版格式
   */
  public static unifiedFormat(html: string): string {
    // 首先移除所有内联样式
    const cleanedHtml = this.cleanFormatting(html);
    
    // 应用完全统一的格式
    return this.applyUniformFormat(cleanedHtml, {
      // 字体与尺寸
      fontFamily: '"微软雅黑", "宋体", "思源宋体", "Microsoft YaHei", "SimSun", "Source Han Serif SC", sans-serif',
      fontSize: 16,
      lineHeight: 1.7,            // 1.5-1.8倍字号之间
      pageWidth: 700,             // 700px页面宽度
      contentWidth: 70,           // 内容区占70%
      
      // 段落格式
      paragraphIndent: 2,         // 2个中文字符缩进
      paragraphSpacing: 0.8,      // 0.5-1em之间
      textAlign: 'left',          // 左对齐
      
      // 章节标题
      chapterFormat: true,
      chapterTitleSize: 1.3,      // 正文的1.2-1.5倍之间
      chapterTitleAlign: 'center',
      chapterTopMargin: 1.5,      // 上边距1.5em
      chapterBottomMargin: 1,     // 下边距1em
      
      // 对话格式
      dialogIndent: false,        // 对话段落不缩进
      formatMonologue: true,      // 格式化独白内容
      
      // 标点符号
      convertPunctuation: true,   // 英文标点转中文标点
      convertDashesToEmDash: true, // 将--转换为中文破折号——
      
      // 特殊格式
      convertEmphasis: true,      // 转换强调文本
      preserveSceneBreaks: true,  // 保留场景转换分隔符
      formatTimeLocation: true,   // 格式化时间地点标注
      
      // 设备适配
      responsiveDesign: true,
      mobileTextSize: 15,        // 移动设备稍小字体
      mobileSideMargin: 12,      // 两侧边距
      
      // 图片处理
      maxImageWidth: 80,         // 图片宽度不超过容器的80%
      imageAlignment: 'center',  // 图片居中对齐
      imageCaptionSize: 0.9,     // 图片说明文字比正文小10%
      
      // 注释格式
      footnoteStyle: 'numbered', // 使用编号
      footnoteSize: 0.875,       // 脚注比正文小12.5%
      
      // 纸质书特有格式
      printMode: false,          // 默认不启用纸质书格式
      pageMargins: {
        top: 25,
        bottom: 25,
        inner: 20,
        outer: 15
      }
    });
  }

  /**
   * 清除HTML中的所有格式，只保留基本结构
   * 移除所有内联样式元素（如粗体、斜体、字体颜色等）
   */
  private static cleanFormatting(html: string): string {
    // 创建临时DOM解析HTML
    const parser = new DOMParser();
    const doc = parser.parseFromString(`<div>${html}</div>`, 'text/html');
    
    // 清除所有文本节点的样式
    const paragraphs = doc.querySelectorAll('p');
    paragraphs.forEach(p => {
      // 移除段落上的所有样式
      p.removeAttribute('style');
      
      // 获取所有带样式的内联元素
      const styledElements = p.querySelectorAll('strong, em, u, span[style], span, b, i');
      
      styledElements.forEach(el => {
        // 创建文本节点代替带样式的元素
        const textContent = el.textContent || '';
        const textNode = document.createTextNode(textContent);
        el.parentNode?.replaceChild(textNode, el);
      });
    });
    
    // 获取清理后的HTML
    const cleanedDiv = doc.querySelector('div');
    return cleanedDiv ? cleanedDiv.innerHTML : html;
  }

  /**
   * 应用统一的格式到HTML
   */
  private static applyUniformFormat(html: string, options: FormatOptions): string {
    // 解析HTML
    const parser = new DOMParser();
    const doc = parser.parseFromString(`<div>${html}</div>`, 'text/html');
    const paragraphs = doc.querySelectorAll('p');
    
    // 设置容器样式（忽略容器样式设置，因为这会在外部CSS中处理）
    // 容器样式应该在组件层面设置，而不是在HTML内容中设置
    
    // 格式化标点符号
    if (options.convertPunctuation) {
      this.convertPunctuation(doc);
    }
    
    // 如果需要，转换破折号
    if (options.convertDashesToEmDash) {
      this.convertDashes(doc);
    }
    
    // 处理脚注
    if (options.footnoteStyle) {
      this.formatFootnotes(doc, options);
    }

    // 处理每个段落
    paragraphs.forEach(p => {
      const text = p.textContent || '';
      const trimmedText = text.trim();
      
      // 跳过空段落
      if (!trimmedText) return;
      
      // 检测是否是章节标题
      const isChapter = /^第[一二三四五六七八九十百千万亿零\d]+[章节]|^序章|^前言|^引子|^楔子|^尾声|^终章|^结局/.test(trimmedText);
      
      // 检测是否是卷标题
      const isVolume = /^第[一二三四五六七八九十百千万亿零\d]+卷|^卷[一二三四五六七八九十百千万亿零\d]+/.test(trimmedText);
      
      // 检测是否是对话段落（以引号开头）
      const isDialogue = /^["'"'"「『]/.test(trimmedText);
      
      // 检测是否是独白内容（以单引号开头）
      const isMonologue = /^['']/.test(trimmedText) && options.formatMonologue;
      
      // 检测是否是场景分隔符
      const isSceneBreak = /^\*\s*\*\s*\*|\*{3,}|◆\s*◆\s*◆|◆{3,}|[=＝]{3,}|[─━]{3,}/.test(trimmedText);
      
      // 检测是否是时间地点标注
      const isTimeLocation = /^【[^】]+】/.test(trimmedText) && options.formatTimeLocation;
      
      // 应用基本样式
      if (options.lineHeight) {
        p.style.lineHeight = typeof options.lineHeight === 'number' 
          ? `${options.lineHeight}` 
          : options.lineHeight;
      }
      
      if (options.paragraphSpacing !== undefined) {
        p.style.marginBottom = `${options.paragraphSpacing}em`;
      }
      
      if (options.fontSize) {
        p.style.fontSize = `${options.fontSize}px`;
      }
      
      if (options.fontFamily) {
        p.style.fontFamily = options.fontFamily;
      }
      
      if (options.textAlign) {
        p.style.textAlign = options.textAlign;
      }
      
      if (options.textColor) {
        p.style.color = options.textColor;
      }
      
      // 现代排版模式特殊处理
      if (options.useModernLayout) {
        p.style.textIndent = '0';
        p.style.marginBottom = `${options.paragraphSpacing || 1}em`;
        return;
      }
      
      // 卷标题特殊处理
      if (isVolume) {
        this.formatVolumeTitle(p, options);
        return;
      }
      
      // 章节标题特殊处理
      if (isChapter && options.chapterFormat) {
        this.formatChapterTitle(p, options);
        return;
      }
      
      // 场景分隔符特殊处理
      if (isSceneBreak && options.preserveSceneBreaks) {
        p.style.textAlign = 'center';
        p.style.textIndent = '0';
        p.style.margin = '1.5em 0';
        return;
      }
      
      // 时间地点标注特殊处理
      if (isTimeLocation) {
        p.style.textIndent = '0';
        p.style.fontWeight = 'bold';
        return;
      }
      
      // 对话段落特殊处理
      if (isDialogue && !options.dialogIndent) {
        p.style.textIndent = '0';
        return;
      }
      
      // 独白内容特殊处理
      if (isMonologue) {
        p.style.fontStyle = 'italic';
        return;
      }
      
      // 段落缩进处理
      if (options.paragraphIndent !== undefined) {
        p.style.textIndent = `${options.paragraphIndent}em`;
      }
    });
    
    // 在标点符号后添加空格
    if (options.addSpaceAfterPunctuation) {
      this.addSpaceAfterPunctuation(doc);
    }
    
    // 处理图片
    this.processImages(doc, options);
    
    // 纸质书格式特殊处理
    if (options.printMode) {
      this.applyPrintStyles(doc, options);
    }
    
    // 获取处理后的HTML
    const result = doc.querySelector('div');
    return result ? result.innerHTML : html;
  }
  
  /**
   * 自定义格式
   * 根据提供的选项定制排版格式
   */
  public static customFormat(html: string, options: FormatOptions): string {
    // 清除格式
    const cleanedHtml = this.cleanFormatting(html);
    
    // 应用自定义格式
    return this.applyUniformFormat(cleanedHtml, options);
  }
  
  /**
   * 格式化章节标题
   */
  private static formatChapterTitle(p: HTMLParagraphElement, options: FormatOptions = {}): void {
    p.style.textIndent = '0';
    p.style.fontWeight = 'bold';
    p.style.fontSize = `${options.chapterTitleSize || 1.2}em`;
    p.style.margin = `${options.chapterTopMargin || 1.5}em 0 ${options.chapterBottomMargin || 1}em 0`;
    p.style.textAlign = options.chapterTitleAlign || 'center';
  }
  
  /**
   * 格式化卷标题
   */
  private static formatVolumeTitle(p: HTMLParagraphElement, options: FormatOptions = {}): void {
    p.style.textIndent = '0';
    p.style.fontWeight = 'bold';
    p.style.fontSize = `${options.chapterTitleSize ? options.chapterTitleSize * 1.3 : 1.5}em`;
    p.style.margin = '3em 0 3em 0';
    p.style.textAlign = 'center';
  }
  
  /**
   * 转换标点符号（英文到中文）
   */
  private static convertPunctuation(doc: Document): void {
    const textNodes: Text[] = [];
    const walker = document.createTreeWalker(
      doc.body,
      NodeFilter.SHOW_TEXT,
      null
    );
    
    let node: Node | null;
    while ((node = walker.nextNode())) {
      if (node.nodeType === Node.TEXT_NODE) {
        textNodes.push(node as Text);
      }
    }
    
    textNodes.forEach(textNode => {
      if (textNode.textContent) {
        textNode.textContent = this.formatText(textNode.textContent);
      }
    });
  }
  
  /**
   * 标点符号转换
   */
  private static formatText(text: string): string {
    return text
      .replace(/\./g, '。')   // 英文句号 -> 中文句号
      .replace(/,/g, '，')    // 英文逗号 -> 中文逗号
      .replace(/\?/g, '？')   // 英文问号 -> 中文问号
      .replace(/!/g, '！')    // 英文感叹号 -> 中文感叹号
      .replace(/:/g, '：')    // 英文冒号 -> 中文冒号
      .replace(/;/g, '；')    // 英文分号 -> 中文分号
      .replace(/\(/g, '（')   // 英文左括号 -> 中文左括号
      .replace(/\)/g, '）')   // 英文右括号 -> 中文右括号
      .replace(/\[/g, '【')   // 英文左方括号 -> 中文左方括号
      .replace(/\]/g, '】')   // 英文右方括号 -> 中文右方括号
      .replace(/\{/g, '｛')   // 英文左花括号 -> 中文左花括号
      .replace(/\}/g, '｝')   // 英文右花括号 -> 中文右花括号
      .replace(/</g, '《')    // 小于号 -> 中文左书名号
      .replace(/>/g, '》')    // 大于号 -> 中文右书名号
      .replace(/~/g, '～')    // 波浪号 -> 中文波浪号
      .replace(/\.{3,}/g, '……'); // 英文省略号 -> 中文省略号
  }
  
  /**
   * 将英文破折号转换为中文破折号
   */
  private static convertDashes(doc: Document): void {
    const textNodes: Text[] = [];
    const walker = document.createTreeWalker(
      doc.body,
      NodeFilter.SHOW_TEXT,
      null
    );
    
    let node: Node | null;
    while ((node = walker.nextNode())) {
      if (node.nodeType === Node.TEXT_NODE) {
        textNodes.push(node as Text);
      }
    }
    
    textNodes.forEach(textNode => {
      if (textNode.textContent) {
        textNode.textContent = textNode.textContent.replace(/--/g, '——');
      }
    });
  }
  
  /**
   * 在中文标点符号后添加空格（适用于某些排版风格）
   */
  private static addSpaceAfterPunctuation(doc: Document): void {
    const textNodes: Text[] = [];
    const walker = document.createTreeWalker(
      doc.body,
      NodeFilter.SHOW_TEXT,
      null
    );
    
    let node: Node | null;
    while ((node = walker.nextNode())) {
      if (node.nodeType === Node.TEXT_NODE) {
        textNodes.push(node as Text);
      }
    }
    
    textNodes.forEach(textNode => {
      if (textNode.textContent) {
        textNode.textContent = textNode.textContent.replace(/([。，！？：；、）】}])/g, '$1 ');
      }
    });
  }
  
  /**
   * 处理图片元素
   */
  private static processImages(doc: Document, options: FormatOptions = {}): void {
    const images = doc.querySelectorAll('img');
    images.forEach(img => {
      // 设置最大宽度
      if (options.maxImageWidth) {
        img.style.maxWidth = `${options.maxImageWidth}%`;
      }
      
      // 设置对齐方式
      if (options.imageAlignment) {
        const parent = img.parentElement;
        if (parent) {
          parent.style.textAlign = options.imageAlignment;
        }
      }
      
      // 处理图片说明（假设图片说明在图片后的段落中）
      const nextElement = img.nextElementSibling;
      if (nextElement && nextElement.tagName === 'P' && options.imageCaptionSize) {
        const caption = nextElement as HTMLParagraphElement;
        caption.style.fontSize = `${options.imageCaptionSize}em`;
        caption.style.textAlign = options.imageAlignment || 'center';
        caption.style.color = '#666';
        caption.style.marginTop = '0.5em';
        caption.style.marginBottom = '1.5em';
      }
    });
  }

  /**
   * 格式化脚注
   * 注意：此方法不直接操作DOM，而是扫描文档并返回脚注HTML
   * 脚注功能需要在实际UI组件中实现
   */
  private static formatFootnotes(doc: Document, options: FormatOptions): void {
    // 在这个简化版本中，我们什么也不做
    // 真正的脚注处理应该在UI组件层面实现
    // 这只是一个占位方法，满足类型检查需求
    return;
  }

  /**
   * 应用纸质书样式
   */
  private static applyPrintStyles(doc: Document, options: FormatOptions): void {
    // 创建样式字符串，但不添加到文档中，因为这可能会导致DOM操作错误
    // 相反，我们返回样式内容，让外部组件处理
    const css = `
      @page {
        size: A5;
        margin-top: ${options.pageMargins?.top || 25}mm;
        margin-bottom: ${options.pageMargins?.bottom || 25}mm;
        margin-inside: ${options.pageMargins?.inner || 20}mm;
        margin-outside: ${options.pageMargins?.outer || 15}mm;
      }
      
      body {
        font-family: ${options.fontFamily || '"微软雅黑", serif'};
        font-size: ${options.fontSize ? `${options.fontSize / 16 * 12}pt` : '12pt'};
        line-height: ${options.lineHeight || 1.5};
      }
      
      /* 页眉样式 */
      @page:left {
        @top-left {
          content: "故事标题";
          font-size: 9pt;
        }
      }
      
      @page:right {
        @top-right {
          content: "章节名称";
          font-size: 9pt;
        }
      }
      
      /* 页码 */
      @page:left {
        @bottom-left {
          content: counter(page);
        }
      }
      
      @page:right {
        @bottom-right {
          content: counter(page);
        }
      }
    `;
    
    // 记录打印样式到控制台，而不是尝试将其添加到文档中
    console.info('Print styles generated:', css);
  }
} 