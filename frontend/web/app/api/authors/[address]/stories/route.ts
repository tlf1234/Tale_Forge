import { NextResponse } from 'next/server'


// 获取指定作者的故事
export async function GET(request: Request, { params }: { params: { address: string } }) {
  try {
    const { searchParams } = new URL(request.url)
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/api/authors/${params.address}/stories?${searchParams}`
    )
    return NextResponse.json(await response.json())
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch author stories' }, { status: 500 })
  }
}
