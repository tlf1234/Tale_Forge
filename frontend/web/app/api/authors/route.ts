import { NextResponse } from 'next/server'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const response = await fetch(`${API_BASE_URL}/api/authors?${searchParams}`)
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.message || 'API request failed')
    }
    return NextResponse.json(await response.json())
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch authors: ' + (error as Error).message },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const data = await request.json()
    const response = await fetch(`${API_BASE_URL}/api/authors`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.message || 'API request failed')
    }
    return NextResponse.json(await response.json())
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to create/update author: ' + (error as Error).message },
      { status: 500 }
    )
  }
}
