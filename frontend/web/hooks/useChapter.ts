import { useState, useEffect } from 'react'
import type { Chapter } from '@/types/story'

// 模拟章节数据加载
const fetchChapter = async (storyId: string, chapterId: string): Promise<Chapter> => {
  // 这里模拟 API 调用
  await new Promise(resolve => setTimeout(resolve, 1000))
  
  return {
    id: parseInt(chapterId),
    title: `第${chapterId}章 示例章节`,
    order: parseInt(chapterId),
    wordCount: 3000,
    updateTime: new Date().toISOString(),
    content: [
      {
        type: 'text',
        content: '这是一个示例章节的开始。这里展示了如何通过内容块来组织章节内容，使其能够灵活地支持文本和图片的混排。'
      },
      {
        type: 'image',
        content: 'https://picsum.photos/800/400',
        caption: '这是一张配图示例',
        align: 'center'
      },
      {
        type: 'text',
        content: '在这个段落中，我们可以看到图文混排的效果。图片可以根据需要设置不同的对齐方式，文字会自动围绕图片进行排列。这种灵活的布局方式让内容呈现更加丰富多样。'
      },
      {
        type: 'image',
        content: 'https://picsum.photos/400/300',
        caption: '左对齐的图片示例',
        align: 'left'
      },
      {
        type: 'text',
        content: '这是另一个段落，用来演示更多的文本内容。当我们有大量文本时，需要确保段落之间有适当的间距，并且文字的大小、行高等都要适合阅读。另外，我们还需要考虑在不同设备上的显示效果，确保在手机等小屏幕设备上同样有良好的阅读体验。'
      }
    ]
  }
}

export function useChapter(storyId: string, chapterId: string) {
  const [chapter, setChapter] = useState<Chapter | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    let mounted = true

    const loadChapter = async () => {
      try {
        setLoading(true)
        setError(null)
        const data = await fetchChapter(storyId, chapterId)
        if (mounted) {
          setChapter(data)
        }
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err : new Error('Failed to load chapter'))
        }
      } finally {
        if (mounted) {
          setLoading(false)
        }
      }
    }

    loadChapter()

    return () => {
      mounted = false
    }
  }, [storyId, chapterId])

  return { chapter, loading, error }
} 