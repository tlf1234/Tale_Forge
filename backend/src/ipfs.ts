import pinataSDK from '@pinata/sdk'
import { createReadStream } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { writeFileSync } from 'fs'
import axios from 'axios'
import { PINATA_KEYS, PINATA_GATEWAY } from './config/pinata'

// Key 管理
class PinataKeyManager {
  private currentKeyIndex = 0;
  private keyLastUsedTime: { [key: string]: number } = {};
  private keyBlockedUntil: { [key: string]: number } = {};

  constructor() {
    PINATA_KEYS.forEach(key => {
      this.keyLastUsedTime[key.apiKey] = 0;
      this.keyBlockedUntil[key.apiKey] = 0;
    });
  }

  getCurrentKey(): Promise<typeof PINATA_KEYS[0]> {
    const now = Date.now();
    let attempts = 0;
    
    while (attempts < PINATA_KEYS.length) {
      const key = PINATA_KEYS[this.currentKeyIndex];
      
      // 检查是否被阻塞
      if (this.keyBlockedUntil[key.apiKey] > now) {
        console.log(`[IPFS] Key ${key.name} 被阻塞到 ${new Date(this.keyBlockedUntil[key.apiKey]).toLocaleString()}`);
        this.rotateKey();
        attempts++;
        continue;
      }

      // 检查请求间隔
      const timeSinceLastUse = now - this.keyLastUsedTime[key.apiKey];
      if (timeSinceLastUse < 1000) {
        const waitTime = 1000 - timeSinceLastUse;
        console.log(`[IPFS] Key ${key.name} 需要等待 ${waitTime}ms`);
        
        // 如果等待时间很短，就等待
        if (waitTime <= 100) {
          const sleepStart = Date.now();
          while (Date.now() - sleepStart < waitTime) {
            // 主动等待
          }
          return Promise.resolve(key);
        }
        
        this.rotateKey();
        attempts++;
        continue;
      }

      return Promise.resolve(key);
    }

    // 所有 key 都不可用，找出最早可用的时间
    const earliestAvailableTime = Math.min(
      ...PINATA_KEYS.map(key => this.keyBlockedUntil[key.apiKey])
    );
    const waitTime = earliestAvailableTime - now;
    
    if (waitTime <= 0) {
      throw new Error('所有 API Key 都不可用，且无法确定等待时间');
    }

    console.log(`[IPFS] 所有 Key 都被阻塞，等待 ${Math.ceil(waitTime/1000)} 秒后重试...`);
    return new Promise(resolve => {
      setTimeout(() => {
        // 重置所有 key 的阻塞状态
        PINATA_KEYS.forEach(key => {
          if (this.keyBlockedUntil[key.apiKey] <= Date.now()) {
            this.keyBlockedUntil[key.apiKey] = 0;
          }
        });
        resolve(this.getCurrentKey());
      }, waitTime);
    });
  }

  markKeyUsed(key: typeof PINATA_KEYS[0]) {
    this.keyLastUsedTime[key.apiKey] = Date.now();
    console.log(`[IPFS] 使用 Key: ${key.name}`);
  }

  markKeyBlocked(key: typeof PINATA_KEYS[0], duration: number) {
    const blockUntil = Date.now() + duration;
    console.log(`[IPFS] Key ${key.name} 被阻塞 ${duration/1000} 秒，直到 ${new Date(blockUntil).toLocaleString()}`);
    this.keyBlockedUntil[key.apiKey] = blockUntil;
    this.rotateKey();
  }

  rotateKey() {
    this.currentKeyIndex = (this.currentKeyIndex + 1) % PINATA_KEYS.length;
    console.log(`[IPFS] 切换到 Key: ${PINATA_KEYS[this.currentKeyIndex].name}`);
  }
}

// 创建 Key 管理器实例
const keyManager = new PinataKeyManager();

// 请求队列管理
class RequestQueue {
  private queue: (() => Promise<any>)[] = [];
  private isProcessing = false;
  private lastRequestTime = 0;
  private readonly minRequestInterval = 1000; // 最小请求间隔为1秒
  private activeRequests = 0;
  private readonly maxConcurrentRequests = 3; // 最大并发请求数

