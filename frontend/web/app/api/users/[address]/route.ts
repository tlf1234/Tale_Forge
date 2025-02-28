import { NextResponse } from 'next/server'

export async function GET(
  request: Request,
  { params }: { params: { address: string } }
) {
  try {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/api/users/${params.address}`
    )
    return NextResponse.json(await response.json())
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch user' }, { status: 500 })
  }
}

export async function PUT(
  request: Request,
  { params }: { params: { address: string } }
) {
  try {
    const data = await request.json()
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/api/users/${params.address}`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      }
    )
    return NextResponse.json(await response.json())
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update user' }, { status: 500 })
  }
} 