import { NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export async function GET(
  request: Request,
  { params }: { params: { address: string } }
) {
  try {
    const author = await prisma.user.findUnique({
      where: { address: params.address },
    })

    if (!author) {
      return NextResponse.json(
        { error: 'Author not found' },
        { status: 404 }
      )
    }

    const stories = await prisma.story.findMany({
      where: { authorId: author.id },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ stories })
  } catch (error) {
    console.error('Failed to fetch author stories:', error)
    return NextResponse.json(
      { error: 'Failed to fetch author stories' },
      { status: 500 }
    )
  } finally {
    await prisma.$disconnect()
  }
}
