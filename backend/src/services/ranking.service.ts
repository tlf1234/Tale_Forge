import { PrismaClient } from '@prisma/client';
import prisma from '../prisma';

/**
 * 榜单服务 - 负责获取各种榜单数据
 */
export class RankingService {
  private prisma: PrismaClient;

  constructor() {
    this.prisma = prisma;
  }

  /**
   * 获取作家榜单
   * @param sortBy 排序方式: earnings(收益), readers(读者数), works(作品数), likes(获赞数)
   * @param timeRange 时间范围: weekly(周榜), monthly(月榜), yearly(年榜), all(总榜)
   * @param limit 返回数量
   */
  async getAuthorRankings(sortBy: string = 'earnings', timeRange: string = 'weekly', limit: number = 20) {
    console.log('[榜单服务] 获取作家榜单:', { sortBy, timeRange, limit });
    
    // 计算时间范围对应的日期
    const fromDate = this.getFromDate(timeRange);
    
    try {
      // 基本查询条件: 只查询作家和有效用户
      const baseWhere = {
        isAuthor: true,
      };
      
      // 查询用户/作家数据
      const authors = await this.prisma.user.findMany({
        where: baseWhere,
        select: {
          id: true,
          address: true,
          nickname: true,
          authorName: true,
          avatar: true,
          bio: true,
          isVerified: true,
          _count: {
            select: {
              stories: true, // 作品数
            }
          },
          stories: {
            select: {
              id: true,
              _count: {
                select: {
                  chapters: true, // 章节数
                  favorites: timeRange !== 'all' // 收藏数(带时间筛选)
                    ? { where: { createdAt: { gte: fromDate } } }
                    : true,
                  likes: timeRange !== 'all' // 点赞数(带时间筛选)
                    ? { where: { createdAt: { gte: fromDate } } }
                    : true,
                  readingHistories: timeRange !== 'all' // 阅读数(带时间筛选)
                    ? { where: { createdAt: { gte: fromDate } } }
                    : true
                }
              }
            }
          },
          // 获取用户被点赞数据
          likes: timeRange !== 'all'
            ? { where: { createdAt: { gte: fromDate } } }
            : undefined
        },
        take: limit
      });
      
      // 处理排序逻辑
      const rankedAuthors = authors.map(author => {
        // 计算总读者数 (不同作品的读者可能有重叠，这里简化处理)
        const totalReaders = author.stories.reduce((sum, story) => 
          sum + story._count.readingHistories, 0);
        
        // 计算总获赞数 (所有作品的点赞总数)
        const totalLikes = author.stories.reduce((sum, story) => 
          sum + story._count.likes, 0);
        
        // 计算总收益 (模拟数据，实际应从区块链或其他服务获取)
        // 这里使用 读者数 * 10 + 获赞数 * 5 作为模拟收益
        const earnings = totalReaders * 10 + totalLikes * 5;
        
        // 构建作者标签 (取决于作者的作品类型和特点)
        // 这里用随机标签模拟，实际应从作者的作品类型或专长中提取
        const tags = this.getRandomTags();
        
        return {
          id: author.id,
          address: author.address,
          authorName: author.authorName || author.nickname || '匿名作家',
          avatar: author.avatar || '',
          earnings: earnings,
          readers: totalReaders,
          works: author._count.stories,
          likes: totalLikes,
          verified: author.isVerified || false,
          description: author.bio || '优秀网文作家',
          tags: tags,
          ranking: 0 // 排名将在排序后填充
        };
      });
      
      // 根据排序字段对作者进行排序
      let sortedAuthors;
      switch(sortBy) {
        case 'readers':
          sortedAuthors = rankedAuthors.sort((a, b) => b.readers - a.readers);
          break;
        case 'works':
          sortedAuthors = rankedAuthors.sort((a, b) => b.works - a.works);
          break;
        case 'likes':
          sortedAuthors = rankedAuthors.sort((a, b) => b.likes - a.likes);
          break;
        case 'earnings':
        default:
          sortedAuthors = rankedAuthors.sort((a, b) => b.earnings - a.earnings);
          break;
      }
      
      // 添加排名
      const result = sortedAuthors.map((author, index) => ({
        ...author,
        ranking: index + 1
      }));
      
      console.log('[榜单服务] 作家榜单获取成功:', {
        count: result.length,
        sortBy,
        timeRange
      });
      
      return result;
    } catch (error) {
      console.error('[榜单服务] 获取作家榜单失败:', error);
      throw new Error('获取作家榜单失败');
    }
  }
  
