/**
 * IPFS工具函数
 * 提供上传和获取IPFS内容的功能
 */

/**
 * 上传内容到IPFS
 * @param content 要上传的内容（字符串或Buffer）
 * @returns 返回内容的CID
 */
export async function uploadToIPFS(content: string | Buffer): Promise<string> {
  try {
    // 使用环境变量中配置的IPFS服务
    const ipfsUrl = process.env.IPFS_API_URL || 'https://api.pinata.cloud/pinning/pinFileToIPFS';
    
    // 准备表单数据
    const formData = new FormData();
    
    if (typeof content === 'string') {
      // 如果是base64图片数据
      if (content.startsWith('data:image')) {
        const base64Data = content.split(',')[1];
        const buffer = Buffer.from(base64Data, 'base64');
        const blob = new Blob([buffer]);
        formData.append('file', blob, 'image.png');
      } else {
        // 普通文本内容
        const blob = new Blob([content], { type: 'application/json' });
        formData.append('file', blob, 'content.json');
      }
    } else {
      // Buffer数据
      const blob = new Blob([content]);
      formData.append('file', blob, 'file');
    }
    
    // 添加元数据
    formData.append('pinataMetadata', JSON.stringify({
      name: `TaleForge-${Date.now()}`,
    }));
    
    // 发送请求
    const response = await fetch(ipfsUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.IPFS_API_KEY}`
      },
      body: formData
    });
    
    if (!response.ok) {
      throw new Error(`IPFS上传失败: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    return data.IpfsHash;
  } catch (error) {
    console.error('IPFS上传错误:', error);
    throw error;
  }
}

/**
 * 从IPFS获取内容
 * @param cid 内容的CID
 * @returns 返回内容（JSON对象或文本）
 */
export async function getFromIPFS(cid: string): Promise<any> {
  try {
    const gateway = process.env.IPFS_GATEWAY || 'https://ipfs.io/ipfs/';
    const url = `${gateway}${cid}`;
    
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`IPFS获取失败: ${response.status} ${response.statusText}`);
    }
    
    // 尝试解析为JSON，如果失败则返回文本
    try {
      return await response.json();
    } catch {
      return await response.text();
    }
  } catch (error) {
    console.error('IPFS获取错误:', error);
    throw error;
  }
} 