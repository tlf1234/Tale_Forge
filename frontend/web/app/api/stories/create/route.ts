import { NextRequest, NextResponse } from 'next/server'
import { prisma, uploadToIPFS, uploadImageToIPFS, uploadJSONToIPFS } from '../../../../../../backend/database'
import { ethers } from 'ethers'
import { StoryManager__factory } from '../../../../../../blockchain'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// 从环境变量获取 RPC URLs 配置
const RPC_NODES = (process.env.BSC_RPC_URLS || 'https://data-seed-prebsc-1-s1.binance.org:8545,https://bsc-testnet.nodereal.io/v1/e9a36765eb8a40b9bd12e680a1fd2bc5')
  .split(',')
  .filter(Boolean) as string[]

// 创建自定义 Provider 类
class CustomProvider extends ethers.providers.JsonRpcProvider {
  async send(method: string, params: Array<any>): Promise<any> {
    const request = {
      method: method,
      params: params,
      id: (Math.random() * 1e9) | 0,
      jsonrpc: '2.0'
    }

    const connection = this.connection as any
    const url = connection.url

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Origin': 'https://tale-forge.com',
          'Referer': 'https://tale-forge.com'
        },
        body: JSON.stringify(request),
        cache: 'no-cache',
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const result = await response.json()
      if (result.error) {
        throw new Error(result.error.message || '未知RPC错误')
      }

      return result.result
    } catch (error) {
      console.error('RPC请求失败:', error)
      throw error
    }
  }
}

// 创建 Provider
async function createProvider(): Promise<ethers.providers.Provider> {
  const networkConfig = {
    name: 'bsc-testnet',
    chainId: 97
  }

  console.log('开始尝试连接BSC测试网...')
  console.log('配置信息:', networkConfig)
  console.log(`共有 ${RPC_NODES.length} 个可用节点`)

  // 尝试连接到每个节点
  for (const url of RPC_NODES) {
    try {
      console.log('\n----------------------------------------')
      console.log(`正在尝试连接节点: ${url}`)
      console.log('创建 provider 实例...')
      
      const provider = new CustomProvider(url, networkConfig)

      console.log('Provider 实例创建成功，正在测试连接...')
      console.log('等待区块号响应...')
      
      const blockNumber = await provider.getBlockNumber()
      console.log('节点连接成功！详细信息:')
      console.log('- 当前区块:', blockNumber)

      return provider
    } catch (error: any) {
      console.error('\n节点连接失败!')
      console.error('- 错误类型:', error.constructor.name)
      console.error('- 错误消息:', error.message)
      if (error.code) console.error('- 错误代码:', error.code)
      if (error.reason) console.error('- 错误原因:', error.reason)
      continue
    }
  }

  throw new Error('所有节点均连接失败，请检查网络连接或稍后重试')
}

