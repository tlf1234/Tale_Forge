import { ethers } from 'ethers'
import prisma from '../prisma'
import { uploadToIPFS, getFromIPFS, uploadJSONToIPFS, getIPFSUrl, uploadImageToIPFS } from '../ipfs'
import type { Story, Chapter, Prisma, StoryStatus, Illustration } from '@prisma/client'
import { SyncStatus } from '@prisma/client'
import { syncService } from './sync.service'
import fs from 'fs'
import path from 'path'
import { PINATA_GATEWAY } from '../config/pinata'

export class StoryService {
  /**
   * 获取作者作品列表
   */
  async getAuthorStories(authorId: string, params: {
    status?: StoryStatus
    skip?: number
    take?: number
  }) {
    console.log('[StoryService.getAuthorStories] 开始获取作者作品:', {
      authorId,
      params
    })

    try {

      /**
       * TODO 注意！！！同步这一功能还是有问题的，没有较好的触发需要同步的机制，这个如果后面还需要有这个功能
       * 就需要进一步优化，暂时先这样。
       * 方案一：比对作品数量
                最简单的方案，但可能会有遗漏：
                从链上获取作者的作品数量
                与数据库中的作品数量比较
                如果数量不一致，说明需要同步
                优点：
                实现简单，开销小
                快速发现新增或删除的作品
                缺点：
                无法发现作品内容的更新
                如果恰好数量一致但内容不同，会遗漏
       */
      // 1. 获取同步状态
      const syncState = await syncService.getAuthorStoriesSyncState(authorId)
      console.log('[StoryService.getAuthorStories] 同步状态:', syncState)
      
      // 2. 触发同步的条件：
      // - 首次加载（没有同步记录）
      // - 同步状态不是 COMPLETED
      // PENDING（待同步）
      // SYNCING（同步中）
      // COMPLETED（同步完成）
      // FAILED（同步失败）
      const needsSync = !syncState || !['COMPLETED'].includes(syncState.syncStatus)
      // 如果需要同步，触发一次同步（异步执行，不等待结果）
      if (needsSync) {
        console.log('[StoryService.getAuthorStories] 触发同步，原因:', !syncState ? '首次加载' : `状态为 ${syncState.syncStatus}`)
        // 异步触发同步，不等待结果
        syncService.triggerStoriesSync(authorId).catch(error => {
          console.error('[StoryService.getAuthorStories] 触发同步失败:', error)
        })
      }

      // 3. 从数据库获取作品列表
      const { status, skip = 0, take = 10 } = params
      const where = {
        authorId,
        ...(status && { status })
      }

      const [total, stories] = await Promise.all([
        prisma.story.count({ where }),
        prisma.story.findMany({
          where,
          skip,
          take,
          include: {
            _count: {
              select: {
                likes: true,
                comments: true,
                favorites: true
              }
            }
          },
          orderBy: { createdAt: 'desc' }
        })
      ])

      console.log('[StoryService.getAuthorStories] 查询结果:', {
        total,
        storiesCount: stories.length,
        syncStatus: syncState?.syncStatus
      })

      // 返回数据库当前的数据，同时返回同步状态供前端展示
      return { 
        stories, 
        total,
        syncStatus: syncState?.syncStatus || 'PENDING',
        message: needsSync ? '正在同步区块链数据，稍后刷新页面查看最新数据' : undefined,
        error: syncState?.syncStatus === 'FAILED' ? '同步失败，请稍后重试' : undefined
      }
    } catch (error) {
      console.error('[StoryService.getAuthorStories] 获取失败:', error)
      throw error
    }
  }


  /**
   * 创建故事
   * 1. 验证数据
   * 2. 上传内容到 IPFS
   * 3、todo接上AI实现内容合规审查（作品创建环节应该不需要，内容提交是需要的）
   * 3. 返回上传结果供智能合约使用
   */
  async uploadStory(data: {
    title: string
    description: string
    content: string
    coverImage?: string
    authorAddress: string
    type: string
    category: string
    tags?: string[]
  }) {
    console.log('[StoryService.uploadStory] 开始上传故事:', {
      title: data.title,
      authorAddress: data.authorAddress
    })

    try {
      // 1. 验证必填字段
      if (!data.title || !data.description || !data.content || !data.authorAddress) {
        throw new Error('缺少必填字段')
      }

      // 2. 上传内容到 IPFS
      const { contentCid, coverCid } = await syncService.prepareStoryCreation({
        title: data.title,
        description: data.description,
        content: data.content,
        coverImage: data.coverImage,
        authorAddress: data.authorAddress
      })

      // 3. 返回上传结果供智能合约使用
      return {
        contentCid,  // 故事内容的 IPFS CID
        coverCid,    // 封面图片的 IPFS CID
        type: data.type,
        category: data.category,
        tags: data.tags || []
      }
    } catch (error) {
      console.error('[StoryService.createStory] 创建失败:', error)
      throw error
    }
  }

  // 保存故事
  async saveStory(data: {
    title: string
    description: string
    content: string
    coverImage?: string
    authorAddress: string
    contentCid: string
    coverCid: string
    category: string
    tags?: string[]
    targetWordCount: number
    chainId?: string  // 添加链上ID字段
  }) {
    console.log('[StoryService.saveStory] 开始保存故事:', {
      title: data.title,
      authorAddress: data.authorAddress,
      chainId: data.chainId,  // 添加链上ID日志
      contentCid: data.contentCid  // 修改这里
    })

    try {
      // 1. 验证必填字段
      if (!data.title || !data.description || !data.content || !data.authorAddress || !data.contentCid) {
        throw new Error('缺少必填字段')
      }

      // 2. 查找作者ID
      const author = await prisma.user.findUnique({
        where: { address: data.authorAddress },
        select: { id: true }
      })

      if (!author) {
        throw new Error('作者不存在')
      }

      // 3. 保存故事到数据库
      const story = await prisma.story.create({
        data: {
          title: data.title,
          description: data.description,
          coverCid: data.coverCid,
          contentCid: data.contentCid,  // 修改这里
          authorId: author.id,
          category: data.category,
          tags: data.tags || [],
          wordCount: data.content.length,
          targetWordCount: data.targetWordCount,
          isNFT: false,
          chainId: data.chainId ? parseInt(data.chainId) : null
        },
        include: {
          author: {
            select: {
              id: true,
              address: true,
              authorName: true,
              avatar: true
            }
          }
        }
      })

      return story
    } catch (error) {
      console.error('[StoryService.saveStory] 保存失败:', error)
      throw error
    }
  }

  
  // 验证故事内容
  async validateStory(data: any) {
    // 内容验证逻辑
    return { isValid: true, ipfsHash: '' }
  }


  // 更新故事
  async updateStory(id: string, data: {
    title?: string
    description?: string
    content?: string
    category?: string
    targetWordCount?: number
    coverImage?: File
    status?: StoryStatus
  }) {
    const updateData: Prisma.StoryUpdateInput = {}

    // 1. 处理内容更新
    if (data.content) {
      updateData.contentCid = await uploadToIPFS(data.content)  // 修改这里
      updateData.wordCount = data.content.length
    }

    // 2. 处理封面更新
    if (data.coverImage) {
      const buffer = Buffer.from(await data.coverImage.arrayBuffer())
      updateData.coverCid = await uploadToIPFS(buffer)
    }

    // 3. 更新其他字段
    Object.assign(updateData, {
      title: data.title,
      description: data.description,
      category: data.category,
      targetWordCount: data.targetWordCount,
      status: data.status
    })

    return await prisma.story.update({
      where: { id },
      data: updateData
    })
  }


