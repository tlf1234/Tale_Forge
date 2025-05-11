import express from 'express';
import { syncService } from '../services';
import { PrismaClient } from '@prisma/client';
import { AuthService } from '../services/auth.service';

const router = express.Router();
const authService = new AuthService();
const prisma = new PrismaClient();

// 获取用户互动上链状态
router.get('/status', async (req, res) => {
  const requestId = Math.random().toString(36).substring(2, 10);
  const startTime = Date.now();
  
  try {
    console.log(`[${requestId}][GET /api/interactions/status] 收到查询请求:`, {
      query: req.query,
      headers: {
        auth: req.headers.authorization ? '存在' : '不存在'
      },
      timestamp: new Date().toISOString()
    });
    
    // 使用统一认证函数验证用户
    try {
      const { user, userId } = await authService.authenticateUser({
        address: req.query.address as string,
        userId: req.query.userId as string,
        token: req.headers.authorization?.replace('Bearer ', '')
      });
      
      console.log(`[${requestId}][GET /api/interactions/status] 认证成功:`, {
        userId,
        address: user.address
      });
      
      // 获取查询类型和ID
      const { type, id } = req.query;
      
      if (!type || !id) {
        console.log(`[${requestId}][GET /api/interactions/status] 缺少必要参数`);
        return res.status(400).json({ error: '缺少必要参数: type 和 id' });
      }
      
      let status;
      let txHash;
      
      // 根据类型查询不同的互动记录
      console.log(`[${requestId}][GET /api/interactions/status] 开始查询 ${type} 记录:`, { id });
      
      switch (type) {
        case 'like':
          const like = await prisma.like.findUnique({
            where: { id: id as string },
            select: { onChainStatus: true, txHash: true }
          });
          status = like?.onChainStatus;
          txHash = like?.txHash;
          break;
        case 'comment':
          const comment = await prisma.comment.findUnique({
            where: { id: id as string },
            select: { onChainStatus: true, txHash: true }
          });
          status = comment?.onChainStatus;
          txHash = comment?.txHash;
          break;
        case 'favorite':
          const favorite = await prisma.favorite.findUnique({
            where: { id: id as string },
            select: { onChainStatus: true, txHash: true }
          });
          status = favorite?.onChainStatus;
          txHash = favorite?.txHash;
          break;
        default:
          console.log(`[${requestId}][GET /api/interactions/status] 无效的互动类型:`, type);
          return res.status(400).json({ error: '无效的互动类型' });
      }
      
      if (!status) {
        console.log(`[${requestId}][GET /api/interactions/status] 记录不存在:`, { type, id });
        return res.status(404).json({ error: '互动记录不存在' });
      }
      
      const responseTime = Date.now() - startTime;
      console.log(`[${requestId}][GET /api/interactions/status] 查询成功 (${responseTime}ms):`, {
        type, id, status, hasTxHash: !!txHash
      });
      
      res.json({ type, id, status, txHash });
    } catch (authError) {
      const responseTime = Date.now() - startTime;
      console.error(`[${requestId}][GET /api/interactions/status] 认证失败 (${responseTime}ms):`, authError);
      res.status(401).json({ error: (authError as Error).message || '认证失败' });
    }
  } catch (error: any) {
    const responseTime = Date.now() - startTime;
    console.error(`[${requestId}][GET /api/interactions/status] 查询失败 (${responseTime}ms):`, error);
    res.status(500).json({ error: error?.message });
  }
});