// 创建故事的接口
export async function POST(req: NextRequest) {
  try {
    const {
      title,
      description,
      content,
      coverImage,
      authorAddress,
      targetWordCount,
      category,
      price = 0,
      isSerial = true
    } = await req.json()

    // 验证必填字段
    if (!title || !description || !content || !authorAddress || !targetWordCount) {
      return NextResponse.json({ error: '缺少必要字段' }, { status: 400 })
    }

    // 验证目标字数
    if (targetWordCount < 100000) {
      return NextResponse.json({ error: '目标字数不能少于10万字' }, { status: 400 })
    }

    try {
      // 上传封面到 IPFS
      let coverCid
      const DEFAULT_COVER = 'https://tale-forge.com/images/story-default-cover.jpg'
      
      if (!coverImage || coverImage === '') {
        coverCid = DEFAULT_COVER
      } else if (typeof coverImage === 'string') {
        if (coverImage.startsWith('http')) {
          coverCid = coverImage
        } else if (coverImage.startsWith('data:image')) {
          try {
            const base64Data = coverImage.split(',')[1];
            const imageBuffer = Buffer.from(base64Data, 'base64');
            const imageFile = new File([imageBuffer], 'cover.jpg', { type: 'image/jpeg' });
            coverCid = await uploadImageToIPFS(imageFile);
          } catch (error) {
            console.error('处理封面图片失败:', error);
            coverCid = DEFAULT_COVER
          }
        } else {
          coverCid = DEFAULT_COVER
        }
      } else {
        coverCid = DEFAULT_COVER
      }

      // 上传内容到 IPFS
      const contentData = {
        content,
        timestamp: new Date().toISOString(),
        version: '1.0'
      }
      const contentCid = await uploadJSONToIPFS(contentData)

      // 计算当前字数
      const currentWordCount = content.trim().split(/\s+/).length

      console.log('\n============ 环境检查 ============')
      // 验证环境变量
      if (!process.env.PRIVATE_KEY) {
        throw new Error('平台钱包私钥未配置，请在环境变量中设置 PRIVATE_KEY');
      }
      if (!process.env.NEXT_PUBLIC_STORY_MANAGER_CONTRACT) {
        throw new Error('故事管理合约地址未配置，请在环境变量中设置 NEXT_PUBLIC_STORY_MANAGER_CONTRACT');
      }
      console.log('✓ 环境变量检查通过')
      console.log('- 合约地址:', process.env.NEXT_PUBLIC_STORY_MANAGER_CONTRACT)
      console.log('- 私钥长度:', process.env.PRIVATE_KEY.length)

      console.log('\n============ 网络连接 ============')
      console.log('正在连接到网络...')
      const provider = await createProvider()
      
      console.log('\n============ 钱包配置 ============')
      const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider)
      console.log('钱包地址:', wallet.address)
      
      // 获取钱包余额
      const balance = await wallet.getBalance()
      console.log('钱包余额:', ethers.utils.formatEther(balance), 'BNB')
      
      console.log('\n============ 合约交互 ============')
      console.log('连接到故事管理合约...')
      const storyManager = StoryManager__factory.connect(
        process.env.NEXT_PUBLIC_STORY_MANAGER_CONTRACT,
        wallet
      )
      
      // 验证合约代码是否已部署
      console.log('验证合约代码...')
      const code = await provider.getCode(process.env.NEXT_PUBLIC_STORY_MANAGER_CONTRACT)
      if (code === '0x') {
        throw new Error('合约地址无效或合约未部署')
      }
      console.log('✓ 合约代码验证通过')

      console.log('\n正在调用合约创建故事...')
      console.log('参数:', {
        title,
        description,
        coverCid,
        contentCid,
        targetWordCount
      })
      
      try {
        // 验证作者是否已注册
        console.log('获取作者管理合约地址...')
        const authorInfo = await storyManager.authorManager()
        console.log('作者管理合约地址:', authorInfo)

        // 检查作者是否存在于数据库中
        console.log('检查作者是否存在于数据库...')
        const author = await prisma.user.upsert({
          where: { address: authorAddress },
          create: {
            address: authorAddress,
            nickname: `作者 ${authorAddress.slice(0, 6)}`,
            type: 'AUTHOR',
            isAuthor: true,
            authorName: `作者 ${authorAddress.slice(0, 6)}`
          },
          update: {
            type: 'AUTHOR',
            isAuthor: true
          },
          select: {
            id: true,
            address: true,
            nickname: true,
            authorName: true,
            type: true,
            isAuthor: true
          }
        })
        console.log('作者记录已更新:', { id: author.id, nickname: author.nickname, authorName: author.authorName })

        // 获取 gas 估算
        console.log('估算 gas...')
        const gasPrice = await provider.getGasPrice()
        console.log('当前 gas 价格:', ethers.utils.formatUnits(gasPrice, 'gwei'), 'Gwei')
        
        // 调用合约创建故事
        const tx = await storyManager.createStory(
          title,
          description,
          coverCid,
          contentCid,
          targetWordCount,
          {
            gasLimit: 3000000,
            gasPrice: await provider.getGasPrice()
          }
        )
        
        console.log('创建故事交易已发送:', tx.hash)
        
        // 等待交易确认
        const receipt = await tx.wait()
        console.log('交易已确认，区块号:', receipt.blockNumber)

        // 获取事件日志
        const event = receipt.events?.find(e => e.event === 'StoryCreated')
        if (!event) {
          throw new Error('未找到StoryCreated事件')
        }
        const storyId = event.args?.storyId

        console.log('开始创建数据库记录...')
        // 在数据库中创建故事记录
        const story = await prisma.story.create({
          data: {
            id: storyId.toString(),
            title,
            description,
            cover: coverCid,
            contentCID: contentCid,
            category: category || 'OTHER',
            wordCount: currentWordCount,
            targetWordCount,
            authorId: author.id,
            published: true,
            status: 'PUBLISHED',
            tags: []
          },
          include: {
            author: true,
            _count: {
              select: {
                chapters: true,
                comments: true,
                likes: true
              }
            }
          }
        })
        console.log('数据库记录创建成功:', story.id)

        // 添加详细日志
        console.log('创建的故事详情:', {
          id: story.id,
          title: story.title,
          authorId: story.authorId,
          authorAddress: story.author.address,
          status: story.status,
          published: story.published
        })

        // 返回成功结果
        return NextResponse.json({ 
          success: true,
          story: {
            ...story,
            author: story.author,
            stats: {
              likes: story._count.likes,
              comments: story._count.comments,
              chapters: story._count.chapters
            }
          },
          transaction: {
            hash: receipt.transactionHash,
            blockNumber: receipt.blockNumber,
            storyId: storyId.toString()
          }
        }, {
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-store'
          }
        })
      } catch (error: any) {
        console.error('创建故事失败:', error)
        // 检查是否是合约调用错误
        if (error.message.includes('execution reverted')) {
          const reason = error.message.split('execution reverted:')[1]?.trim() || '未知原因'
          return NextResponse.json({ 
            error: `合约调用失败: ${reason}`,
            details: error.message
          }, { status: 400 })
        }
        // 检查是否是数据库错误
        if (error.code === 'P2003') {
          return NextResponse.json({ 
            error: '数据库外键约束错误，请确保作者已注册',
            details: error.message
          }, { status: 400 })
        }
        throw error
      }

    } catch (error: any) {
      console.error('创建故事失败:', error)
      return NextResponse.json({ 
        error: error.message || '创建故事失败，请稍后重试',
        details: error
      }, { status: 500 })
    }

  } catch (error: any) {
    console.error('请求处理失败:', error)
    return NextResponse.json({ 
      error: '服务器错误，请稍后重试',
      details: error.message 
    }, { status: 500 })
  }
}