  /**
   * 获取作品榜单
   * @param sortBy 排序方式: hot(热门), new(最新), rating(评分), collect(收藏)
   * @param timeRange 时间范围: weekly(周榜), monthly(月榜), yearly(年榜), all(总榜)
   * @param limit 返回数量
   */
  async getWorkRankings(sortBy: string = 'hot', timeRange: string = 'weekly', limit: number = 20) {
    console.log('[榜单服务] 获取作品榜单:', { sortBy, timeRange, limit });
    
    // 计算时间范围对应的日期
    const fromDate = this.getFromDate(timeRange);
    
    try {
      // 基本查询条件: 只查询已发布的作品
      const baseWhere = {
        status: 'PUBLISHED',
        deletedAt: null,
        // 如果是"最新"排序，根据创建时间筛选
        ...(sortBy === 'new' && timeRange !== 'all' ? {
          createdAt: { gte: fromDate }
        } : {})
      };
      
      // 查询作品数据
      const works = await this.prisma.story.findMany({
        where: baseWhere,
        select: {
          id: true,
          title: true,
          coverCid: true,
          description: true,
          createdAt: true,
          tags: true,
          author: {
            select: {
              id: true,
              address: true,
              authorName: true,
              nickname: true
            }
          },
          _count: {
            select: {
              readingHistories: timeRange !== 'all' // 阅读数(带时间筛选)
                ? { where: { createdAt: { gte: fromDate } } }
                : true,
              favorites: timeRange !== 'all' // 收藏数(带时间筛选)
                ? { where: { createdAt: { gte: fromDate } } }
                : true,
              chapters: true, // 章节数
              likes: timeRange !== 'all' // 点赞数(带时间筛选)
                ? { where: { createdAt: { gte: fromDate } } }
                : true,
              comments: timeRange !== 'all' // 评论数(带时间筛选)
                ? { where: { createdAt: { gte: fromDate } } }
                : true
            }
          }
        },
        take: limit
      });
      
      // 处理排序逻辑
      const rankedWorks = works.map(work => {
        // 计算总浏览量 (即阅读数)
        const views = work._count.readingHistories;
        
        // 计算收藏数
        const collects = work._count.favorites;
        
        // 计算热度分数 (阅读数 + 收藏数*3 + 点赞数*2 + 评论数*5)
        const hot = views + 
                   collects * 3 + 
                   work._count.likes * 2 + 
                   work._count.comments * 5;
        
        // 计算评分 (模拟数据，1-5分之间，收藏率越高分数越高)
        // 收藏率 = 收藏数 / 阅读数，最低3分，最高5分
        const collectRate = views > 0 ? (collects / views) : 0;
        const rating = Math.min(5, Math.max(3, 3 + collectRate * 10)).toFixed(1);
        
        return {
          id: work.id,
          title: work.title,
          cover: work.coverCid,
          author: work.author.authorName || work.author.nickname || '匿名作家',
          authorId: work.author.id,
          views: views,
          rating: rating,
          collects: collects,
          hot: hot,
          new: work.createdAt.getTime(),
          tags: work.tags || ['奇幻', '冒险'],
          ranking: 0 // 排名将在排序后填充
        };
      });
      
      // 根据排序字段对作品进行排序
      let sortedWorks;
      switch(sortBy) {
        case 'new':
          sortedWorks = rankedWorks.sort((a, b) => b.new - a.new);
          break;
        case 'rating':
          sortedWorks = rankedWorks.sort((a, b) => parseFloat(b.rating) - parseFloat(a.rating));
          break;
        case 'collect':
          sortedWorks = rankedWorks.sort((a, b) => b.collects - a.collects);
          break;
        case 'hot':
        default:
          sortedWorks = rankedWorks.sort((a, b) => b.hot - a.hot);
          break;
      }
      
      // 添加排名
      const result = sortedWorks.map((work, index) => ({
        ...work,
        ranking: index + 1
      }));
      
      console.log('[榜单服务] 作品榜单获取成功:', {
        count: result.length,
        sortBy,
        timeRange
      });
      
      return result;
    } catch (error) {
      console.error('[榜单服务] 获取作品榜单失败:', error);
      throw new Error('获取作品榜单失败');
    }
  }
  
