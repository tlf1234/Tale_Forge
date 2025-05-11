import { uploadToIPFS, getFromIPFS, uploadJSONToIPFS, getJSONFromIPFS, uploadImageToIPFS } from '../ipfs'
import fs from 'fs'
import path from 'path'

async function testIPFS() {
  try {
    console.log('开始测试 IPFS 功能...')

    // 测试文本内容的上传和获取
    const testContent = '这是一个测试内容 ' + Date.now()
    console.log('开始上传文本内容...')
    const cid = await uploadToIPFS(testContent)
    console.log('内容已上传，CID:', cid)
    
    // 等待 5 秒确保内容已经同步
    console.log('等待内容同步...')
    await new Promise(resolve => setTimeout(resolve, 5000))
    
    // 获取内容
    console.log('开始获取文本内容...')
    const retrievedContent = await getFromIPFS(cid)
    console.log('已获取内容:', retrievedContent)
    
    if (retrievedContent !== testContent) {
      throw new Error('文本内容不匹配')
    }
    
    // 测试 JSON 数据的上传和获取
    const testData = {
      title: '测试标题',
      content: '测试内容',
      timestamp: Date.now()
    }
    
    console.log('开始上传 JSON 数据...')
    const jsonCid = await uploadJSONToIPFS(testData)
    console.log('JSON 已上传，CID:', jsonCid)
    
    // 等待 5 秒确保内容已经同步
    console.log('等待内容同步...')
    await new Promise(resolve => setTimeout(resolve, 5000))
    
    // 获取 JSON
    console.log('开始获取 JSON 数据...')
    const retrievedData = await getJSONFromIPFS(jsonCid)
    console.log('已获取 JSON:', retrievedData)
    
    if (JSON.stringify(retrievedData) !== JSON.stringify(testData)) {
      throw new Error('JSON 数据不匹配')
    }

    // 测试图片上传
    console.log('开始测试图片上传...')
    
    // 1. 验证图片数据准备
    const imagePath = path.join(process.cwd(), 'uploads', 'test-image.png')
    console.log('读取测试图片:', imagePath)
    
    // 确保测试图片存在
    if (!fs.existsSync(imagePath)) {
      throw new Error(`测试图片不存在: ${imagePath}`)
    }
    
    const imageBuffer = fs.readFileSync(imagePath)
    console.log('图片数据准备完成，大小:', imageBuffer.length, 'bytes')
    
    // 2. 验证 File 对象创建
    const imageFile = new File([imageBuffer], 'test-image.png', {
      type: 'image/png'
    })
    console.log('验证 File 对象:', {
      name: imageFile.name,
      type: imageFile.type,
      size: imageFile.size
    })
    
    if (imageFile.size !== imageBuffer.length) {
      throw new Error('File 对象大小与原始数据不匹配')
    }
    
    // 3. 验证图片上传
    console.log('开始上传图片...')
    const imageCid = await uploadImageToIPFS(imageFile)
    console.log('图片上传完成，验证 CID:', imageCid)
    
    // 验证 CID 格式
    if (!imageCid || typeof imageCid !== 'string' || !imageCid.startsWith('Qm')) {
      throw new Error(`无效的 CID 格式: ${imageCid}`)
    }
    
    // 4. 等待内容同步并验证可访问性
    console.log('等待图片同步...')
    let retrievedImage: string | Buffer | null = null
    let retryCount = 0
    const maxRetries = 3
    
    while (retryCount < maxRetries) {
      try {
        // 等待 2 秒后尝试获取
        await new Promise(resolve => setTimeout(resolve, 2000))
        retrievedImage = await getFromIPFS(imageCid) as string | Buffer
        break
      } catch (error) {
        console.log(`第 ${retryCount + 1} 次尝试获取失败，将重试...`)
        retryCount++
        if (retryCount === maxRetries) {
          throw new Error('图片同步超时，无法访问')
        }
      }
    }
    
    // 5. 验证获取的内容
    console.log('验证获取的内容...')
    if (!retrievedImage) {
      throw new Error('未能获取图片内容')
    }
    
    // 验证内容类型
    if (!Buffer.isBuffer(retrievedImage)) {
      throw new Error('获取的内容不是二进制格式')
    }
    
    // 验证内容大小
    console.log('验证内容大小:', {
      original: imageBuffer.length,
      retrieved: retrievedImage.length
    })
    if (retrievedImage.length !== imageBuffer.length) {
      throw new Error('获取的内容大小不匹配')
    }
    
    // 验证内容完整性
    const contentMatch = retrievedImage.equals(imageBuffer)
    console.log('内容完整性验证:', contentMatch ? '通过' : '失败')
    if (!contentMatch) {
      throw new Error('图片内容不匹配')
    }
    
    // 6. 验证图片格式（检查 PNG 文件头）
    const isPNG = imageBuffer[0] === 0x89 && 
                 imageBuffer[1] === 0x50 && // P
                 imageBuffer[2] === 0x4E && // N
                 imageBuffer[3] === 0x47;   // G
    
    console.log('图片格式验证:', isPNG ? 'PNG格式正确' : '非PNG格式')
    
    console.log('图片上传测试完成！所有验证通过！')
    
    console.log('所有测试通过！')
  } catch (error) {
    console.error('测试失败:', error)
    process.exit(1)
  }
}

// 运行测试
testIPFS() 