  async enqueue<T>(request: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push(async () => {
        try {
          // 确保请求间隔
          const now = Date.now();
          const timeSinceLastRequest = now - this.lastRequestTime;
          if (timeSinceLastRequest < this.minRequestInterval) {
            await new Promise(resolve => setTimeout(resolve, this.minRequestInterval - timeSinceLastRequest));
          }
          
          this.activeRequests++;
          this.lastRequestTime = Date.now();
          
          // 添加重试机制
          const maxRetries = 3;
          let retryCount = 0;
          let result: T;
          
          while(true) {
            try {
              result = await request();
              break; // 成功就跳出循环
            } catch (error) {
              retryCount++;
              // 如果已经到最大重试次数，则抛出错误
              if (retryCount > maxRetries) {
                throw error;
              }
              
              console.log(`[RequestQueue] 请求失败，进行第 ${retryCount} 次重试...`);
              
              // 指数级退避策略
              const delay = 1000 * Math.pow(2, retryCount);
              await new Promise(r => setTimeout(r, delay));
            }
          }
          
          this.activeRequests--;
          resolve(result);
        } catch (error) {
          this.activeRequests--;
          reject(error);
        }
      });
      
      if (!this.isProcessing) {
        this.processQueue();
      }
    });
  }

  private async processQueue() {
    if (this.isProcessing) return;
    this.isProcessing = true;

    while (this.queue.length > 0 && this.activeRequests < this.maxConcurrentRequests) {
      const request = this.queue.shift();
      if (request) {
        // 不等待请求完成，允许并发
        request().catch(err => console.error('[RequestQueue] 处理请求时出错:', err));
      }
    }

    // 如果队列中还有请求且活动请求数小于最大值，继续处理
    if (this.queue.length > 0 && this.activeRequests < this.maxConcurrentRequests) {
      setTimeout(() => this.processQueue(), 100);
    } else {
      this.isProcessing = false;
    }
  }
}

// 创建请求队列实例
const requestQueue = new RequestQueue();

/**
 * 上传内容到 IPFS
 * @param content 要上传的内容
 * @returns CID
 */
export async function uploadToIPFS(content: string | Buffer): Promise<string> {
  return requestQueue.enqueue(async () => {
    const key = await keyManager.getCurrentKey();
    const pinata = new pinataSDK(key.apiKey, key.apiSecret);

    try {
      // 将内容包装在对象中
      const data = {
        content: content instanceof Buffer ? content.toString('base64') : content,
        timestamp: Date.now()
      }

      const options = {
        pinataMetadata: {
          name: `TaleForge-${Date.now()}`
        }
      }

      const result = await pinata.pinJSONToIPFS(data, options)
      keyManager.markKeyUsed(key);
      return result.IpfsHash;
    } catch (error: any) {
      if (error.response?.status === 429) {
        const retryAfter = parseInt(error.response.headers['retry-after'] || '3600', 10);
        keyManager.markKeyBlocked(key, retryAfter * 1000);
        // 重试上传
        return uploadToIPFS(content);
      }
      console.error('Failed to upload to IPFS:', error)
      throw error
    }
  });
}

/**
 * 从 IPFS 获取内容
 * @param cid 内容ID
 * @returns 内容
 */
export async function getFromIPFS(cid: string): Promise<string | Buffer> {
  return requestQueue.enqueue(async () => {
    let retries = 0;
    const maxRetries = PINATA_KEYS.length * 2;
    
    while (retries < maxRetries) {
      const key = await keyManager.getCurrentKey();
      console.log(`[IPFS] 使用 Key ${key.name} 尝试获取内容: ${cid}`);
      
      try {
        const url = `https://${PINATA_GATEWAY}/ipfs/${cid}`;
        console.log(`[getFromIPFS] 请求的 URL: ${url}`);
        
        // 设置 responseType 为 arraybuffer 以支持二进制数据
        const response = await axios.get(url, {
          headers: {
            Authorization: `Bearer ${key.jwt}`,
          },
          responseType: 'arraybuffer',
          timeout: 10000
        });

        if (response.status === 200) {
          keyManager.markKeyUsed(key);
          
          // 检查内容类型
          const contentType = response.headers['content-type'];
          console.log('[getFromIPFS] Content-Type:', contentType);

          // 如果是图片或二进制数据，直接返回 Buffer
          if (contentType && (
            contentType.startsWith('image/') || 
            contentType === 'application/octet-stream'
          )) {
            return Buffer.from(response.data);
          }
          
          // 如果是文本内容，尝试解析
          const textContent = Buffer.from(response.data).toString('utf-8');
          try {
            const jsonData = JSON.parse(textContent);
            return jsonData.content || textContent;
          } catch {
            return textContent;
          }
        }

        throw new Error(`Unexpected response status: ${response.status}`);
      } catch (error: any) {
        console.error('[getFromIPFS] 获取失败:', error.message);
        if (error.response?.status === 429) {
          const retryAfter = parseInt(error.response.headers['retry-after'] || '3600', 10);
          keyManager.markKeyBlocked(key, retryAfter * 1000);
          retries++;
          continue;
        }
        
        if (error.code === 'ECONNABORTED') {
          console.log(`[IPFS] 请求超时，切换到下一个 Key`);
          keyManager.rotateKey();
          retries++;
          continue;
        }

        if (retries < maxRetries - 1) {
          console.log(`[IPFS] 获取失败，尝试使用下一个 Key`);
          keyManager.rotateKey();
          retries++;
          continue;
        }

        throw error;
      }
    }

    throw new Error(`已尝试所有可用的 Key (${maxRetries} 次)，但都无法获取内容`);
  });
}