  /**
   * 获取NFT榜单
   * @param sortBy 排序方式: volume(交易额), trades(交易量), price(价格) 
   * @param timeRange 时间范围: weekly(周榜), monthly(月榜), yearly(年榜), all(总榜)
   * @param limit 返回数量
   */
  async getNFTRankings(sortBy: string = 'volume', timeRange: string = 'weekly', limit: number = 20) {
    console.log('[榜单服务] 获取NFT榜单:', { sortBy, timeRange, limit });
    
    // 计算时间范围对应的日期
    const fromDate = this.getFromDate(timeRange);
    
    try {
      // 查询NFT数据
      // 注意：由于项目可能还没有完整的NFT数据模型，以下是一个模拟实现
      // 实际生产环境中，应当查询真实的NFT数据库或从区块链获取
      
      // 此处模拟从数据库获取NFT数据
      const nfts = await this.prisma.nft.findMany({
        where: {
          createdAt: timeRange !== 'all' ? { gte: fromDate } : undefined
        },
        select: {
          id: true,
          name: true,
          fileId: true,
          priceBNB: true,
          priceToken: true,
          address: true,
          description: true
        },
        take: 100 // 先获取足够多的数据，然后在内存中排序和筛选
      });
      
      // 处理排序逻辑
      const rankedNFTs = nfts.map(nft => {
        // 生成模拟交易数据 (实际项目中应当从数据库或区块链获取)
        const randomTrades = Math.floor(Math.random() * 100) + 1;
        const randomVolume = randomTrades * parseFloat(nft.priceBNB || '0');
        
        // 计算交易量 (交易次数)
        const trades = randomTrades;
        
        // 计算交易额 (所有交易金额之和)
        const volume = randomVolume;
        
        // 价格 (当前价格，或最近一次交易价格)
        const price = nft.priceBNB || '0';
        
        // 从地址中提取创作者信息（实际应关联用户表）
        const creatorName = `创作者-${nft.address.substring(0, 6)}`;
        
        return {
          id: nft.id,
          title: nft.name,
          image: nft.fileId, // 使用fileId作为图片标识
          creator: creatorName,
          creatorId: nft.address,
          volume: volume,
          trades: trades,
          price: price,
          ranking: 0 // 排名将在排序后填充
        };
      });
      
      // 根据排序字段对NFT进行排序
      let sortedNFTs;
      switch(sortBy) {
        case 'trades':
          sortedNFTs = rankedNFTs.sort((a, b) => b.trades - a.trades);
          break;
        case 'price':
          sortedNFTs = rankedNFTs.sort((a, b) => parseFloat(b.price) - parseFloat(a.price));
          break;
        case 'volume':
        default:
          sortedNFTs = rankedNFTs.sort((a, b) => b.volume - a.volume);
          break;
      }
      
      // 取前limit个
      sortedNFTs = sortedNFTs.slice(0, limit);
      
      // 添加排名
      const result = sortedNFTs.map((nft, index) => ({
        ...nft,
        ranking: index + 1
      }));
      
      console.log('[榜单服务] NFT榜单获取成功:', {
        count: result.length,
        sortBy,
        timeRange
      });
      
      return result;
    } catch (error: any) {
      console.error('[榜单服务] 获取NFT榜单失败:', error);
      
      // 如果是因为NFT表不存在的错误，返回模拟数据
      if (error.message?.includes('does not exist') || 
          error.message?.includes('no such table') ||
          error.message?.includes('relation') ||
          error.code === 'P2021') {
        console.log('[榜单服务] NFT表可能不存在，使用模拟数据');
        return this.getMockNFTData(sortBy, limit);
      }
      
      throw new Error('获取NFT榜单失败');
    }
  }
  
