import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// 故事保存到数据库
export async function POST(req: NextRequest) {
    try {
      const {
        title,
        description,
        content,
        coverImage,
        authorAddress,
        contentCid,
        coverCid,
        category,
        tags,
        targetWordCount
      } = await req.json()


      // 验证必填字段
      if (!title || !authorAddress) {
        return NextResponse.json({ error: '缺少必要字段' }, { status: 400 })
      }
  
      console.log('保存数据到数据库...')
      // 调用数据库保存API
      const finalizeResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/stories/finalize`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            title,
            description,
            content,
            coverImage,
            authorAddress,
            contentCid,
            coverCid,
            category,
            tags,
            targetWordCount
        })
      })
  
      if (!finalizeResponse.ok) {
        const finalizeError = await finalizeResponse.json()
        return NextResponse.json({ 
          error: finalizeError.message || '数据库保存失败',
          details: finalizeError
        }, { status: finalizeResponse.status })
      }
  
      const finalizeData = await finalizeResponse.json()
      console.log('保存数据成功')
  
      return NextResponse.json({ 
        success: true,
        story: finalizeData.story
      })
  
    } catch (error: any) {
      console.error('数据库保存失败:', error)
      return NextResponse.json({ 
        error: '服务器错误，请稍后重试',
        details: error.message 
      }, { status: 500 })
    }
  }
  