/**
 * 获取 IPFS URL (用于公开访问)
 * @param cid 内容ID
 * @returns URL
 */
export function getIPFSUrl(cid: string): string {
  return `https://${PINATA_GATEWAY}/ipfs/${cid}`
}

/**
 * 上传图片到 IPFS
 * @param file 图片文件
 * @returns CID
 */
export async function uploadImageToIPFS(file: File): Promise<string> {
  return requestQueue.enqueue(async () => {
    const key = await keyManager.getCurrentKey();
    const pinata = new pinataSDK(key.apiKey, key.apiSecret);
    let tempPath = '';

    try {
      console.log(`[IPFS] 开始上传图片 ${file.name} (${file.size} 字节)`);
      
      // 将文件内容转换为Buffer
      const buffer = await file.arrayBuffer()
      
      // 生成临时文件路径，使用更唯一的ID
      const uniqueId = `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
      tempPath = join(tmpdir(), `ipfs-${uniqueId}.bin`);
      
      // 写入临时文件
      console.log(`[IPFS] 写入临时文件 ${tempPath}`);
      writeFileSync(tempPath, Buffer.from(buffer));
      
      // 确认文件写入成功
      const stats = require('fs').statSync(tempPath);
      if (stats.size !== buffer.byteLength) {
        throw new Error(`临时文件大小不匹配: ${stats.size}/${buffer.byteLength}`);
      }
      
      console.log(`[IPFS] 创建文件流进行上传`);
      const readableStreamForFile = createReadStream(tempPath);
      
      const options = {
        pinataMetadata: {
          name: `TaleForge-Image-${uniqueId}`
        },
        pinataOptions: {
          cidVersion: 0 as 0
        }
      };
      
      console.log(`[IPFS] 开始上传文件到Pinata`);
      const result = await pinata.pinFileToIPFS(readableStreamForFile, options);
      
      console.log(`[IPFS] 图片上传成功, CID: ${result.IpfsHash}`);
      keyManager.markKeyUsed(key);
      
      // 上传成功后安全删除临时文件
      try {
        require('fs').unlinkSync(tempPath);
        console.log(`[IPFS] 临时文件 ${tempPath} 已删除`);
      } catch (cleanupError) {
        console.warn(`[IPFS] 无法删除临时文件 ${tempPath}:`, cleanupError);
        // 不影响正常流程，仅记录警告
      }
      
      return result.IpfsHash;
    } catch (error: any) {
      console.error(`[IPFS] 上传图片失败(${file.name}):`, error);
      
      // 429错误处理 - 速率限制
      if (error.response?.status === 429) {
        const retryAfter = parseInt(error.response.headers['retry-after'] || '3600', 10);
        keyManager.markKeyBlocked(key, retryAfter * 1000);
        console.log(`[IPFS] API限速，将在 ${retryAfter} 秒后重试`);
        
        // 重试上传
        return uploadImageToIPFS(file);
      }
      
      // 清理临时文件，避免磁盘空间浪费
      if (tempPath) {
        try {
          require('fs').unlinkSync(tempPath);
          console.log(`[IPFS] 上传失败后清理临时文件 ${tempPath}`);
        } catch (cleanupError) {
          console.warn(`[IPFS] 无法删除临时文件 ${tempPath}:`, cleanupError);
        }
      }
      
      // 重新抛出原始错误
      throw error;
    }
  });
}

/**
 * 上传 JSON 数据到 IPFS
 * @param data JSON 数据
 * @returns CID
 */
export async function uploadJSONToIPFS(data: any): Promise<string> {
  return requestQueue.enqueue(async () => {
    const key = await keyManager.getCurrentKey();
    const pinata = new pinataSDK(key.apiKey, key.apiSecret);

    try {
      const options = {
        pinataMetadata: {
          name: `TaleForge-JSON-${Date.now()}`
        }
      }
      // 直接传入原始数据，pinata SDK 会处理序列化
      const result = await pinata.pinJSONToIPFS(data, options)
      keyManager.markKeyUsed(key);
      return result.IpfsHash;
    } catch (error: any) {
      if (error.response?.status === 429) {
        const retryAfter = parseInt(error.response.headers['retry-after'] || '3600', 10);
        keyManager.markKeyBlocked(key, retryAfter * 1000);
        // 重试上传
        return uploadJSONToIPFS(data);
      }
      console.error('Failed to upload JSON to IPFS:', error)
      throw error
    }
  });
}

/**
 * 从 IPFS 获取 JSON 数据
 * @param cid 内容ID
 * @returns JSON 数据
 */
export async function getJSONFromIPFS(cid: string): Promise<any> {
  try {
    // 直接获取数据，不经过 getFromIPFS
    const response = await axios.get(`https://${PINATA_GATEWAY}/ipfs/${cid}`);
    return response.data;
  } catch (error) {
    console.error('Failed to get JSON from IPFS:', error);
    throw error;
  }
}