  // 获取故事详情
  async getStory(id: string) {
    console.log('[StoryService.getStory] 开始获取故事:', { id });

    try {
      // 1. 获取数据库中的基本信息
      const story = await prisma.story.findUnique({
        where: { id },
        select: {
          id: true,
          title: true,
          description: true,
          coverCid: true,
          contentCid: true,  // 修改这里
          authorId: true,
          category: true,
          tags: true,
          wordCount: true,
          targetWordCount: true,
          createdAt: true,
          updatedAt: true,
          nftAddress: true,  // NFT合约地址
          chainId: true,     // 链上故事ID
          author: {
            select: {
              id: true,
              address: true,
              authorName: true,
              avatar: true
            }
          },
          _count: {
            select: {
              likes: true,
              comments: true,
              favorites: true
            }
          }
        }
      });

      console.log('[StoryService.getStory] 数据库查询结果:', {
        found: !!story,
        storyId: story?.id,
        title: story?.title,
        nftAddress: story?.nftAddress,
        chainId: story?.chainId,
        authorAddress: story?.authorId
      });

      if (!story) {
        console.log('[StoryService.getStory] 故事不存在:', { id });
        return null;
      }

      // 2. 内容按需从 IPFS 获取
      if (story) {
        console.log('[StoryService.getStory] 开始从IPFS获取内容:', { contentCid: story.contentCid });  // 修改这里
        const content = await getFromIPFS(story.contentCid);  // 修改这里
        console.log('[StoryService.getStory] IPFS内容获取成功:', { 
          contentLength: content?.length,
          hasContent: !!content 
        });
        return {
          id: story.id,
          title: story.title,
          description: story.description,
          coverCid: story.coverCid || '/images/story-default-cover.jpg',
          content,
          wordCount: story.wordCount,
          targetWordCount: story.targetWordCount,
          createdAt: story.createdAt,
          updatedAt: story.updatedAt,
          nftAddress: story.nftAddress,
          chainId: story.chainId,
          author: story.author,
          category: story.category,
          tags: story.tags,
          likes: story._count.likes,
          comments: story._count.comments,
          favorites: story._count.favorites
        };
      }
    } catch (error) {
      console.error('[StoryService.getStory] 获取故事失败:', error);
      throw error;
    }
  }

  // 获取故事列表
  async getStories(params: {
    category?: string
    authorId?: string
    skip?: number
    take?: number
    orderBy?: string
  }) {
    console.log('[StoryService.getStories] 开始获取故事列表:', params)

    try {
      const { category, authorId, skip = 0, take = 10, orderBy } = params
      const where = {
        ...(category && { category }),
        ...(authorId && { authorId })
      }

      const [total, stories] = await Promise.all([
        prisma.story.count({ where }),
        prisma.story.findMany({
          where,
          skip,
          take,
          include: {
            author: {
              select: {
                id: true,
                address: true,
                authorName: true,
                avatar: true
              }
            },
            _count: {
              select: {
                likes: true,
                comments: true,
                favorites: true
              }
            }
          },
          orderBy: orderBy ? { [orderBy]: 'desc' } : { createdAt: 'desc' }
        })
      ])

      // 为没有封面的作品添加默认封面
      const processedStories = stories.map(story => ({
        ...story,
        coverCid: story.coverCid || '/images/story-default-cover.jpg'
      }))

      return { stories: processedStories, total }
    } catch (error) {
      console.error('[StoryService.getStories] 获取失败:', error)
      throw error
    }
  }
  /*
  章节相关
  */
  // 添加章节
  async addChapter(storyId: string, data: {
    title: string
    content: string
    order: number
  }) {
    // 检查是否已存在相同序号的章节
    const existingChapter = await prisma.chapter.findFirst({
      where: {
        storyId,
        order: data.order
      }
    });

    if (existingChapter) {
      throw new Error(`已存在第 ${data.order} 章节，请选择其他章节序号`);
    }

    // 创建草稿章节，直接保存内容到数据库
    return await prisma.chapter.create({
      data: {
        title: data.title,
        content: data.content,
        order: data.order,
        wordCount: data.content.length,
        status: 'DRAFT',
        storyId
      }
    })
  }


