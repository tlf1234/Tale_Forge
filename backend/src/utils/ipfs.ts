import { create } from 'ipfs-http-client'

const ipfs = create({ url: process.env.IPFS_URL || 'http://localhost:5001' })

export async function uploadToIPFS(content: string | Buffer): Promise<string> {
  const result = await ipfs.add(content)
  return result.path
}

export async function getFromIPFS(cid: string): Promise<string> {
  const chunks = []
  for await (const chunk of ipfs.cat(cid)) {
    chunks.push(chunk)
  }
  return Buffer.concat(chunks).toString()
} 