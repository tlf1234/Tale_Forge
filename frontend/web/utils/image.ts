/**
 * 获取图片 URL
 * @param cid IPFS CID
 * @param defaultImage 默认图片名称
 * @returns 图片 URL
 */
export function getImageUrl(cid?: string, defaultImage: string = 'story-default-cover.jpg'): string {
  if (!cid) {
    return `/images/${defaultImage}`
  }
  return `/api/ipfs/${cid}`
} 