  /**
   * 预处理章节发布，上传内容到 IPFS
   * 在区块链交易之前调用，返回 IPFS CID 供合约使用
   * 
   * 注意整个法布设计为：
   * 通过先把数据信息保存到数据库，然后在发布时从数据库获得插图数据，处理后直接上传到分布式存储。
   * 替换分布式中的路由时也是根据数据库中的插图信息进行的。
   */
  async prepareChapterPublish(id: string) {
    console.log('[预处理发布章节] 开始处理:', { id });
    
    const chapter = await prisma.chapter.findUnique({
      where: { id },
      include: {
        illustrations: {
          select: {
            id: true,
            filePath: true,
            imageCID: true,
            fileName: true,
            description: true,
            status: true
          }
        }
      }
    });

    if (!chapter) {
      console.log('[预处理发布章节] 错误: 章节不存在');
      throw new Error('章节不存在');
    }

    console.log('[预处理发布章节] 章节基本信息:', {
      id: chapter.id,
      title: chapter.title,
      hasContent: !!chapter.content,
      contentLength: chapter.content?.length || 0,
      illustrationsCount: chapter.illustrations.length
    });

    try {
      // 初始化处理后的内容
      let processedContent = chapter.content || '';
      
      // 如果有插图，处理插图
      if (chapter.illustrations.length > 0) {
        console.log('[预处理发布章节] 检测到插图，开始处理插画:', {
        chapterId: id,
          illustrationsCount: chapter.illustrations.length
      });

      // 记录内容中的所有图片标签
      const imgTagRegex = /<img[^>]+>/g;
      const imgTags = processedContent.match(imgTagRegex) || [];
      console.log('[预处理发布章节] 内容中的图片标签数量:', imgTags.length);
      
      // 记录每个图片标签的src和position属性
      imgTags.forEach((tag, index) => {
        const srcMatch = tag.match(/src="([^"]+)"/);
        const posMatch = tag.match(/data-position="([^"]+)"/);
        console.log(`[预处理发布章节] 图片标签 ${index + 1}:`, {
          src: srcMatch ? srcMatch[1] : '无src',
          position: posMatch ? posMatch[1] : '无position',
          fullTag: tag
        });
      });

      // 收集需要处理的图片
      const illustrationsToProcess = [];

      for (const illustration of chapter.illustrations) {
        console.log('[预处理发布章节] 分析插画:', {
          id: illustration.id,
          fileName: illustration.fileName,
          filePath: illustration.filePath,
          description: illustration.description,
          status: illustration.status,
          hasImageCID: !!illustration.imageCID
        });

        if (!illustration.filePath) {
          console.log('[预处理发布章节] 跳过处理：插画缺少文件路径');
          continue;
        }

        // 如果已经有 CID，不需要再上传
        if (!illustration.imageCID) {
          // 从完整URL中提取相对路径
            const urlPath = new URL(illustration.filePath); // 获取完整的URL路径
            const relativePath = urlPath.pathname.substring(1); // 提取相对路径
            const imagePath = path.join(process.cwd(), relativePath); // 构建本地路径
          
          // 检查文件是否存在
          try {
            await fs.promises.access(imagePath);
            console.log('[预处理发布章节] 文件存在，加入处理队列:', imagePath);
            
            // 收集待处理的图片
            illustrationsToProcess.push({
              illustration,
              imagePath,
              relativePath
            });
          } catch (error) {
            console.error('[预处理发布章节] 文件不存在，跳过处理:', {
              imagePath,
              error: error instanceof Error ? error.message : String(error)
            });
          }
        }
      }
      
      console.log(`[预处理发布章节] 共有 ${illustrationsToProcess.length} 张图片需要上传`);
      
        // 如果没有图片需要处理，直接进入下一步
        if (illustrationsToProcess.length === 0) {
          console.log('[预处理发布章节] 没有需要上传的图片，跳过图片处理步骤');
        } else {
          // 批量处理图片上传，记录失败的图片以便重试
          let processResults = await Promise.allSettled(
            illustrationsToProcess.map(async ({ illustration, imagePath }) => 
              this.uploadSingleImage(illustration, imagePath))
          );
          
          // 处理上传结果
          let successfulUploads = processResults
            .filter((result): result is PromiseFulfilledResult<{success: true, illustration: any, imageCid: string}> => 
              result.status === 'fulfilled' && result.value.success
            )
            .map(result => result.value);
          
          let failedUploads = processResults
            .filter(result => result.status === 'rejected' || (result.status === 'fulfilled' && !result.value.success))
            .length;
          
          console.log(`[预处理发布章节] 首次图片处理完成: 成功 ${successfulUploads.length}, 失败 ${failedUploads}`);
          
          // 重试机制: 对失败的图片进行最多2次重试
          if (failedUploads > 0) {
            console.log('[预处理发布章节] 检测到失败的图片上传，开始重试...');
            
            // 识别失败的图片
            const failedIllustrations = illustrationsToProcess.filter(item => 
              !successfulUploads.some(success => success.illustration.id === item.illustration.id)
            );
            
            // 最多重试2次
            for (let retryCount = 0; retryCount < 2 && failedIllustrations.length > 0; retryCount++) {
              console.log(`[预处理发布章节] 开始第 ${retryCount + 1} 次重试，共 ${failedIllustrations.length} 张图片`);
              
              // 批量重试上传
              const retryResults = await Promise.allSettled(
                failedIllustrations.map(async ({ illustration, imagePath }) => 
                  this.uploadSingleImage(illustration, imagePath))
              );
              
              // 处理重试结果
              const retrySuccesses = retryResults
        .filter((result): result is PromiseFulfilledResult<{success: true, illustration: any, imageCid: string}> => 
          result.status === 'fulfilled' && result.value.success
        )
        .map(result => result.value);
      
              // 更新成功和失败计数
              successfulUploads = [...successfulUploads, ...retrySuccesses];
              
              // 更新剩余需要重试的图片列表
              for (const success of retrySuccesses) {
                const index = failedIllustrations.findIndex(item => item.illustration.id === success.illustration.id);
                if (index !== -1) {
                  failedIllustrations.splice(index, 1);
                }
              }
              
              failedUploads = failedIllustrations.length;
              console.log(`[预处理发布章节] 第 ${retryCount + 1} 次重试结果: 成功 ${retrySuccesses.length}, 剩余失败 ${failedUploads}`);
              
              if (failedUploads === 0) {
                console.log('[预处理发布章节] 重试成功，所有图片已上传');
                break;
              }
            }
          }
          
          // 如果所有图片都上传失败，中止发布
          if (failedUploads > 0 && successfulUploads.length === 0 && illustrationsToProcess.length > 0) {
            console.error('[预处理发布章节] 错误: 所有图片上传失败，中止发布流程');
            throw new Error('所有图片上传失败，请检查网络连接或稍后重试');
          }
          
          // 如果仍有部分图片失败，记录警告但继续发布
          if (failedUploads > 0) {
            const failPercent = Math.round((failedUploads / illustrationsToProcess.length) * 100);
            console.warn(`[预处理发布章节] 警告: ${failedUploads}张图片(${failPercent}%)上传失败，但有${successfulUploads.length}张成功，继续发布流程`);
          }

          // 使用事务来确保数据一致性
          const { illustrations, urlMapping } = await prisma.$transaction(async (tx) => {
            // 1. 更新所有成功上传的图片的CID
            const updatePromises = successfulUploads.map(({ illustration, imageCid }) =>
              tx.illustration.update({
                where: { id: illustration.id },
                data: { imageCID: imageCid }
              })
            );

            // 2. 等待所有更新完成
            await Promise.all(updatePromises);

            // 3. 获取最新的chapter数据，包含所有更新后的illustrations
            const updatedChapter = await tx.chapter.findUnique({
              where: { id },
              include: {
                illustrations: {
                  select: {
                    id: true,
                    filePath: true,
                    imageCID: true,
                    fileName: true,
                    description: true,
                    status: true
                  }
                }
              }
            });

            if (!updatedChapter) {
              throw new Error('无法获取更新后的章节数据');
            }

            // 4. 构建路径映射
            const pathToCid = new Map();
            updatedChapter.illustrations.forEach(ill => {
              if (ill.imageCID && ill.filePath) {
                console.log(`[预处理发布章节] 添加替换映射: ${ill.filePath} -> ${ill.imageCID}`);
                pathToCid.set(ill.filePath, ill.imageCID);
              }
            });

            return {
              illustrations: updatedChapter.illustrations,
              urlMapping: pathToCid
            };
          });

          console.log('[预处理发布章节] 数据库更新完成，开始替换URL');
          console.log(`[预处理发布章节] 需要替换的路径数: ${urlMapping.size}`);
          console.log('[预处理发布章节] 最新的illustrations数据:', 
            illustrations.map(ill => ({
              id: ill.id,
              filePath: ill.filePath,
              imageCID: ill.imageCID
            }))
          );

          // 替换内容中的图片URL
          let replacementCount = 0;
          const contentImgTags = processedContent.match(/<img[^>]+>/g) || [];
          console.log(`[预处理发布章节] 内容中的图片标签数: ${contentImgTags.length}`);
          
          // 使用事务中获取的映射进行替换
          for (const [localPath, cid] of urlMapping.entries()) {
            const ipfsUrl = `https://${PINATA_GATEWAY}/ipfs/${cid}`;
            console.log(`[预处理发布章节] 替换路径: ${localPath} -> ${ipfsUrl}`);
            
            // 使用正则表达式替换img标签中的src
            const escapedPath = localPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const imgRegex = new RegExp(`(<img[^>]*src=")${escapedPath}("[^>]*>)`, 'g');
            
            const beforeReplace = processedContent;
            processedContent = processedContent.replace(imgRegex, `$1${ipfsUrl}$2`);
            
            if (beforeReplace !== processedContent) {
              console.log(`[预处理发布章节] 成功替换路径`);
              replacementCount++;
            } else {
              // 如果直接替换失败，尝试URL解码后再替换
              const decodedPath = decodeURIComponent(localPath);
              if (decodedPath !== localPath) {
                const decodedRegex = new RegExp(`(<img[^>]*src=")${decodedPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}("[^>]*>)`, 'g');
                processedContent = processedContent.replace(decodedRegex, `$1${ipfsUrl}$2`);
                
                if (beforeReplace !== processedContent) {
                  console.log(`[预处理发布章节] 使用解码路径成功替换`);
                  replacementCount++;
                } else {
                  console.warn(`[预处理发布章节] 警告: 未能替换路径 ${localPath}`);
                }
              }
            }
          }
          
          // 4. 验证替换结果
          const remainingLocalPaths = processedContent.match(/http:\/\/localhost:3001\/uploads\/[^"]+/g) || [];
          const ipfsLinks = processedContent.match(/https:\/\/[^/]+\/ipfs\/[^"]+/g) || [];
          
          console.log(`[预处理发布章节] 替换结果:`);
          console.log(`- 成功替换数量: ${replacementCount}`);
          console.log(`- IPFS链接数量: ${ipfsLinks.length}`);
          console.log(`- 剩余本地路径数量: ${remainingLocalPaths.length}`);
          
          // 5. 如果还有本地路径未被替换，中止发布
          if (remainingLocalPaths.length > 0) {
            console.error('[预处理发布章节] 错误: 仍有本地路径未被替换:', remainingLocalPaths);
            throw new Error('存在未替换的本地图片路径，无法继续发布');
          }
          
          // 6. 如果应该有替换但是一个都没替换成功，也中止发布
          if (urlMapping.size > 0 && replacementCount === 0) {
            console.error('[预处理发布章节] 错误: 路径替换完全失败');
            console.error('- 待替换路径:', Array.from(urlMapping.keys()));
            console.error('- 内容中的图片标签:', contentImgTags);
            throw new Error('图片路径替换失败，无法继续发布');
          }
        }
      } else {
        console.log('[预处理发布章节] 这是一个纯文本章节，跳过图片处理');
      }

      // 无论是否有图片，都需要上传内容到 IPFS
      console.log('[预处理发布章节] 开始上传章节内容到 IPFS:', {
        contentLength: processedContent.length,
        hasContent: !!processedContent
      });

      if (!processedContent) {
        console.error('[预处理发布章节] 错误: 章节内容为空');
        throw new Error('章节内容不能为空');
      }

      const contentCid = await uploadToIPFS(processedContent);
      console.log('[预处理发布章节] 成功上传章节内容到 IPFS:', { contentCid });

      // 更新章节状态
      const updatedChapter = await prisma.chapter.update({
        where: { id },
        data: {
          status: 'UNDERREVIEW',
          contentCid,
          updatedAt: new Date()
        }
      });
      console.log('[预处理发布章节] 成功更新章节状态为预发布');

      // 返回结果
      return {
        contentCid,
        imageCount: chapter.illustrations.length,
        processedImageCount: chapter.illustrations.filter(ill => !!ill.imageCID).length,
        failedImageCount: chapter.illustrations.filter(ill => !ill.imageCID && ill.filePath).length
      };

    } catch (error) {
      console.error('[预处理发布章节] 发布准备失败:', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
      throw new Error('章节发布准备失败: ' + (error instanceof Error ? error.message : String(error)));
    }
  }
  
  // 辅助方法：上传单个图片
  private async uploadSingleImage(illustration: any, imagePath: string) {
    try {
      console.log(`[预处理发布章节] 开始处理图片: ${illustration.id}`);
      
      // 读取图片文件并创建 File 对象
      const imageBuffer = await fs.promises.readFile(imagePath);
      console.log('[预处理发布章节] 成功读取图片文件:', {
        illustrationId: illustration.id,
        size: imageBuffer.length,
        fileName: illustration.fileName
      });

      const imageFile = new File([imageBuffer], illustration.fileName || 'image.png', {
        type: 'image/png'
      });

      // 上传图片到 IPFS
      console.log('[预处理发布章节] 开始上传图片到 IPFS');
      const imageCid = await uploadImageToIPFS(imageFile);
      console.log('[预处理发布章节] 成功上传图片到 IPFS:', {
        illustrationId: illustration.id,
        imageCid,
        fileName: illustration.fileName
      });

      // 更新数据库中的 imageCID。这样就能保证路径和CID的对应关系。
      await prisma.illustration.update({
        where: { id: illustration.id },
        data: { imageCID: imageCid }
      });
      console.log('[预处理发布章节] 成功更新数据库中的 imageCID');
      
      return {
        success: true,
        illustration,
        imageCid
      };
    } catch (error) {
      console.error('[预处理发布章节] 图片处理失败:', {
        illustrationId: illustration.id,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
      
      return {
        success: false,
        illustration,
        error
      };
    }
  }

  /**
   * 完成章节发布流程（在交易确认后调用）
   * @param id 章节ID
   * @param txHash 交易哈希
   * @returns 更新后的章节
   */
  async completeChapterPublish(id: string, txHash: string) {
    console.log('[完成发布章节] 开始处理:', { id, txHash });

    try {
      const chapter = await prisma.chapter.findUnique({
        where: { id },
        include: {
          illustrations: {
            select: {
              id: true,
              imageCID: true
            }
          }
        }
      });

      if (!chapter) {
        throw new Error('章节不存在');
      }

      if (chapter.status !== 'UNDERREVIEW') {
        throw new Error('章节状态错误，必须是预发布状态');
      }
      
      // 分析图片上传状态
      const totalImages = chapter.illustrations.length;
      const uploadedImages = chapter.illustrations.filter(img => !!img.imageCID).length;
      
      console.log('[完成发布章节] 图片上传状态:', {
        totalImages, 
        uploadedImages,
        missingImages: totalImages - uploadedImages
      });

      // 更新章节状态为已发布
      const updatedChapter = await prisma.chapter.update({
        where: { id },
        data: {
          status: 'PUBLISHED',
          txHash,
          updatedAt: new Date()
        }
      });
      
      console.log('[完成发布章节] 章节发布完成:', {
        id,
        title: updatedChapter.title,
        status: updatedChapter.status
      });

      return updatedChapter;
    } catch (error) {
      console.error('[完成发布章节] 更新失败:', error);
      throw error;
    }
  }

  // 原有的 publishChapter 方法保持不变，用于兼容旧的调用
  async publishChapter(id: string, authorAddress: string, storyId?: string, txHash?: string) {
    console.log('[发布章节] 开始发布章节:', { id, authorAddress, storyId });
    
    const chapter = await prisma.chapter.findUnique({
      where: { id },
      include: {
        illustrations: {
          select: {
            id: true,
            filePath: true,
            imageCID: true,
            fileName: true,
            description: true,
            status: true
          }
        }
      }
    });

    if (!chapter) {
      console.log('[发布章节] 错误: 章节不存在');
      throw new Error('章节不存在');
    }

    console.log('[发布章节] 章节信息:', {
      id: chapter.id,
      title: chapter.title,
      illustrationsCount: chapter.illustrations.length,
      hasContent: !!chapter.content,
      contentLength: chapter.content?.length || 0
    });

    try {
      // 1. 处理章节中的图片
      let processedContent = chapter.content || '';
      console.log('[发布章节] 开始处理插画:', {
        chapterId: id,
        illustrationsCount: chapter.illustrations.length,
        contentLength: processedContent.length
      });

      // 记录内容中的所有图片标签
      const imgTagRegex = /<img[^>]+>/g;
      const imgTags = processedContent.match(imgTagRegex) || [];
      console.log('[发布章节] 内容中的图片标签数量:', imgTags.length);
      
      // 记录每个图片标签的src和position属性
      imgTags.forEach((tag, index) => {
        const srcMatch = tag.match(/src="([^"]+)"/);
        const posMatch = tag.match(/data-position="([^"]+)"/);
        console.log(`[发布章节] 图片标签 ${index + 1}:`, {
          src: srcMatch ? srcMatch[1] : '无src',
          position: posMatch ? posMatch[1] : '无position'
        });
      });

      // 提取所有图片的信息
      for (const illustration of chapter.illustrations) {
        console.log('[发布章节] 处理插画:', {
          id: illustration.id,
          fileName: illustration.fileName,
          filePath: illustration.filePath,
          description: illustration.description,
          status: illustration.status,
          hasImageCID: !!illustration.imageCID
        });

        if (!illustration.filePath) {
          console.log('[发布章节] 跳过处理：插画缺少文件路径');
          continue;
        }

        try {
          // 如果已经有 CID，直接使用
          if (illustration.imageCID) {
            console.log('[发布章节] 图片已有 CID，跳过上传:', {
              id: illustration.id,
              imageCID: illustration.imageCID
            });
            continue;
          }

          // 从完整URL中提取相对路径
          const urlPath = new URL(illustration.filePath);
          const relativePath = urlPath.pathname.substring(1);
          const imagePath = path.join(process.cwd(), relativePath);

          console.log('[发布章节] 准备读取图片文件:', {
            illustrationId: illustration.id,
            fileName: illustration.fileName,
            imagePath
          });

          // 检查文件是否存在
          try {
            await fs.promises.access(imagePath);
            console.log('[发布章节] 文件存在，继续处理');
          } catch (error) {
            console.error('[发布章节] 文件不存在，跳过处理:', {
              imagePath,
              error: error instanceof Error ? error.message : String(error)
            });
            continue;
          }

          // 读取图片文件并创建 File 对象
          const imageBuffer = await fs.promises.readFile(imagePath);
          console.log('[发布章节] 成功读取图片文件:', {
            size: imageBuffer.length,
            fileName: illustration.fileName
          });

          const imageFile = new File([imageBuffer], illustration.fileName || 'image.png', {
            type: 'image/png'
          });

          // 使用 uploadImageToIPFS 上传图片
          console.log('[发布章节] 开始上传图片到 IPFS');
          let imageCid;
          try {
            imageCid = await uploadImageToIPFS(imageFile);
            console.log('[发布章节] 成功上传图片到 IPFS:', {
              illustrationId: illustration.id,
              imageCid,
              fileName: illustration.fileName
            });

            // 更新数据库中的 imageCID
            await prisma.illustration.update({
              where: { id: illustration.id },
              data: { imageCID: imageCid }
            });
            console.log('[发布章节] 成功更新数据库中的 imageCID');

            // 替换内容中的图片 URL
            const imageUrl = `https://${PINATA_GATEWAY}/ipfs/${imageCid}`;
            const imgRegex = new RegExp(`<img[^>]*src="${illustration.filePath}"[^>]*>`, 'g');
            const oldContent = processedContent;
            processedContent = processedContent.replace(imgRegex, (match) => {
              return match.replace(`src="${illustration.filePath}"`, `src="${imageUrl}"`);
            });

            // 检查是否成功替换了URL
            if (oldContent === processedContent) {
              console.warn('[发布章节] 警告: 未找到匹配的图片URL进行替换:', {
                illustrationId: illustration.id,
                filePath: illustration.filePath
              });
            } else {
              console.log('[发布章节] 成功替换图片URL:', {
                illustrationId: illustration.id,
                oldUrl: illustration.filePath,
                newUrl: imageUrl
              });
            }
          } catch (uploadError) {
            console.error('[发布章节] 图片上传失败:', {
              illustrationId: illustration.id,
              fileName: illustration.fileName,
              error: uploadError instanceof Error ? uploadError.message : String(uploadError)
            });
            // 记录错误但继续处理其他图片
            continue;
          }
        } catch (error) {
          console.error('[发布章节] 处理插画失败:', {
            illustrationId: illustration.id,
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined
          });
          // 记录错误但继续处理其他图片
          continue;
        }
      }

      // 2. 上传处理后的内容
      console.log('[发布章节] 开始上传处理后的内容到 IPFS:', {
        contentLength: processedContent.length,
        hasContent: !!processedContent
      });

      const contentCid = await uploadToIPFS(processedContent);
      console.log('[发布章节] 成功上传章节内容到 IPFS:', { contentCid });

      // 3. 更新章节状态
      const updatedChapter = await prisma.chapter.update({
        where: { id },
        data: {
          status: 'PUBLISHED',
          contentCid,
          txHash,
          updatedAt: new Date()
        }
      });
      console.log('[发布章节] 成功更新章节状态为已发布');

      return updatedChapter;
    } catch (error) {
      console.error('[发布章节] 发布失败:', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
      throw new Error('发布章节失败');
    }
  }

  // 更新章节（保存章节）
  async updateChapter(id: string, data: {
    title?: string
    content?: string
    order?: number
    wordCount?: number
  }, storyId?: string) {
    // 如果提供了 storyId，先验证章节是否属于该故事
    if (storyId) {
      const chapter = await prisma.chapter.findUnique({
        where: { id },
        include: { story: true }
      });
      
      if (!chapter) {
        throw new Error('章节不存在');
      }
      
      if (chapter.storyId !== storyId) {
        throw new Error('章节不属于指定的故事');
      }
    }
    
    // 如果更新了内容，同步清理不再使用的插图记录。
    if (data.content && storyId) {
      console.log('[章节保存] 检测到内容更新，开始清理不再使用的插图数据');
      
      try {
        // 获取章节当前所有插图记录
        const existingIllustrations = await prisma.illustration.findMany({
          where: { chapterId: id }
        });
        
        console.log(`[章节保存] 数据库中存在 ${existingIllustrations.length} 张插图记录`);
        
        // 从新的内容中提取所有图片位置信息
        const imgPositionsInContent = new Set<number>();
        const imgRegex = /<img[^>]*data-position="(\d+)"[^>]*>/g;
        let match;
        
        while ((match = imgRegex.exec(data.content)) !== null) {
          const position = parseInt(match[1]);
          imgPositionsInContent.add(position);
        }
        
        console.log(`[章节保存] 当前内容中存在 ${imgPositionsInContent.size} 张图片`);
        console.log(`[章节保存] 内容中的图片位置: ${Array.from(imgPositionsInContent).join(', ')}`);
        
        // 找出需要删除的插图（不再出现在内容中的图片）
        const illustrationsToDelete = existingIllustrations.filter(ill => {
          // 调试每条记录的信息
          console.log(`[章节保存] 检查插图记录:`, {
            id: ill.id,
            fileName: ill.fileName,
            description: ill.description
          });
          
          if (!ill.description) {
            console.log(`[章节保存] 插图 ${ill.id} 没有描述信息，无法确定位置`);
            return false; // 没有描述信息，无法确定位置
          }
          
          // 从描述中提取位置信息
          const posMatch = ill.description.match(/position:(\d+)/);
          if (!posMatch) {
            console.log(`[章节保存] 插图 ${ill.id} 描述中没有位置信息:`, ill.description);
            return false; // 描述中没有位置信息
          }
          
          const position = parseInt(posMatch[1]);
          const shouldDelete = !imgPositionsInContent.has(position);
          
          console.log(`[章节保存] 插图 ${ill.id} 位置 ${position} ${shouldDelete ? '需要删除' : '保留'}`);
          
          return shouldDelete;
        });
        
        // 也尝试通过文件名匹配位置
        if (illustrationsToDelete.length === 0 && existingIllustrations.length > imgPositionsInContent.size) {
          console.log(`[章节保存] 通过描述未找到需要删除的插图，尝试通过文件名匹配`);
          
          const usedPositions = new Set<number>(); // 记录已经被内容中图片使用的位置
          
          // 再次过滤，这次包括通过文件名匹配
          const moreToDel = existingIllustrations.filter(ill => {
            // 如果已经通过描述确定要删除，不重复处理
            if (illustrationsToDelete.some(d => d.id === ill.id)) {
              return false;
            }
            
            // 尝试从文件名中提取位置
            if (!ill.fileName) {
              console.log(`[章节保存] 插图 ${ill.id} 没有文件名，跳过`);
              return false;
            }
            
            const fileNameMatch = ill.fileName.match(/image-(\d+)\./);
            if (!fileNameMatch) {
              console.log(`[章节保存] 插图 ${ill.id} 文件名格式不符合预期:`, ill.fileName);
              return false;
            }
            
            const position = parseInt(fileNameMatch[1]);
            
            // 检查这个位置是否已经被使用
            if (usedPositions.has(position)) {
              console.log(`[章节保存] 插图 ${ill.id} 位置 ${position} 已被其他图片使用，需要删除`);
              return true; // 位置重复，需要删除
            }
            
            const shouldDelete = !imgPositionsInContent.has(position);
            
            if (!shouldDelete) {
              usedPositions.add(position); // 记录这个位置已被使用
            }
            
            console.log(`[章节保存] 插图 ${ill.id} 文件名位置 ${position} ${shouldDelete ? '需要删除' : '保留'}`);
            
            return shouldDelete;
          });
          
          // 合并两种方法找到的待删除图片
          illustrationsToDelete.push(...moreToDel);
        }
        
        console.log(`[章节保存] 需要删除 ${illustrationsToDelete.length} 张不再使用的插图记录`);
        
        // 删除不再使用的插图记录和文件
        if (illustrationsToDelete.length > 0) {
          for (const ill of illustrationsToDelete) {
            console.log(`[章节保存] 删除插图记录: ${ill.id}, 位置: ${ill.description}`);
            
            try {
              // 尝试删除文件系统中的文件
              if (ill.fileName) {
                const uploadDir = `uploads/drafts/${storyId}/${id}`;
                const filePath = `${uploadDir}/${ill.fileName}`;
                
                try {
                  await fs.promises.unlink(filePath).catch((err) => {
                    console.log(`[章节保存] 文件删除失败 ${filePath}:`, err);
                  });
                  console.log(`[章节保存] 文件删除成功: ${filePath}`);
                } catch (fileError) {
                  console.error(`[章节保存] 删除文件出错: ${filePath}`, fileError);
                }
              }
              
              // 删除数据库记录
              await prisma.illustration.delete({
                where: { id: ill.id }
              });
              console.log(`[章节保存] 数据库记录删除成功: ${ill.id}`);
            } catch (error) {
              console.error(`[章节保存] 删除插图记录失败 ${ill.id}:`, error);
            }
          }
          
          console.log(`[章节保存] 已完成删除 ${illustrationsToDelete.length} 张不再使用的插图`);
        }
      } catch (error) {
        console.error('[章节保存] 清理插图数据时出错:', error);
        // 不中断保存过程，继续更新章节
      }
    }
    
    // 更新章节
    return await prisma.chapter.update({
      where: { id },
      data
    });
  }


  // 删除章节
  async deleteChapter(id: string, storyId?: string) {
    console.log('[删除章节] 开始处理:', { id, storyId });

    try {
      // 1. 验证章节存在且属于指定故事
      const chapter = await prisma.chapter.findUnique({
        where: { id },
        include: {
          illustrations: true,
          story: true
        }
      });
      
      if (!chapter) {
        console.log('[删除章节] 错误: 章节不存在');
        throw new Error('章节不存在');
      }
      
      if (storyId && chapter.storyId !== storyId) {
        console.log('[删除章节] 错误: 章节不属于指定的故事');
        throw new Error('章节不属于指定的故事');
      }

      // 2. 删除相关的图片文件
      if (chapter.illustrations.length > 0) {
        console.log(`[删除章节] 开始删除 ${chapter.illustrations.length} 张插图文件`);
        
        const uploadDir = `uploads/drafts/${chapter.storyId}/${chapter.id}`;
        try {
          // 删除整个章节的图片目录
          await fs.promises.rm(uploadDir, { recursive: true, force: true });
          console.log(`[删除章节] 成功删除图片目录: ${uploadDir}`);
        } catch (error) {
          console.warn('[删除章节] 删除图片目录失败，可能目录已不存在:', error);
        }
      }

      // 3. 使用事务确保数据一致性
      const result = await prisma.$transaction(async (tx) => {
        // 3.1 删除所有相关的插图记录
        if (chapter.illustrations.length > 0) {
          await tx.illustration.deleteMany({
            where: { chapterId: id }
          });
          console.log(`[删除章节] 已删除 ${chapter.illustrations.length} 条插图记录`);
        }

        // 3.2 删除章节记录
        const currentOrder = chapter.order;
        console.log(`[删除章节] 当前章节顺序: ${currentOrder}`);
       
        // 更新章节顺序
        // 3.4 获取需要更新的后续章节
        const chaptersToUpdate = await tx.chapter.findMany({
          where: {
            storyId: chapter.storyId,
            order: {
              gt: currentOrder
            }
          },
          orderBy: {
            order: 'asc'
          }
        });
        console.log(`[删除章节] chaptersToUpdate: `, chaptersToUpdate);
        console.log(`[删除章节] chaptersToUpdate: `, chaptersToUpdate.length);


        const deletedChapter = await tx.chapter.delete({
          where: { id }
          });

        // 3.5 更新后续章节的顺序和标题
        for (const chapterToUpdate of chaptersToUpdate) {
          const newOrder = chapterToUpdate.order - 1;
          // const newTitle = `第${newOrder}章  `+chapterToUpdate.title;

           // 提取原标题中的实际内容部分（如果有）
          let titleContent = '';
          const titleMatch = chapterToUpdate.title.match(/^第\d+章\s*(.*)$/);
          if (titleMatch && titleMatch[1]) {
            titleContent = titleMatch[1].trim();
          }
          
          // 构建新标题，保留原有标题内容
          const newTitle = titleContent ? `第${newOrder}章 ${titleContent}` : `第${newOrder}章`;
  

          console.log(`[删除章节] 更新章节顺序和标题: ${chapterToUpdate.id}, 新顺序: ${newOrder}, 
            新标题: ${newTitle}`);
          await tx.chapter.update({
            where: { id: chapterToUpdate.id },
            data: {
              order: newOrder,
              title: newTitle
            }
          });
        }
        console.log('[删除章节] 已删除章节记录');

        return deletedChapter;
      });

      console.log('[删除章节] 删除完成:', {
        chapterId: id,
        title: result.title,
        deletedIllustrationsCount: chapter.illustrations.length
      });

      return result;
    } catch (error) {
      console.error('[删除章节] 删除失败:', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
      throw error;
    }
  }


  // 获取章节列表
  async getChaptersByStoryId(storyId: string, page: number = 1, limit: number = 50) {
    const skip = (page - 1) * limit;
    
    return await prisma.chapter.findMany({
      where: {
        storyId: storyId
      },
      orderBy: {
        order: 'asc'
      },
      skip,
      take: limit,
      select: {
        id: true,
        title: true,
        wordCount: true,
        order: true,
        status: true,
        createdAt: true,
        updatedAt: true
      }
    });
  }

  // 获取章节统计信息(有问题，获取所有章节数据太多，需要优化)
  async getChapterStats(storyId: string) {
    console.log(`[getChapterStats] 开始获取故事 ${storyId} 的章节统计信息`);
  
    try {
      // 使用单次查询获取所有状态的计数
      const stats = await prisma.chapter.groupBy({
        by: ['status'],
        where: {
          storyId: storyId
        },
        _count: {
          status: true
        }
      });
      
      // 初始化计数对象
      const statusCounts: Record<string, number> = {};
      let totalCount = 0;
      
      // 处理统计结果
      stats.forEach(stat => {
        const count = stat._count.status;
        statusCounts[stat.status || 'UNKNOWN'] = count;
        totalCount += count;
      });
      
      // 获取已发布和草稿的数量
      const publishedCount = statusCounts['PUBLISHED'] || 0;
      const draftCount = statusCounts['DRAFT'] || 0;
      
      console.log(`[getChapterStats] 统计结果: 总计=${totalCount}, 已发布=${publishedCount}, 草稿=${draftCount}`);
      
      // 检查数据一致性
      if (publishedCount + draftCount !== totalCount) {
        console.warn(`[getChapterStats] ⚠️ 数据不一致! 总数(${totalCount}) ≠ 已发布(${publishedCount}) + 草稿(${draftCount})`);
        console.warn(`[getChapterStats] 可能存在未定义的状态值，详情:`, statusCounts);
      }
      console.log(`[getChapterStats] 统计信息: `, statusCounts);
      // 返回统计信息
      return {
        total: totalCount,
        published: publishedCount,
        draft: draftCount,
        statusCounts: statusCounts
      };
    } catch (error) {
      console.error(`[getChapterStats] 获取统计信息失败:`, error);
      throw new Error(`获取章节统计信息失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  // 获取最近的章节
  async getRecentChapters(storyId: string, limit: number = 10) {
    console.log(`[getRecentChapters] 开始获取故事 ${storyId} 的最近章节，限制数量: ${limit}`);
    
    try {
      const chapters = await prisma.chapter.findMany({
        where: {
          storyId: storyId
        },
        orderBy: {
          order: 'desc' // 按章节序号降序排列
        },
        take: limit,
        select: {
          id: true,
          title: true,
          order: true,
          status: true,
          wordCount: true,
          createdAt: true,
          updatedAt: true
        }
      });
      
      console.log(`[getRecentChapters] 查询到 ${chapters.length} 个章节`);

      // 打印章节详情
      if (chapters.length > 0) {
        console.table(chapters.map(c => ({
          id: c.id.substring(0, 8),
          order: c.order,
          title: c.title,
          status: c.status,
          wordCount: c.wordCount
        })));
      }
      
      return chapters;
    } catch (error) {
      console.error(`[getRecentChapters] 获取故事章节失败:`, error);
      throw error;
    }
  }
  
  // 获取指定范围的章节
  async getChaptersByRange(storyId: string, start: number, end: number) {
    return await prisma.chapter.findMany({
      where: {
        storyId: storyId,
        order: {
          gte: end,
          lte: start
        }
      },
      orderBy: {
        order: 'desc' // 按章节序号降序排列
      },
      select: {
        id: true,
        title: true,
        order: true,
        status: true,
        wordCount: true,
        createdAt: true,
        updatedAt: true
      }
    });
  }
  
  // 搜索章节
  async searchChapters(storyId: string, keyword: string) {
    return await prisma.chapter.findMany({
      where: {
        storyId: storyId,
        title: {
          contains: keyword,
          mode: 'insensitive' // 不区分大小写
        }
      },
      orderBy: {
        order: 'desc' // 按章节序号降序排列
      },
      select: {
        id: true,
        title: true,
        order: true,
        status: true,
        wordCount: true,
        createdAt: true,
        updatedAt: true
      }
    });
  }

 // 获取章节内容
 async getChapter(id: string, storyId?: string) {
  // @ts-ignore - 忽略类型检查，因为我们已经修改了 Prisma 模型
  const chapter = await prisma.chapter.findUnique({
    where: { 
      id,
      ...(storyId ? { storyId } : {})
    },
    include: {
      story: {
        include: {
          author: true
        }
      },
      illustrations: true  // 确保包含 illustrations 关系
    }
  })

  if (!chapter) throw new Error('Chapter not found')
  
  // 如果提供了 storyId 但章节不属于该故事，则拒绝访问
  if (storyId && chapter.storyId !== storyId) {
    throw new Error('章节不属于指定的故事')
  }

  // 如果是草稿状态，直接返回chapter（无论content是否为空）
  if (chapter.status === 'DRAFT') {
    // 确保content字段存在，如果不存在则设为空字符串
    return { ...chapter, content: chapter.content || '' };
  }

  // 如果是已发布状态，从IPFS获取内容
  if (chapter.contentCid) {
    try {
      console.log(`尝试从IPFS获取章节内容 (章节ID: ${id}, CID: ${chapter.contentCid})`);
      const content = await getFromIPFS(chapter.contentCid);
      console.log(`成功从IPFS获取内容，内容长度: ${content ? content.length : 0} 字符`);
      console.log(`成功从IPFS获取内容，内容: ${content}`);
      return { ...chapter, content };
    } catch (error) {
      console.error(`从IPFS获取内容失败 (章节ID: ${id}, CID: ${chapter.contentCid}):`, error);
      
      // 如果IPFS获取失败，尝试使用数据库中的content字段作为备份
      if (chapter.content) {
        console.log(`使用数据库中的content字段作为备份，内容长度: ${chapter.content.length} 字符`);
        return { ...chapter, content: chapter.content };
      }
      
      // 如果数据库中也没有content，则返回空内容
      console.warn(`IPFS获取失败且数据库中也没有content字段，返回空内容`);
      return { ...chapter, content: '' };
    }
  }
  
  // 如果既不是草稿也没有contentCid，返回章节数据但内容为空
  console.warn(`章节 ${id} 状态为 ${chapter.status}，但没有contentCid，返回空内容`);
  return { ...chapter, content: '' };
 }

  // 通过章节顺序获取章节
  async getChapterByOrder(storyId: string, order: number) {
    console.log('[StoryService.getChapterByOrder] 开始获取章节:', {
      storyId,
      order
    });

    try {
      const chapter = await prisma.chapter.findFirst({
        where: {
          storyId,
          order,
          status: 'PUBLISHED'
        },
        include: {
          story: {
            include: {
              author: true,
              _count: {
                select: {
                  chapters: {
                    where: {
                      status: 'PUBLISHED'
                    }
                  }
                }
              }
            }
          }
        }
      });

      if (!chapter) {
        return null;
      }

      console.log(`成功获取章节: ${chapter.title}`);
      console.log(`章节内容: ${chapter.content}`);

      // 格式化返回数据
      return {
        id: chapter.id,
        title: chapter.title,
        content: chapter.content || '',
        order: chapter.order,
        status: chapter.status,
        wordCount: chapter.wordCount,
        totalChapters: chapter.story._count.chapters,
        author: {
          name: chapter.story.author.nickname || chapter.story.author.authorName || '',
          avatar: chapter.story.author.avatar || null
        }
      };
    } catch (error) {
      console.error('[StoryService.getChapterByOrder] 获取章节失败:', error);
      throw error;
    }
  }

  /**
   * 上传章节插画
   * @param storyId 故事ID
   * @param chapterId 章节ID
   * @param file 上传的文件
   * @param position 图片在章节中的位置
   * @returns 插画信息
   */
  async uploadChapterImage(storyId: string, chapterId: string, file: Express.Multer.File, position?: number): Promise<Omit<Illustration, 'fileContent'>> {
    console.log('[插画上传] 开始处理:', {
      storyId,
      chapterId,
      fileName: file.originalname,
      fileType: file.mimetype,
      fileSize: file.size,
      position
    });

    // 验证章节存在且属于指定故事
    console.log('[插画上传] 验证章节归属');
    const chapter = await prisma.chapter.findFirst({
      where: { 
        id: chapterId,
        storyId: storyId
      }
    });
    
    if (!chapter) {
      console.log('[插画上传] 错误: 章节不存在或不属于该故事');
      throw new Error('Chapter not found in this story');
    }

    // 验证文件类型
    if (!file.mimetype.startsWith('image/')) {
      console.log('[插画上传] 错误: 文件类型不是图片');
      throw new Error('Only image files are allowed');
    }

    // 验证文件大小 (5MB)
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      console.log('[插画上传] 错误: 文件大小超过限制');
      throw new Error('File size exceeds 5MB limit');
    }

    try {
      // 创建存储目录，如果目录不存在则创建，如果目录存在则不创建，
      const uploadDir = `uploads/drafts/${storyId}/${chapterId}`;
      await fs.promises.mkdir(uploadDir, { recursive: true });

      // 获取当前章节的所有图片
      const existingImages = await prisma.illustration.findMany({
        where: { chapterId },
        orderBy: { fileName: 'asc' }
      });

      // 预设文件名和变量
      let existingImage = null;
      const fileExt = file.originalname.split('.').pop() || 'png';
      let fileName = '';

      // 处理图片位置和文件名 
      // 注意：我们假设所有上传的图片都应该有位置信息
      if (!position) {
        console.log('[插画上传] 警告: 未提供位置信息，将使用默认位置1');
        position = 1; // 设置默认位置
      }
      
      // 始终使用位置作为文件名，确保一致性
      fileName = `image-${position}.${fileExt}`;
      
      // 通过文件名查找同位置图片，更可靠的匹配方式
      existingImage = existingImages.find(img => {
        if (!img.fileName) return false;
        
        const match = img.fileName.match(/image-(\d+)\./);
        return match && parseInt(match[1]) === position;
      });
      
      if (existingImage) {
        console.log('[插画上传] 找到相同位置的已存在图片，将覆盖:', {
          id: existingImage.id,
          oldFileName: existingImage.fileName,
          newFileName: fileName
        });
      } else {
        console.log('[插画上传] 未找到相同位置图片，使用位置编号创建新图片:', fileName);
      }

      console.log('[插画上传] 将使用文件名:', fileName);

      // 生成文件路径
      const filePath = `${uploadDir}/${fileName}`;
      const fullUrl = `http://localhost:3001/${filePath}`;

      console.log('[插画上传] 保存文件到:', filePath);

      // 保存文件到文件系统 - 如果文件已存在会覆盖
      await fs.promises.writeFile(filePath, file.buffer);

      // 创建描述信息，始终包含位置
      const description = `Chapter image at position:${position}`;

      let illustration;
      if (existingImage) {
        // 如果存在相同位置的图片，更新它
        console.log('[插画上传] 更新现有图片记录:', existingImage.id);
        illustration = await prisma.illustration.update({
          where: { id: existingImage.id },
          data: {
            fileName, // 更新文件名
            fileType: file.mimetype,
            fileSize: file.size,
            filePath: fullUrl,
            description
          }
        });
      } else {
        // 如果不存在，创建新记录
        console.log('[插画上传] 创建新图片记录');
        illustration = await prisma.illustration.create({
          data: {
            chapterId,
            fileName,
            fileType: file.mimetype,
            fileSize: file.size,
            filePath: fullUrl,
            description,
            status: 'DRAFT'
          }
        });
      }

      console.log('[插画上传] 保存成功:', {
        id: illustration.id,
        fileName: illustration.fileName,
        fileSize: illustration.fileSize,
        filePath: illustration.filePath,
        description: illustration.description
      });
      
      return {
        id: illustration.id,
        chapterId: illustration.chapterId,
        fileName: illustration.fileName,
        fileType: illustration.fileType,
        fileSize: illustration.fileSize,
        filePath: illustration.filePath,
        description: illustration.description,
        status: illustration.status,
        imageCID: illustration.imageCID,
        createdAt: illustration.createdAt
      };
    } catch (error) {
      console.error('[插画上传] 处理失败:', error);
      throw new Error('Failed to upload image');
    }
  }

  /**
   * 获取章节插画列表
   * @param storyId 故事ID
   * @param chapterId 章节ID
   * @returns 插画列表
   */
  async getChapterIllustrations(storyId: string, chapterId: string): Promise<Illustration[]> {
    console.log('[插画列表] 开始获取:', { storyId, chapterId });

    // 验证章节存在且属于指定故事
    console.log('[插画列表] 验证章节归属');
    const chapter = await prisma.chapter.findFirst({
      where: { 
        id: chapterId,
        storyId: storyId
      }
    });
    
    if (!chapter) {
      console.log('[插画列表] 错误: 章节不存在或不属于该故事');
      throw new Error('Chapter not found in this story');
    }

    const illustrations = await prisma.illustration.findMany({
      where: {
        chapterId
      },
      orderBy: {
        createdAt: 'asc'
      }
    });

    console.log('[插画列表] 获取成功:', { count: illustrations.length });
    return illustrations;
  }

  /**
   * 删除章节插画
   * @param storyId 故事ID
   * @param chapterId 章节ID
   * @param illustrationId 插画ID
   */
  async deleteIllustration(storyId: string, chapterId: string, illustrationId: string): Promise<void> {
    console.log('[插画删除] 开始处理:', { storyId, chapterId, illustrationId });

    // 验证章节存在且属于指定故事
    console.log('[插画删除] 验证章节归属');
    const chapter = await prisma.chapter.findFirst({
      where: { 
        id: chapterId,
        storyId: storyId
      }
    });
    
    if (!chapter) {
      console.log('[插画删除] 错误: 章节不存在或不属于该故事');
      throw new Error('Chapter not found in this story');
    }

    // 验证插画属于指定章节
    console.log('[插画删除] 验证插画归属');
    const illustration = await prisma.illustration.findFirst({
      where: { 
        id: illustrationId,
        chapterId: chapterId
      }
    });

    if (!illustration) {
      console.log('[插画删除] 错误: 插画不存在或不属于该章节');
      throw new Error('Illustration not found in this chapter');
    }

    console.log('[插画删除] 开始删除');
    await prisma.illustration.delete({
      where: { id: illustrationId }
    });
    console.log('[插画删除] 删除成功');
  }

  /**
   * 检查用户是否点赞了故事
   */
  async checkUserLikedStory(userId: string, storyId: string) {
    return await prisma.like.findFirst({
      where: {
        userId,
        storyId
      }
    });
  }

  /**
   * 点赞故事
   */
  async likeStory(userId: string, storyId: string) {
    // 检查是否已点赞
    const existingLike = await this.checkUserLikedStory(userId, storyId);
    
    if (existingLike) {
      return { success: false, message: '已经点赞过该故事' };
    }
    
    // 创建点赞记录
    const like = await prisma.like.create({
      data: {
        userId,
        storyId
      }
    });
    
    return { success: true, like };
  }

  /**
   * 取消点赞故事
   */
  async unlikeStory(userId: string, storyId: string) {
    // 检查是否已点赞
    const existingLike = await this.checkUserLikedStory(userId, storyId);
    
    if (!existingLike) {
      return { success: false, message: '未点赞该故事' };
    }
    
    // 删除点赞记录
    await prisma.like.delete({
      where: {
        id: existingLike.id
      }
    });
    
    return { success: true };
  }
}

// 导出单例实例
export const storyService = new StoryService() 