import pinataSDK from '@pinata/sdk'
import { createReadStream } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { writeFileSync } from 'fs'

// IPFS 配置
const PINATA_API_KEY = 'e59735cad0f789ddf9e4'
const PINATA_API_SECRET = '0b5d14068a99c5aa9774eb3574d753f8b1da803a58b4347b515b9d61afd84a8d'
const IPFS_GATEWAY = 'https://gateway.pinata.cloud/ipfs'

// 创建 Pinata 客户端
const pinata = new pinataSDK(PINATA_API_KEY, PINATA_API_SECRET)

/**
 * 上传内容到 IPFS
 * @param content 要上传的内容
 * @returns CID
 */
export async function uploadToIPFS(content: string | Buffer): Promise<string> {
  try {
    // 创建临时文件
    const tempPath = join(tmpdir(), `ipfs-${Date.now()}.txt`)
    writeFileSync(tempPath, content)

    const readableStreamForFile = createReadStream(tempPath)
    const options = {
      pinataMetadata: {
        name: `TaleForge-${Date.now()}`
      }
    }
    const result = await pinata.pinFileToIPFS(readableStreamForFile, options)
    return result.IpfsHash
  } catch (error) {
    console.error('Failed to upload to IPFS:', error)
    throw error
  }
}

/**
 * 从 IPFS 获取内容
 * @param cid 内容ID
 * @returns 内容
 */
export async function getFromIPFS(cid: string): Promise<string> {
  try {
    const response = await fetch(`${IPFS_GATEWAY}/${cid}`)
    return await response.text()
  } catch (error) {
    console.error('Failed to get from IPFS:', error)
    throw error
  }
}

/**
 * 获取 IPFS URL
 * @param cid 内容ID
 * @returns URL
 */
export function getIPFSUrl(cid: string): string {
  return `${IPFS_GATEWAY}/${cid}`
}

/**
 * 上传图片到 IPFS
 * @param file 图片文件
 * @returns CID
 */
export async function uploadImageToIPFS(file: File): Promise<string> {
  try {
    const buffer = await file.arrayBuffer()
    const tempPath = join(tmpdir(), `ipfs-${Date.now()}.bin`)
    writeFileSync(tempPath, Buffer.from(buffer))

    const readableStreamForFile = createReadStream(tempPath)
    const options = {
      pinataMetadata: {
        name: `TaleForge-Image-${Date.now()}`
      }
    }
    const result = await pinata.pinFileToIPFS(readableStreamForFile, options)
    return result.IpfsHash
  } catch (error) {
    console.error('Failed to upload image to IPFS:', error)
    throw error
  }
}

/**
 * 上传 JSON 数据到 IPFS
 * @param data JSON 数据
 * @returns CID
 */
export async function uploadJSONToIPFS(data: any): Promise<string> {
  try {
    const options = {
      pinataMetadata: {
        name: `TaleForge-JSON-${Date.now()}`
      }
    }
    const result = await pinata.pinJSONToIPFS(data, options)
    return result.IpfsHash
  } catch (error) {
    console.error('Failed to upload JSON to IPFS:', error)
    throw error
  }
}

/**
 * 从 IPFS 获取 JSON 数据
 * @param cid 内容ID
 * @returns JSON 数据
 */
export async function getJSONFromIPFS(cid: string): Promise<any> {
  try {
    const response = await fetch(`${IPFS_GATEWAY}/${cid}`)
    return await response.json()
  } catch (error) {
    console.error('Failed to get JSON from IPFS:', error)
    throw error
  }
}