  /**
   * 根据类型获取对应的榜单数据
   * @param type 榜单类型: authors(作家榜), works(作品榜), nft(NFT榜)
   * @param sortBy 排序方式
   * @param timeRange 时间范围
   * @param limit 返回数量 
   */
  async getRankings(type: string, sortBy: string, timeRange: string, limit: number = 20) {
    console.log('[榜单服务] 获取榜单数据:', { type, sortBy, timeRange, limit });
    
    switch(type) {
      case 'authors':
        return this.getAuthorRankings(sortBy, timeRange, limit);
      case 'works':
        return this.getWorkRankings(sortBy, timeRange, limit);
      case 'nft':
        return this.getNFTRankings(sortBy, timeRange, limit);
      default:
        throw new Error(`不支持的榜单类型: ${type}`);
    }
  }
  
  /**
   * 根据时间范围获取起始日期
   * @param timeRange 时间范围: weekly(周榜), monthly(月榜), yearly(年榜), all(总榜)
   */
  private getFromDate(timeRange: string): Date {
    const now = new Date();
    
    switch(timeRange) {
      case 'weekly':
        // 过去7天
        return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      case 'monthly':
        // 过去30天
        return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      case 'yearly':
        // 过去365天
        return new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
      case 'all':
      default:
        // 返回很久以前的日期，相当于不筛选时间
        return new Date(0);
    }
  }
  
  /**
   * 生成随机标签(模拟数据)
   */
  private getRandomTags(): string[] {
    const allTags = [
      '科幻', '奇幻', '冒险', '玄幻', '都市', '古风', 
      '校园', '仙侠', '武侠', '悬疑', '恐怖', '灵异',
      '历史', '军事', '游戏', '体育', '轻小说'
    ];
    
    // 随机选择2-4个标签
    const count = Math.floor(Math.random() * 3) + 2; // 2-4
    const selected = new Set<string>();
    
    while(selected.size < count) {
      const randomIndex = Math.floor(Math.random() * allTags.length);
      selected.add(allTags[randomIndex]);
    }
    
    return Array.from(selected);
  }
  
  /**
   * 获取模拟NFT数据(当数据库中没有NFT表时使用)
   */
  private getMockNFTData(sortBy: string, limit: number = 20): any[] {
    // 模拟20个NFT数据
    const mockNFTs = Array.from({ length: limit }, (_, i) => ({
      id: (i + 1).toString(),
      title: `NFT作品${i + 1}`,
      image: `https://picsum.photos/seed/nft${i}/400/400`,
      creator: `作家${Math.min(i + 1, 20)}`,
      creatorId: Math.min(i + 1, 20).toString(),
      volume: 1000000 - (i * 50000),
      trades: 1000 - (i * 50),
      price: (100 - (i * 5)).toFixed(2),
      ranking: i + 1
    }));
    
    // 根据排序字段排序
    let sortedNFTs;
    switch(sortBy) {
      case 'trades':
        sortedNFTs = mockNFTs.sort((a, b) => b.trades - a.trades);
        break;
      case 'price':
        sortedNFTs = mockNFTs.sort((a, b) => parseFloat(b.price) - parseFloat(a.price));
        break;
      case 'volume':
      default:
        sortedNFTs = mockNFTs.sort((a, b) => b.volume - a.volume);
        break;
    }
    
    // 重新编号
    return sortedNFTs.map((nft, index) => ({
      ...nft,
      ranking: index + 1
    }));
  }
}

// 导出榜单服务实例
export const rankingService = new RankingService(); 