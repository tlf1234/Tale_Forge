import express from 'express';
import { rankingService } from '../services';

const router = express.Router();

/**
 * 获取榜单数据
 * 
 * @route GET /api/rankings
 * @query {string} type - 榜单类型: authors(作家榜), works(作品榜), nft(NFT榜)
 * @query {string} sortBy - 排序方式:
 *                          作家榜: earnings(收益), readers(读者数), works(作品数), likes(获赞数)
 *                          作品榜: hot(热门), new(最新), rating(评分), collect(收藏)
 *                          NFT榜: volume(交易额), trades(交易量), price(价格)
 * @query {string} timeRange - 时间范围: weekly(周榜), monthly(月榜), yearly(年榜), all(总榜)
 * @query {number} limit - 返回数量，默认20
 * @returns {Array} items - 榜单数据数组
 */
router.get('/', async (req, res) => {
  const traceId = Math.random().toString(36).substring(2, 8);
  console.log(`[${traceId}][GET /api/rankings] 收到请求:`, {
    query: req.query,
    headers: {
      'user-agent': req.headers['user-agent']?.substring(0, 50) + '...'
    }
  });
  
  try {
    // 获取请求参数
    const type = (req.query.type as string) || 'authors';
    const sortBy = (req.query.sortBy as string) || getSortByDefault(type);
    const timeRange = (req.query.timeRange as string) || 'weekly';
    const limit = parseInt(req.query.limit as string) || 20;
    
    console.log(`[${traceId}][GET /api/rankings] 请求参数:`, {
      type,
      sortBy,
      timeRange,
      limit
    });
    
    // 验证参数
    validateParams(type, sortBy, timeRange, limit);
    
    // 获取榜单数据
    const startTime = Date.now();
    const items = await rankingService.getRankings(type, sortBy, timeRange, limit);
    const endTime = Date.now();
    
    console.log(`[${traceId}][GET /api/rankings] 获取榜单数据成功:`, {
      itemsCount: items.length,
      responseTime: `${endTime - startTime}ms`,
      type,
      sortBy,
      timeRange
    });
    
    // 返回响应
    res.json({
      items,
      type,
      sortBy,
      timeRange,
      total: items.length
    });
  } catch (error: any) {
    console.error(`[${traceId}][GET /api/rankings] 获取榜单数据失败:`, error);
    res.status(500).json({
      error: error.message || '获取榜单数据失败'
    });
  }
});

/**
 * 获取榜单类型的默认排序方式
 */
function getSortByDefault(type: string): string {
  switch (type) {
    case 'authors':
      return 'earnings';
    case 'works':
      return 'hot';
    case 'nft':
      return 'volume';
    default:
      return 'earnings';
  }
}

/**
 * 验证请求参数
 */
function validateParams(type: string, sortBy: string, timeRange: string, limit: number) {
  // 验证榜单类型
  const validTypes = ['authors', 'works', 'nft'];
  if (!validTypes.includes(type)) {
    throw new Error(`不支持的榜单类型: ${type}`);
  }
  
  // 验证排序方式
  const validSortBy: { [key: string]: string[] } = {
    authors: ['earnings', 'readers', 'works', 'likes'],
    works: ['hot', 'new', 'rating', 'collect'],
    nft: ['volume', 'trades', 'price']
  };
  
  if (!validSortBy[type].includes(sortBy)) {
    throw new Error(`不支持的排序方式: ${sortBy}`);
  }
  
  // 验证时间范围
  const validTimeRanges = ['weekly', 'monthly', 'yearly', 'all'];
  if (!validTimeRanges.includes(timeRange)) {
    throw new Error(`不支持的时间范围: ${timeRange}`);
  }
  
  // 验证返回数量
  if (isNaN(limit) || limit <= 0 || limit > 100) {
    throw new Error(`返回数量必须在1-100之间`);
  }
}

export default router; 