// 获取用户所有互动上链状态
router.get('/all', async (req, res) => {
  try {
    console.log('[GET /api/interactions/all] 收到查询请求:', {
      query: req.query
    });
    
    // 使用统一认证函数验证用户
    try {
      const { user, userId } = await authService.authenticateUser({
        address: req.query.address as string,
        userId: req.query.userId as string,
        token: req.headers.authorization?.replace('Bearer ', '')
      });
      
      // 获取查询参数
      const { storyId } = req.query;
      const limit = parseInt(req.query.limit as string) || 20;
      const page = parseInt(req.query.page as string) || 1;
      const skip = (page - 1) * limit;
      
      // 查询条件
      const where: any = { userId };
      if (storyId) {
        where.storyId = storyId as string;
      }
      
      // 获取点赞记录
      const likes = await prisma.like.findMany({
        where,
        select: {
          id: true,
          storyId: true,
          createdAt: true,
          onChainStatus: true,
          txHash: true
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' }
      });
      
      // 获取评论记录
      const comments = await prisma.comment.findMany({
        where,
        select: {
          id: true,
          storyId: true,
          content: true,
          createdAt: true,
          onChainStatus: true,
          txHash: true
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' }
      });
      
      // 获取收藏记录
      const favorites = await prisma.favorite.findMany({
        where,
        select: {
          id: true,
          storyId: true,
          createdAt: true,
          onChainStatus: true,
          txHash: true
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' }
      });
      
      // 计算总数
      const likesCount = await prisma.like.count({ where });
      const commentsCount = await prisma.comment.count({ where });
      const favoritesCount = await prisma.favorite.count({ where });
      
      const result = {
        likes: {
          items: likes,
          total: likesCount,
          page,
          pageSize: limit,
          pageCount: Math.ceil(likesCount / limit)
        },
        comments: {
          items: comments,
          total: commentsCount,
          page,
          pageSize: limit,
          pageCount: Math.ceil(commentsCount / limit)
        },
        favorites: {
          items: favorites,
          total: favoritesCount,
          page,
          pageSize: limit,
          pageCount: Math.ceil(favoritesCount / limit)
        }
      };
      
      console.log('[GET /api/interactions/all] 查询成功:', {
        likesCount,
        commentsCount,
        favoritesCount
      });
      
      res.json(result);
    } catch (authError) {
      console.error('[GET /api/interactions/all] 认证失败:', authError);
      res.status(401).json({ error: (authError as Error).message || '认证失败' });
    }
  } catch (error: any) {
    console.error('[GET /api/interactions/all] 查询失败:', error);
    res.status(500).json({ error: error?.message });
  }
});

// 管理员API: 手动触发批量上链
router.post('/admin/sync', async (req, res) => {
  const requestId = Math.random().toString(36).substring(2, 10);
  const startTime = Date.now();
  
  try {
    console.log(`[${requestId}][POST /api/interactions/admin/sync] 收到手动触发批量上链请求`, {
      timestamp: new Date().toISOString(),
      ip: req.ip,
      headers: {
        auth: req.headers.authorization ? '存在' : '不存在',
        'user-agent': req.headers['user-agent'] || '未知'
      }
    });
    
    console.log(`[${requestId}][POST /api/interactions/admin/sync] 调用 syncService.triggerInteractionBatchUpload()`);
    const result = await syncService.triggerInteractionBatchUpload();
    
    if (!result) {
      const responseTime = Date.now() - startTime;
      console.log(`[${requestId}][POST /api/interactions/admin/sync] 无新互动数据需要上链 (${responseTime}ms)`);
      return res.json({ message: '无新互动数据需要上链' });
    }
    
    const responseTime = Date.now() - startTime;
    console.log(`[${requestId}][POST /api/interactions/admin/sync] 批量上链成功 (${responseTime}ms):`, {
      batchId: result.batchId,
      txHash: result.txHash,
      interactionsCount: result.interactionsCount,
      status: result.status
    });
    
    res.json(result);
  } catch (error: any) {
    const responseTime = Date.now() - startTime;
    console.error(`[${requestId}][POST /api/interactions/admin/sync] 批量上链失败 (${responseTime}ms):`, error);
    console.error(`[${requestId}][POST /api/interactions/admin/sync] 错误堆栈:`, error.stack);
    res.status(500).json({ error: error?.message });
  }
});

// 管理员API: 获取批次记录列表
router.get('/admin/batches', async (req, res) => {
  const requestId = Math.random().toString(36).substring(2, 10);
  const startTime = Date.now();
  
  try {
    console.log(`[${requestId}][GET /api/interactions/admin/batches] 收到查询请求:`, {
      query: req.query,
      timestamp: new Date().toISOString()
    });
    
    const { limit, offset } = req.query;
    
    console.log(`[${requestId}][GET /api/interactions/admin/batches] 查询参数:`, {
      limit: limit || '默认值(10)',
      offset: offset || '默认值(0)'
    });
    
    const batches = await syncService.getInteractionBatches(
      Number(limit) || 10,
      Number(offset) || 0
    );
    
    const responseTime = Date.now() - startTime;
    console.log(`[${requestId}][GET /api/interactions/admin/batches] 查询成功 (${responseTime}ms):`, {
      count: batches.length,
      statuses: batches.reduce((acc, batch) => {
        acc[batch.status] = (acc[batch.status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>)
    });
    
    res.json(batches);
  } catch (error: any) {
    const responseTime = Date.now() - startTime;
    console.error(`[${requestId}][GET /api/interactions/admin/batches] 查询失败 (${responseTime}ms):`, error);
    console.error(`[${requestId}][GET /api/interactions/admin/batches] 错误堆栈:`, error.stack);
    res.status(500).json({ error: error?.message });
  }
});

// 管理员API: 获取批次详情
router.get('/admin/batches/:id', async (req, res) => {
  const requestId = Math.random().toString(36).substring(2, 10);
  const startTime = Date.now();
  
  try {
    console.log(`[${requestId}][GET /api/interactions/admin/batches/:id] 收到查询请求:`, {
      id: req.params.id,
      timestamp: new Date().toISOString()
    });
    
    const { id } = req.params;
    const batch = await syncService.getInteractionBatchById(id);
    
    if (!batch) {
      const responseTime = Date.now() - startTime;
      console.log(`[${requestId}][GET /api/interactions/admin/batches/:id] 批次记录不存在 (${responseTime}ms):`, { id });
      return res.status(404).json({ error: '批次记录不存在' });
    }
    
    const responseTime = Date.now() - startTime;
    console.log(`[${requestId}][GET /api/interactions/admin/batches/:id] 查询成功 (${responseTime}ms):`, {
      id: batch.id,
      batchId: batch.batchId,
      status: batch.status,
      createdAt: batch.createdAt,
      processedAt: batch.processedAt,
      storiesCount: batch.storiesCount,
      totalInteractions: batch.likesCount + batch.commentsCount + batch.favoritesCount
    });
    
    res.json(batch);
  } catch (error: any) {
    const responseTime = Date.now() - startTime;
    console.error(`[${requestId}][GET /api/interactions/admin/batches/:id] 查询失败 (${responseTime}ms):`, error);
    console.error(`[${requestId}][GET /api/interactions/admin/batches/:id] 错误堆栈:`, error.stack);
    res.status(500).json({ error: error?.message });
  }
});



export default router; 