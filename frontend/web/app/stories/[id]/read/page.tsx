import React from 'react'
import ReadContent from '@/components/story/ReadContent'

interface Props {
  params: {
    id: string
  }
}

export default function ReadPage({ params }: Props) {
  return <ReadContent id={params.id} />
} 