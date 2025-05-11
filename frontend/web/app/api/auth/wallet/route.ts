import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const data = await request.json()
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/wallet`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })
    
    return NextResponse.json(await response.json(), {
      status: response.status
    })
  } catch (error) {
    console.error('Wallet auth error:', error)
    return NextResponse.json(
      { error: 'Wallet authentication failed' },
      { status: 500 }
    )
  }
} 