import 'reflect-metadata';
import 'dotenv/config';
import express from 'express';
import { storyService, userService, commentService, aiService, syncService } from './services';
import type { StoryStatus } from '@prisma/client'
import multer from 'multer';
import path from 'path';
import authRouter from './routes/auth.routes';
import interactionRouter from './routes/interaction.routes';
import rankingRouter from './routes/ranking.routes';
import { AuthService } from './services/auth.service'
import { SyncModule } from './modules/sync.module';
import { v4 as uuidv4 } from 'uuid';
import { verifyToken } from './utils/tokenUtils';


/**
 * 前后端注意一个路由抢占的问题，当有一段前面路由相同时，会抢占顺序靠后的路由。
 * 这是时要么把顺序靠前的路由写在前面。要么把路由相同的前面一段修改一下
 * 
 * 例如：
 * /api/users/：address
 * /api/users/bookshelf  改为 /api/user/bookshelf即可
 * 
 */


const app = express();
// 增加请求体大小限制到 10MB
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// 配置静态文件服务
app.use('/uploads', express.static('uploads', {
  setHeaders: (res, path, stat) => {
    // 设置CORS头
    res.set('Access-Control-Allow-Origin', '*');
    // 设置缓存控制
    res.set('Cache-Control', 'no-cache, must-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
  }
}));



// 配置multer
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024 // 限制5MB
  }
});

// 创建authService实例
const authService = new AuthService();

// 初始化同步模块 - 启动互动数据定时同步任务
const syncModule = new SyncModule();
syncModule.onModuleInit();
console.log('互动数据同步任务已启动');

/**
 * 用户相关路由(未完善)
 */

// POST - 创建新用户
app.post('/api/users', async (req, res) => {
  try {
    console.log('[POST /api/users] 收到创建请求:', {
      body: req.body
    })
    
    const user = await userService.getOrCreateUser(req.body.address);
    
    console.log('[POST /api/users] 创建成功:', user)
    res.json(user);
  } catch (error: any) {
    console.error('[POST /api/users] 创建失败:', error)
    res.status(500).json({ error: error?.message });
  }
});

// GET - 获取用户信息
app.get('/api/users/:address', async (req, res) => {
  try {
    console.log('[GET /api/users/:address] 收到查询请求:', {
      address: req.params.address
    })
    
    const { address } = req.params;
    const user = await userService.getUser(address);
    
    console.log('[GET /api/users/:address] 查询成功:', user)
    res.json(user);
  } catch (error: any) {
    console.error('[GET /api/users/:address] 查询失败:', error)
    res.status(500).json({ error: error?.message });
  }
});

// GET - 根据用户ID获取用户信息（不同于地址）
app.get('/api/users/profile/:userId', async (req, res) => {
  try {
    console.log('[GET /api/users/profile/:userId] 收到查询请求:', {
      userId: req.params.userId
    })
    
    const { userId } = req.params;
    const user = await userService.getUserById(userId);
    
    if (!user) {
      console.log('[GET /api/users/profile/:userId] 错误: 用户不存在')
      return res.status(404).json({ error: '用户不存在' });
    }
    
    console.log('[GET /api/users/profile/:userId] 查询成功:', user)
    res.json(user);
  } catch (error: any) {
    console.error('[GET /api/users/profile/:userId] 查询失败:', error)
    res.status(500).json({ error: error?.message });
  }
});



// PUT - 更新用户信息（主要是作者信息）
app.put('/api/users/:address', async (req, res) => {
  try {
    console.log('[PUT /api/users/:address] 收到更新请求:', {
      address: req.params.address,
      body: req.body
    })

    const { address } = req.params
    const user = await userService.updateUser(address, req.body)
    
    console.log('[PUT /api/users/:address] 更新成功:', user)
    res.json(user)
  } catch (error: any) {
    console.error('[PUT /api/users/:address] 更新失败:', error)
    res.status(500).json({ error: error?.message })
  }
})

// 注册认证路由
app.use('/api/auth', authRouter);
// 用户互动API路由
app.use('/api/interactions', interactionRouter);
// 榜单API路由
app.use('/api/rankings', rankingRouter);


/**
 * 作者相关路由
 */
// 作者相关路由
// POST - 注册新作者
app.post('/api/authors/register', async (req, res) => {
  try {
    console.log('[POST /api/authors/register] 收到注册请求:', {
      body: req.body
    })
    
    const author = await userService.registerAuthor(req.body);
    
    console.log('[POST /api/authors/register] 注册成功:', author)
    res.json(author);
  } catch (error: any) {
    console.error('[POST /api/authors/register] 注册失败:', error)
    res.status(500).json({ error: error?.message });
  }
});

// GET - 获取作者信息
app.get('/api/authors/:address', async (req, res) => {
  try {
    console.log('[GET /api/authors/:address] 收到查询请求:', {
      address: req.params.address
    })
    
    const { address } = req.params;
    const author = await userService.getUserByAddress(address);
    
    console.log('[GET /api/authors/:address] 查询成功:', author)
    res.json(author);
  } catch (error: any) {
    console.error('[GET /api/authors/:address] 查询失败:', error)
    if (error.message === 'Author not found') {
      res.status(404).json({ error: error.message });
    } else {
      res.status(500).json({ error: error.message });
    }
  }
});

// 已移除作者验证API端点 - 未使用的功能

/**
 * 作品故事创建路由
 */
// 故事创建路由
app.post('/api/stories/upload', async (req, res) => {
  try {
    console.log('[POST /api/stories/upload] 收到创建请求:', {
      body: req.body
    })
    
    const result = await storyService.uploadStory(req.body);
    
    console.log('[POST /api/stories/upload] 创建成功:', result)
    res.json(result);
  } catch (error: any) {
    console.error('[POST /api/stories/upload] 创建失败:', error)
    res.status(500).json({ error: error?.message });
  }
});

// 故事保存路由
app.post('/api/stories/save', async (req, res) => {
  try {
    console.log('[POST /api/stories/save] 收到保存请求:', {
      body: req.body
    })

    const result = await storyService.saveStory(req.body);

    console.log('[POST /api/stories/save] 保存成功:', result)
    res.json(result);
  } catch (error: any) {
    console.error('[POST /api/stories/save] 保存失败:', error)
    res.status(500).json({ error: error?.message });
  }
});

// GET - 获取作者作品列表
app.get('/api/authors/:address/stories', async (req, res) => {
  try {
    console.log('[GET /api/authors/:address/stories] 收到请求:', {
      address: req.params.address,
      query: req.query
    })
    
    const { address } = req.params
    const { skip, take, status } = req.query
    
    // 1. 首先获取作者信息
    const author = await userService.getUserByAddress(address)
    
    if (!author) {
      console.log('[GET /api/authors/:address/stories] 作者不存在:', address)
      return res.status(404).json({ error: '作者不存在' })
    }

    // 2. 使用 StoryService 获取作品列表
    const result = await storyService.getAuthorStories(author.id, {
      status: status as StoryStatus,
      skip: Number(skip) || 0,
      take: Number(take) || 10
    })
    
    console.log('[GET /api/authors/:address/stories] 返回结果:', {
      syncStatus: result.syncStatus,
      storiesCount: result.stories?.length || 0,
      total: result.total || 0
    })
    
    res.json(result)
  } catch (error) {
    console.error('[GET /api/authors/:address/stories] 处理请求失败:', error)
    res.status(500).json({ 
      error: error instanceof Error ? error.message : '获取作品列表失败' 
    })
  }
})


// 获取故事列表路由
app.get('/api/stories', async (req, res) => {
  console.log('[GET /api/stories] 收到请求:', {
    query: req.query
  })
  try {
    const { category, authorId, sortBy, limit = '10', page = '1' } = req.query;
    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
    const take = parseInt(limit as string);
    
    const stories = await storyService.getStories({
      category: category as string,
      authorId: authorId as string,
      skip: isNaN(skip) ? 0 : skip,
      take: isNaN(take) ? 10 : take,
      orderBy: sortBy === 'latest' ? 'createdAt' : undefined
    });
    console.log('Sending response:', stories) // 调试用
    res.json(stories);
  } catch (error: any) {
    console.error('Error:', error)
    res.status(500).json({ error: error?.message });
  }
});

// 获取故事详情路由
app.get('/api/stories/:id', async (req, res) => {
  try {
    console.log('[GET /api/stories/:id] 收到请求:', {
      id: req.params.id
    })
    const { id } = req.params;
    const story = await storyService.getStory(id);
    res.json(story);
  } catch (error: any) {
    res.status(500).json({ error: error?.message });
  }
});

// 获取故事点赞状态
app.get('/api/stories/:id/like/status', async (req, res) => {
  try {
    const { id } = req.params;
    
    // 使用统一认证方法
    try {
      const { user, userId } = await authService.authenticateUser({
        address: req.query.address as string,
        userId: req.query.userId as string,
        token: req.headers.authorization?.replace('Bearer ', '')
      });
    
    console.log('[GET /api/stories/:id/like/status] 收到请求:', {
      storyId: id,
      userId
    });
    
    // 检查该用户是否点赞了该故事
    const like = await storyService.checkUserLikedStory(userId, id);
    
    res.json({ isLiked: !!like });
    } catch (authError) {
      // 如果未认证，则返回未点赞
      console.log('[GET /api/stories/:id/like/status] 认证失败, 返回未点赞状态');
      return res.json({ isLiked: false });
    }
  } catch (error: any) {
    console.error('[GET /api/stories/:id/like/status] 处理请求失败:', error);
    res.status(500).json({ error: error?.message });
  }
});

// 点赞故事
app.post('/api/stories/:id/like', async (req, res) => {
  try {
    const { id } = req.params;
    
    // 使用统一认证方法
    try {
      const { user, userId } = await authService.authenticateUser({
        address: req.body.address,
        userId: req.body.userId,
        token: req.headers.authorization?.replace('Bearer ', '')
      });
    
    console.log('[POST /api/stories/:id/like] 收到请求:', {
      storyId: id,
      userId: userId
    });
    
    // 通过 storyService 处理点赞逻辑
    const result = await storyService.likeStory(userId, id);
    
    res.json(result);
    } catch (authError) {
      console.error('[POST /api/stories/:id/like] 认证失败:', authError);
      res.status(401).json({ error: (authError as Error).message || '认证失败' });
    }
  } catch (error: any) {
    console.error('[POST /api/stories/:id/like] 处理请求失败:', error);
    res.status(500).json({ error: error?.message });
  }
});

// 取消点赞故事
app.delete('/api/stories/:id/like', async (req, res) => {
  try {
    const { id } = req.params;
    
    // 使用统一认证方法
    try {
      const { user, userId } = await authService.authenticateUser({
        address: req.body.address,
        userId: req.body.userId,
        token: req.headers.authorization?.replace('Bearer ', '')
      });
    
    console.log('[DELETE /api/stories/:id/like] 收到请求:', {
      storyId: id,
      userId: userId
    });
    
    // 通过 storyService 处理取消点赞逻辑
    const result = await storyService.unlikeStory(userId, id);
    
    res.json(result);
    } catch (authError) {
      console.error('[DELETE /api/stories/:id/like] 认证失败:', authError);
      res.status(401).json({ error: (authError as Error).message || '认证失败' });
    }
  } catch (error: any) {
    console.error('[DELETE /api/stories/:id/like] 处理请求失败:', error);
    res.status(500).json({ error: error?.message });
  }
});

// 验证故事路由
app.post('/api/stories/validate', async (req, res) => {
  try {
    const result = await storyService.validateStory(req.body);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error?.message });
  }
});


/**
 * 章节相关路由（实际上章节相关可以不需要storyId，因为各个章节ID是唯一的）
 */

// 创建新章节（草稿）
app.post('/api/stories/:storyId/chapters', async (req, res) => {
  try {
    console.log('[POST /api/stories/:storyId/chapters] 收到请求:', {
      storyId: req.params.storyId,
      body: req.body
    });
    
    const { storyId } = req.params;
    const chapter = await storyService.addChapter(storyId, req.body);
    
    res.json(chapter);
  } catch (error: any) {
    console.error('[POST /api/stories/:storyId/chapters] 创建章节失败:', error);
    res.status(500).json({ error: error?.message });
  }
});

// 获取章节列表
app.get('/api/stories/:storyId/chapters', async (req, res) => {
  try {
    console.log('[GET /api/stories/:storyId/chapters] 收到请求:', {
      storyId: req.params.storyId,
      page: req.query.page,
      limit: req.query.limit
    });
    
    const { storyId } = req.params;
    const page = parseInt(req.query.page as string || '1');
    const limit = parseInt(req.query.limit as string || '50');
    
    // 使用服务层方法获取章节列表
    const chapters = await storyService.getChaptersByStoryId(storyId, page, limit);
    
    res.json(chapters);
  } catch (error: any) {
    console.error('[GET /api/stories/:storyId/chapters] 获取章节列表失败:', error);
    res.status(500).json({ error: error?.message });
  }
});

// 获取最近的章节
app.get('/api/stories/:storyId/chapters/recent', async (req, res) => {
  try {
    console.log('[GET /api/stories/:storyId/chapters/recent] recent收到请求:', {
      storyId: req.params.storyId,
      limit: req.query.limit
    });
    
    const { storyId } = req.params;
    const limit = parseInt(req.query.limit as string || '10');
    
    // 使用服务层方法获取最近章节
    const chapters = await storyService.getRecentChapters(storyId, limit);
    
    res.json(chapters);
  } catch (error: any) {
    console.error('[GET /api/stories/:storyId/chapters/recent] 获取最近章节失败:', error);
    res.status(500).json({ error: error?.message });
  }
});

// 获取章节统计信息
app.get('/api/stories/:storyId/chapters/stats', async (req, res) => {
  console.log('[GET /api/stories/:storyId/chapters/stats] 收到请求:', {
    storyId: req.params.storyId});
  try {
    console.log('[GET /api/stories/:storyId/chapters/stats] 收到请求:', {
      storyId: req.params.storyId
    });
    
    const { storyId } = req.params;
    
    // 使用服务层方法获取章节统计信息
    const stats = await storyService.getChapterStats(storyId);
    console.log('[GET /api/stories/:storyId/chapters/stats] 返回结果:', stats)
    
    res.json(stats);
  } catch (error: any) {
    console.error('[GET /api/stories/:storyId/chapters/stats] 获取章节统计信息失败:', error);
    res.status(500).json({ error: error?.message });
  }
});


// 获取指定范围的章节
app.get('/api/stories/:storyId/chapters/range', async (req, res) => {
  try {
    console.log('[GET /api/stories/:storyId/chapters/range] 收到请求:', {
      storyId: req.params.storyId,
      start: req.query.start,
      end: req.query.end
    });
    
    const { storyId } = req.params;
    const start = parseInt(req.query.start as string || '0');
    const end = parseInt(req.query.end as string || '0');
    
    // 验证参数
    if (start <= 0 || end <= 0 || start < end) {
      return res.status(400).json({ error: '无效的章节范围' });
    }
    
    // 使用服务层方法获取指定范围的章节
    const chapters = await storyService.getChaptersByRange(storyId, start, end);
    
    res.json(chapters);
  } catch (error: any) {
    console.error('[GET /api/stories/:storyId/chapters/range] 获取章节范围失败:', error);
    res.status(500).json({ error: error?.message });
  }
});

// 搜索章节
app.get('/api/stories/:storyId/chapters/search', async (req, res) => {
  try {
    console.log('[GET /api/stories/:storyId/chapters/search] 收到请求:', {
      storyId: req.params.storyId,
      keyword: req.query.keyword
    });
    
    const { storyId } = req.params;
    const keyword = req.query.keyword as string || '';
    
    // 验证参数
    if (!keyword.trim()) {
      return res.status(400).json({ error: '搜索关键词不能为空' });
    }
    
    // 使用服务层方法搜索章节
    const chapters = await storyService.searchChapters(storyId, keyword);
    
    res.json(chapters);
  } catch (error: any) {
    console.error('[GET /api/stories/:storyId/chapters/search] 搜索章节失败:', error);
    res.status(500).json({ error: error?.message });
  }
});

// 获取章节详情（新路由，包含 storyId）
app.get('/api/stories/:storyId/chapters/:chapterId', async (req, res) => {
  try {
    console.log('[GET /api/stories/:storyId/chapters/:chapterId] 收到请求:', {
      storyId: req.params.storyId,
      chapterId: req.params.chapterId
    });
    
    const { storyId, chapterId } = req.params;
    const chapter = await storyService.getChapter(chapterId, storyId);
    
    res.json(chapter);
  } catch (error: any) {
    console.error('[GET /api/stories/:storyId/chapters/:chapterId] 获取章节详情失败:', error);
    res.status(500).json({ error: error?.message });
  }
});

// 通过章节顺序获取章节
app.get('/api/stories/:storyId/chapters/order/:order', async (req, res) => {
  try {
    const { storyId, order } = req.params;
    console.log('[GET /api/stories/:storyId/chapters/order/:order] 收到请求:', {
      storyId,
      order,
      timestamp: new Date().toISOString()
    });
    
    const chapter = await storyService.getChapterByOrder(storyId, parseInt(order));
    
    console.log('[GET /api/stories/:storyId/chapters/order/:order] 查询结果:', {
      found: !!chapter,
      chapterId: chapter?.id,
      title: chapter?.title,
      order: chapter?.order,
      totalChapters: chapter?.totalChapters,
      wordCount: chapter?.wordCount
    });
    
    if (!chapter) {
      console.log('[GET /api/stories/:storyId/chapters/order/:order] 章节不存在:', {
        storyId,
        order
      });
      return res.status(404).json({ error: '章节不存在' });
    }
    
    console.log('[GET /api/stories/:storyId/chapters/order/:order] 成功返回章节数据');
    res.json(chapter);
  } catch (error: any) {
    console.error('[GET /api/stories/:storyId/chapters/order/:order] 获取章节失败:', {
      storyId: req.params.storyId,
      order: req.params.order,
      error: error.message,
      stack: error.stack
    });
    res.status(500).json({ error: error?.message });
  }
});

// 保存章节（更新章节）（包含 storyId）
app.put('/api/stories/:storyId/chapters/:chapterId', async (req, res) => {
  try {
    console.log('[PUT /api/stories/:storyId/chapters/:chapterId] 收到请求:', {
      storyId: req.params.storyId,
      chapterId: req.params.chapterId,
      body: req.body
    });
    
    const { storyId, chapterId } = req.params;
    const chapter = await storyService.updateChapter(chapterId, req.body, storyId);
    
    res.json(chapter);
  } catch (error: any) {
    console.error('[PUT /api/stories/:storyId/chapters/:chapterId] 更新章节失败:', error);
    res.status(500).json({ error: error?.message });
  }
});

// 发布章节（新路由，包含 storyId。旧方案，暂时不用了）
app.post('/api/stories/:storyId/chapters/:chapterId/publish', async (req, res) => {
  try {
    console.log('[POST /api/stories/:storyId/chapters/:chapterId/publish] 收到请求:', {
      storyId: req.params.storyId,
      chapterId: req.params.chapterId,
      body: req.body
    });
    
    const { storyId, chapterId } = req.params;
    const { authorAddress, txHash } = req.body;
    
    if (!authorAddress) {
      return res.status(400).json({ error: '缺少作者地址' });
    }
    
    // 调用发布章节方法，同时传入交易哈希
    const chapter = await storyService.publishChapter(chapterId, authorAddress, storyId, txHash);
    
    res.json(chapter);
  } catch (error: any) {
    console.error('[POST /api/stories/:storyId/chapters/:chapterId/publish] 发布章节失败:', error);
    res.status(500).json({ error: error?.message });
  }
});

// 准备发布章节 - 新增两步发布流程的第一步
app.post('/api/stories/:storyId/chapters/:chapterId/prepare-publish', async (req, res) => {
  try {
    console.log('[POST /api/stories/:storyId/chapters/:chapterId/prepare-publish] 收到请求:', {
      storyId: req.params.storyId,
      chapterId: req.params.chapterId,
      body: req.body
    });
    
    const { storyId, chapterId } = req.params;
    const { authorAddress } = req.body;
    
    if (!authorAddress) {
      return res.status(400).json({ error: '缺少作者地址' });
    }
    
    // 调用预处理发布方法
    const result = await storyService.prepareChapterPublish(chapterId);
    
    res.json(result);
  } catch (error: any) {
    console.error('[POST /api/stories/:storyId/chapters/:chapterId/prepare-publish] 预处理发布失败:', error);
    res.status(500).json({ error: error?.message });
  }
});

// 完成发布章节 - 新增两步发布流程的第二步
app.post('/api/stories/:storyId/chapters/:chapterId/complete-publish', async (req, res) => {
  try {
    console.log('[POST /api/stories/:storyId/chapters/:chapterId/complete-publish] 收到请求:', {
      storyId: req.params.storyId,
      chapterId: req.params.chapterId,
      body: req.body
    });
    
    const { storyId, chapterId } = req.params;
    const { txHash } = req.body;
    
    if (!txHash) {
      return res.status(400).json({ error: '缺少交易哈希' });
    }
    
    // 调用完成发布方法
    const chapter = await storyService.completeChapterPublish(chapterId, txHash);
    
    res.json(chapter);
  } catch (error: any) {
    console.error('[POST /api/stories/:storyId/chapters/:chapterId/complete-publish] 完成发布失败:', error);
    res.status(500).json({ error: error?.message });
  }
});

// 删除章节（新路由，包含 storyId）
app.delete('/api/stories/:storyId/chapters/:chapterId', async (req, res) => {
  try {
    console.log('[DELETE /api/stories/:storyId/chapters/:chapterId] 收到请求:', {
      storyId: req.params.storyId,
      chapterId: req.params.chapterId
    });
    
    const { storyId, chapterId } = req.params;
    const result = await storyService.deleteChapter(chapterId, storyId);
    
    res.json(result);
  } catch (error: any) {
    console.error('[DELETE /api/stories/:storyId/chapters/:chapterId] 删除章节失败:', error);
    res.status(500).json({ error: error?.message });
  }
});

// 上传章节插画（）
app.post('/api/stories/:storyId/chapters/:chapterId/images', upload.single('image'),
 async (req: express.Request, res: express.Response) => {
 
  console.log('[插画上传-后端API] 收到请求:', {
    storyId: req.params.storyId,
    chapterId: req.params.chapterId,
    position: req.body.position,
    file: req.file ? {
      originalname: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size
    } : null
  });

  try {
    const { storyId, chapterId } = req.params;
    const position = req.body.position ? parseInt(req.body.position) : undefined;
    const file = req.file;

    if (!file) {
      console.log('[插画上传-后端API] 错误: 没有上传文件');
      return res.status(400).json({ error: 'No file uploaded' });
    }

    console.log('[插画上传-后端API] 开始处理上传, 位置:', position);
    const illustration = await storyService.uploadChapterImage(storyId, chapterId, file, position);
    console.log('[插画上传-后端API] 上传成功:', illustration);
    res.json(illustration);
  } catch (error: any) {
    console.error('[插画上传-后端API] 上传失败:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// 获取章节插画
app.get('/api/stories/:storyId/chapters/:chapterId/images', async (req: express.Request, res: express.Response) => {
  console.log('[插画列表-后端API] 收到请求:', {
    storyId: req.params.storyId,
    chapterId: req.params.chapterId
  });

  try {
    const { storyId, chapterId } = req.params;
    console.log('[插画列表-后端API] 开始获取列表');
    const illustrations = await storyService.getChapterIllustrations(storyId, chapterId);
    console.log('[插画列表-后端API] 获取成功，数量:', illustrations.length);
    res.json(illustrations);
  } catch (error: any) {
    console.error('[插画列表-后端API] 获取失败:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// 删除章节插画
app.delete('/api/stories/:storyId/chapters/:chapterId/images/:illustrationId', async (req: express.Request, res: express.Response) => {
  console.log('[插画删除-后端API] 收到请求:', {
    storyId: req.params.storyId,
    chapterId: req.params.chapterId,
    illustrationId: req.params.illustrationId
  });

  try {
    const { storyId, chapterId, illustrationId } = req.params;
    console.log('[插画删除-后端API] 开始删除');
    await storyService.deleteIllustration(storyId, chapterId, illustrationId);
    console.log('[插画删除-后端API] 删除成功');
    res.json({ success: true });
  } catch (error: any) {
    console.error('[插画删除-后端API] 删除失败:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

/**
 * 评论相关路由
 */

// 获取章节评论列表
app.get('/api/stories/:storyId/chapters/:chapterId/comments', async (req, res) => {
  const startTime = Date.now()
  const requestId = Math.random().toString(36).substring(2, 10)
  
  try {
    console.log(`[${requestId}][GET 章节评论] 开始处理请求:`, {
      storyId: req.params.storyId,
      chapterId: req.params.chapterId,
      page: req.query.page,
      limit: req.query.limit,
      userId: req.query.userId || req.body.userId,
      ip: req.ip,
      userAgent: req.get('user-agent'),
      timestamp: new Date().toISOString()
    })
    
    const { storyId, chapterId } = req.params;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;
    const userId = req.query.userId as string || req.body.userId;
    
    console.log(`[${requestId}][GET 章节评论] 解析参数:`, {
      storyId,
      chapterId,
      page,
      limit,
      skip,
      userId
    })
    
    // 获取章节的评论列表，包含用户信息、点赞数和部分回复
    console.log(`[${requestId}][GET 章节评论] 调用 commentService.getComments`)
    const result = await commentService.getComments(storyId, {
      skip,
      take: limit,
      currentUserId: userId,
      chapterId
    });
    
    const responseTime = Date.now() - startTime
    console.log(`[${requestId}][GET 章节评论] 成功响应 (${responseTime}ms):`, {
      totalComments: result.total,
      returnedComments: result.comments.length,
      page,
      limit
    })
    
    res.json(result);
  } catch (error: any) {
    const responseTime = Date.now() - startTime
    console.error(`[${requestId}][GET 章节评论] 处理失败 (${responseTime}ms):`, {
      storyId: req.params.storyId,
      chapterId: req.params.chapterId,
      error: error.message,
      stack: error.stack
    })
    res.status(500).json({ error: error?.message });
  }
});

// 添加章节评论
app.post('/api/stories/:storyId/chapters/:chapterId/comments', async (req, res) => {
  const startTime = Date.now()
  const requestId = Math.random().toString(36).substring(2, 10)
  
  console.log(`[${requestId}][POST 添加评论] 开始处理请求:`, {
    headers: {
      authorization: req.headers.authorization ? '存在' : '不存在',
      contentType: req.headers['content-type']
    },
    params: req.params,
    body: {
      contentLength: req.body.content?.length
    },
    timestamp: new Date().toISOString()
  })
  
  try {
    // 使用统一认证函数验证用户
    try {
      const { user, userId } = await authService.authenticateUser({
        address: req.body.address,
        userId: req.body.userId,
        token: req.headers.authorization?.replace('Bearer ', '')
      });
    
      console.log(`[${requestId}][POST 添加评论] 认证成功:`, {
      storyId: req.params.storyId,
      chapterId: req.params.chapterId,
      userId: userId,
      contentLength: req.body.content?.length,
      ip: req.ip,
      userAgent: req.get('user-agent'),
      timestamp: new Date().toISOString()
    })
    
    const { storyId, chapterId } = req.params;
    const { content } = req.body;
    
    // 参数验证
    if (!content) {
      console.warn(`[${requestId}][POST 添加评论] 缺少评论内容`)
      return res.status(400).json({ error: '评论内容不能为空' });
    }
    
    if (content.length > 2000) {
      console.warn(`[${requestId}][POST 添加评论] 评论内容过长: ${content.length} 字符`)
      return res.status(400).json({ error: '评论内容不能超过2000字符' });
    }
    
    console.log(`[${requestId}][POST 添加评论] 调用 commentService.createComment, 参数:`, {
      content: content.substring(0, 20) + (content.length > 20 ? '...' : ''),
      userId,
      storyId,
      chapterId
    })
    
    const comment = await commentService.createComment({
      content,
      userId,
      storyId,
      chapterId
    });
    
    const responseTime = Date.now() - startTime
    console.log(`[${requestId}][POST 添加评论] 成功响应 (${responseTime}ms):`, {
      commentId: comment.id,
      storyId,
      chapterId,
      userId
    })
    
    res.json(comment);
    } catch (authError) {
      console.error(`[${requestId}][POST 添加评论] 认证失败:`, authError);
      res.status(401).json({ error: (authError as Error).message || '认证失败' });
    }
  } catch (err: any) {
    const responseTime = Date.now() - startTime
    console.error(`[${requestId}][POST 添加评论] 处理失败 (${responseTime}ms):`, {
      storyId: req.params.storyId,
      chapterId: req.params.chapterId,
      error: err.message,
      stack: err.stack
    })
    res.status(500).json({ error: err?.message });
  }
});

// 删除章节评论
app.delete('/api/stories/:storyId/chapters/:chapterId/comments/:commentId', async (req, res) => {
  const startTime = Date.now()
  const requestId = Math.random().toString(36).substring(2, 10)
  
  try {
    // 使用统一认证函数验证用户
    try {
      const { user, userId } = await authService.authenticateUser({
        address: req.body.address,
        userId: req.body.userId,
        token: req.headers.authorization?.replace('Bearer ', '')
      });
    
    console.log(`[${requestId}][DELETE 删除评论] 开始处理请求:`, {
      storyId: req.params.storyId,
      chapterId: req.params.chapterId,
      commentId: req.params.commentId,
      userId: userId,
      ip: req.ip,
      userAgent: req.get('user-agent'),
      timestamp: new Date().toISOString()
    })
    
    const { commentId } = req.params;
    
    // 权限检查可以在服务层实现，这里可以增加简单验证
    // TODO: 添加用户权限检查，确保只有评论作者或管理员可以删除评论
    
    console.log(`[${requestId}][DELETE 删除评论] 调用 commentService.deleteComment`)
    await commentService.deleteComment(commentId);
    
    const responseTime = Date.now() - startTime
    console.log(`[${requestId}][DELETE 删除评论] 成功响应 (${responseTime}ms):`, {
      commentId,
      storyId: req.params.storyId,
      chapterId: req.params.chapterId
    })
    
    res.json({ success: true });
    } catch (authError) {
      console.error(`[${requestId}][DELETE 删除评论] 认证失败:`, authError);
      res.status(401).json({ error: (authError as Error).message || '认证失败' });
    }
  } catch (error: any) {
    const responseTime = Date.now() - startTime
    console.error(`[${requestId}][DELETE 删除评论] 处理失败 (${responseTime}ms):`, {
      storyId: req.params.storyId,
      chapterId: req.params.chapterId,
      commentId: req.params.commentId,
      error: error.message,
      stack: error.stack
    })
    res.status(500).json({ error: error?.message });
  }
});

// 获取评论回复
app.get('/api/stories/:storyId/chapters/:chapterId/comments/:commentId/replies', async (req, res) => {
  const startTime = Date.now()
  const requestId = Math.random().toString(36).substring(2, 10)
  
  try {
    console.log(`[${requestId}][GET 评论回复] 开始处理请求:`, {
      storyId: req.params.storyId,
      chapterId: req.params.chapterId,
      commentId: req.params.commentId,
      page: req.query.page,
      limit: req.query.limit,
      userId: req.query.userId || req.body.userId,
      ip: req.ip,
      userAgent: req.get('user-agent'),
      timestamp: new Date().toISOString()
    })
    
    const { commentId } = req.params;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;
    const userId = req.query.userId as string || req.body.userId;
    
    console.log(`[${requestId}][GET 评论回复] 解析参数:`, {
      commentId,
      page,
      limit,
      skip,
      userId
    })
    
    console.log(`[${requestId}][GET 评论回复] 调用 commentService.getCommentReplies`)
    const result = await commentService.getCommentReplies(commentId, {
      skip,
      take: limit
    });
    
    // 处理用户点赞状态
    const formattedReplies = result.replies.map(reply => ({
      ...reply,
      isLiked: userId ? reply.likes.some(like => like.userId === userId) : false,
      likeCount: reply.likes.length
    }));
    
    const responseTime = Date.now() - startTime
    console.log(`[${requestId}][GET 评论回复] 成功响应 (${responseTime}ms):`, {
      commentId,
      totalReplies: result.total,
      returnedReplies: formattedReplies.length,
      page,
      limit
    })
    
    res.json({
      total: result.total,
      replies: formattedReplies
    });
  } catch (error: any) {
    const responseTime = Date.now() - startTime
    console.error(`[${requestId}][GET 评论回复] 处理失败 (${responseTime}ms):`, {
      storyId: req.params.storyId,
      chapterId: req.params.chapterId,
      commentId: req.params.commentId,
      error: error.message,
      stack: error.stack
    })
    res.status(500).json({ error: error?.message });
  }
});

// 添加评论回复
app.post('/api/stories/:storyId/chapters/:chapterId/comments/:commentId/replies', async (req, res) => {
  const startTime = Date.now()
  const requestId = Math.random().toString(36).substring(2, 10)
  
  try {
    // 使用统一认证方法
    try {
      const { user, userId } = await authService.authenticateUser({
        address: req.body.address,
        userId: req.body.userId,
        token: req.headers.authorization?.replace('Bearer ', '')
      });
    
    console.log(`[${requestId}][POST 添加回复] 开始处理请求:`, {
      storyId: req.params.storyId,
      chapterId: req.params.chapterId,
      commentId: req.params.commentId,
      userId: userId,
      contentLength: req.body.content?.length,
      replyToId: req.body.replyToId,
      replyToName: req.body.replyToName,
      ip: req.ip,
      userAgent: req.get('user-agent'),
      timestamp: new Date().toISOString()
    })
    
    const { storyId, chapterId, commentId } = req.params;
    const { content, replyToId, replyToName } = req.body;
    
    // 参数验证
    if (!content) {
      console.warn(`[${requestId}][POST 添加回复] 缺少回复内容`)
      return res.status(400).json({ error: '回复内容不能为空' });
    }
    
    if (content.length > 1000) {
      console.warn(`[${requestId}][POST 添加回复] 回复内容过长: ${content.length} 字符`)
      return res.status(400).json({ error: '回复内容不能超过1000字符' });
    }
    
    console.log(`[${requestId}][POST 添加回复] 调用 commentService.createComment, 参数:`, {
      content: content.substring(0, 20) + (content.length > 20 ? '...' : ''),
      userId,
      storyId,
      chapterId,
      parentId: commentId,
      replyToId,
      replyToName
    })
    
    const reply = await commentService.createComment({
      content,
      userId,
      storyId,
      chapterId,
      parentId: commentId,
      replyToId,
      replyToName
    });
    
    const responseTime = Date.now() - startTime
    console.log(`[${requestId}][POST 添加回复] 成功响应 (${responseTime}ms):`, {
      replyId: reply.id,
      commentId,
      storyId,
      chapterId,
      userId,
      hasReplyTo: !!replyToId
    })
    
    res.json(reply);
    } catch (authError) {
      console.error(`[${requestId}][POST 添加回复] 认证失败:`, authError);
      res.status(401).json({ error: (authError as Error).message || '认证失败' });
    }
  } catch (error: any) {
    const responseTime = Date.now() - startTime
    console.error(`[${requestId}][POST 添加回复] 处理失败 (${responseTime}ms):`, {
      storyId: req.params.storyId,
      chapterId: req.params.chapterId,
      commentId: req.params.commentId,
      error: error.message,
      stack: error.stack
    })
    res.status(500).json({ error: error?.message });
  }
});

// 点赞评论
app.post('/api/stories/:storyId/chapters/:chapterId/comments/:commentId/like', async (req, res) => {
  const startTime = Date.now()
  const requestId = Math.random().toString(36).substring(2, 10)
  
  try {
    // 使用统一认证方法
    try {
      const { user, userId } = await authService.authenticateUser({
        address: req.body.address,
        userId: req.body.userId,
        token: req.headers.authorization?.replace('Bearer ', '')
      });
    
    console.log(`[${requestId}][POST 点赞评论] 开始处理请求:`, {
      storyId: req.params.storyId,
      chapterId: req.params.chapterId,
      commentId: req.params.commentId,
      userId: userId,
      ip: req.ip,
      userAgent: req.get('user-agent'),
      timestamp: new Date().toISOString()
    })
    
    const { commentId } = req.params;
    
    console.log(`[${requestId}][POST 点赞评论] 调用 commentService.likeComment`)
    await commentService.likeComment(userId, commentId);
    
    const responseTime = Date.now() - startTime
    console.log(`[${requestId}][POST 点赞评论] 成功响应 (${responseTime}ms):`, {
      commentId,
      userId
    })
    
    res.json({ success: true });
    } catch (authError) {
      console.error(`[${requestId}][POST 点赞评论] 认证失败:`, authError);
      res.status(401).json({ error: (authError as Error).message || '认证失败' });
    }
  } catch (error: any) {
    const responseTime = Date.now() - startTime
    
    // 已点赞不算真的错误，返回特殊状态码
    if (error.message === 'Already liked this comment') {
      console.log(`[${requestId}][POST 点赞评论] 已点赞过 (${responseTime}ms):`, {
        commentId: req.params.commentId
      })
      return res.json({ success: false, error: '已经点过赞了' });
    }
    
    console.error(`[${requestId}][POST 点赞评论] 处理失败 (${responseTime}ms):`, {
      storyId: req.params.storyId,
      chapterId: req.params.chapterId,
      commentId: req.params.commentId,
      error: error.message,
      stack: error.stack
    })
    res.status(500).json({ error: error?.message });
  }
});

// 取消点赞评论
app.post('/api/stories/:storyId/chapters/:chapterId/comments/:commentId/unlike', async (req, res) => {
  const startTime = Date.now()
  const requestId = Math.random().toString(36).substring(2, 10)
  
  try {
    // 使用统一认证方法
    try {
      const { user, userId } = await authService.authenticateUser({
        address: req.body.address,
        userId: req.body.userId,
        token: req.headers.authorization?.replace('Bearer ', '')
      });
    
    console.log(`[${requestId}][POST 取消点赞] 开始处理请求:`, {
      storyId: req.params.storyId,
      chapterId: req.params.chapterId,
      commentId: req.params.commentId,
      userId: userId,
      ip: req.ip,
      userAgent: req.get('user-agent'),
      timestamp: new Date().toISOString()
    })
    
    const { commentId } = req.params;
    
    console.log(`[${requestId}][POST 取消点赞] 调用 commentService.unlikeComment`)
    await commentService.unlikeComment(userId, commentId);
    
    const responseTime = Date.now() - startTime
    console.log(`[${requestId}][POST 取消点赞] 成功响应 (${responseTime}ms):`, {
      commentId,
      userId
    })
    
    res.json({ success: true });
    } catch (authError) {
      console.error(`[${requestId}][POST 取消点赞] 认证失败:`, authError);
      res.status(401).json({ error: (authError as Error).message || '认证失败' });
    }
  } catch (error: any) {
    const responseTime = Date.now() - startTime
    
    // 未点赞不算真的错误，返回特殊状态码
    if (error.message === 'Not liked this comment yet') {
      console.log(`[${requestId}][POST 取消点赞] 未点赞过 (${responseTime}ms):`, {
        commentId: req.params.commentId
      })
      return res.json({ success: false, error: '尚未点赞，无需取消' });
    }
    
    console.error(`[${requestId}][POST 取消点赞] 处理失败 (${responseTime}ms):`, {
      storyId: req.params.storyId,
      chapterId: req.params.chapterId,
      commentId: req.params.commentId,
      error: error.message,
      stack: error.stack
    })
    res.status(500).json({ error: error?.message });
  }
});

/**
 * 关注相关路由
 */

// 1. 获取用户的粉丝列表
app.get('/api/users/:userId/followers', async (req, res) => {
  const requestId = uuidv4();
  const startTime = Date.now();
  
  try {
    const { userId } = req.params;
    const skip = parseInt(req.query.skip as string || '0');
    const limit = parseInt(req.query.limit as string || '10');
    
    console.log(`[${requestId}][GET /api/users/:userId/followers] 收到请求:`, {
      userId,
      skip,
      limit
    });
    
    // 验证用户身份（可选，根据业务需求）
    const token = req.headers.authorization?.split(' ')[1];
    if (token) {
      const decodedToken = await verifyToken(token);
      if (decodedToken.userId !== userId) {
        const responseTime = Date.now() - startTime;
        console.error(`[${requestId}][GET /api/users/:userId/followers] 用户认证失败 (${responseTime}ms)`, {
          requestUserId: userId,
          tokenUserId: decodedToken.userId
        });
        return res.status(403).json({ error: '无权访问该资源' });
      }
    }
    
    const result = await userService.getFollowers(userId, skip, limit);
    
    const responseTime = Date.now() - startTime;
    console.log(`[${requestId}][GET /api/users/:userId/followers] 查询成功 (${responseTime}ms):`, {
      userId,
      followerCount: result.total,
      returnedFollowers: result.followers.length
    });
    
    res.json({
      followers: result.followers,
      total: result.total,
      skip,
      limit
    });
  } catch (error: any) {
    const responseTime = Date.now() - startTime;
    console.error(`[${requestId}][GET /api/users/:userId/followers] 查询失败 (${responseTime}ms):`, error);
    res.status(500).json({ error: '获取粉丝列表失败' });
  }
});

// 2. 获取用户关注的作者列表
app.get('/api/users/:userId/following', async (req, res) => {
  const requestId = uuidv4();
  const startTime = Date.now();
  
  try {
    const { userId } = req.params;
    const skip = parseInt(req.query.skip as string || '0');
    const limit = parseInt(req.query.limit as string || '10');
    const page = parseInt(req.query.page as string || '1');
    const address = req.query.address as string;
    
    console.log(`[${requestId}][GET /api/users/:userId/following] 收到请求:`, {
      userId,
      skip,
      limit,
      page,
      address,
      headers: {
        authorization: req.headers.authorization ? '存在' : '不存在',
        contentType: req.headers['content-type']
      },
      query: req.query,
      originalUrl: req.originalUrl,
      path: req.path
    });
    
    // 验证用户身份（可选，根据业务需求）
    const token = req.headers.authorization?.split(' ')[1];
    console.log(`[${requestId}][GET /api/users/:userId/following] 认证信息:`, {
      hasToken: !!token,
      tokenLength: token?.length
    });
    
    // 当userId为'address'时，表示这是一个使用地址参数的请求
    // 在这种情况下，不需要验证token中的userId与路径参数匹配
    const isAddressRequest = userId === 'address';
    
    if (token && !isAddressRequest) {
      try {
        const decodedToken = await verifyToken(token);
        console.log(`[${requestId}][GET /api/users/:userId/following] 令牌解析结果:`, {
          decodedUserId: decodedToken.userId,
          requestUserId: userId,
          isMatch: decodedToken.userId === userId
        });
        
        if (decodedToken.userId !== userId) {
          const responseTime = Date.now() - startTime;
          console.error(`[${requestId}][GET /api/users/:userId/following] 用户认证失败 (${responseTime}ms)`, {
            requestUserId: userId,
            tokenUserId: decodedToken.userId,
            reason: '令牌中的用户ID与请求的用户ID不匹配'
          });
          return res.status(403).json({ error: '无权访问该资源' });
        }
      } catch (tokenError) {
        console.error(`[${requestId}][GET /api/users/:userId/following] 令牌验证失败:`, tokenError);
      }
    }
    
    // 确定要查询的实际用户ID
    let targetUserId = userId;
    if (isAddressRequest && address) {
      // 如果是使用地址参数的请求，需要先根据地址查找用户ID
      console.log(`[${requestId}][GET /api/users/:userId/following] 使用地址参数查询:`, {
        address
      });
      
      try {
        const user = await userService.getUserByAddress(address);
        if (user) {
          targetUserId = user.id;
          console.log(`[${requestId}][GET /api/users/:userId/following] 地址对应的用户ID:`, {
            address,
            userId: targetUserId
          });
        } else {
          console.error(`[${requestId}][GET /api/users/:userId/following] 找不到对应地址的用户:`, {
            address
          });
          return res.status(404).json({ error: '找不到对应地址的用户' });
        }
      } catch (userLookupError) {
        console.error(`[${requestId}][GET /api/users/:userId/following] 查找用户失败:`, userLookupError);
        return res.status(500).json({ error: '查找用户失败' });
      }
    }
    
    console.log(`[${requestId}][GET /api/users/:userId/following] 开始查询数据库，参数:`, {
      targetUserId,
      skip,
      limit,
      page
    });
    
    const result = await userService.getUserFollowing(targetUserId, skip, limit);
    
    console.log(`[${requestId}][GET /api/users/:userId/following] 数据库查询完成，结果:`, {
      targetUserId,
      totalFollowing: result.total,
      returnedCount: result.following.length,
      firstFollowingId: result.following[0]?.id || 'N/A',
      lastFollowingId: result.following.length > 0 ? result.following[result.following.length - 1].id : 'N/A'
    });
    
    const responseTime = Date.now() - startTime;
    console.log(`[${requestId}][GET /api/users/:userId/following] 查询成功 (${responseTime}ms):`, {
      targetUserId,
      followingCount: result.total,
      returnedFollowing: result.following.length,
      pageInfo: {
        skip,
        limit,
        page: page || Math.floor(skip / limit) + 1,
        pageCount: Math.ceil(result.total / limit)
      }
    });
    
    // 计算分页信息
    const currentPage = page || Math.floor(skip / limit) + 1;
    const pageCount = Math.ceil(result.total / limit);
    
    res.json({
      following: result.following,
      total: result.total,
      skip,
      limit,
      page: currentPage,
      pageCount
    });
  } catch (error: any) {
    const responseTime = Date.now() - startTime;
    console.error(`[${requestId}][GET /api/users/:userId/following] 查询失败 (${responseTime}ms):`, {
      error: error.message,
      stack: error.stack,
      userId: req.params.userId,
      query: req.query
    });
    res.status(500).json({ error: '获取关注列表失败' });
  }
});

// 3. 用户关注作者
app.post('/api/users/:userId/following/:authorId', async (req, res) => {
  const requestId = uuidv4();
  const startTime = Date.now();
  
  try {
    const { userId, authorId } = req.params;
    
    console.log(`[${requestId}][POST /api/users/:userId/following/:authorId] 收到请求:`, {
      userId,
      authorId
    });
    
    // 验证用户身份
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      const responseTime = Date.now() - startTime;
      console.error(`[${requestId}][POST /api/users/:userId/following/:authorId] 缺少认证令牌 (${responseTime}ms)`);
      return res.status(401).json({ error: '需要认证' });
    }
    
    const decodedToken = await verifyToken(token);
    if (decodedToken.userId !== userId) {
      const responseTime = Date.now() - startTime;
      console.error(`[${requestId}][POST /api/users/:userId/following/:authorId] 用户认证失败 (${responseTime}ms)`, {
        requestUserId: userId,
        tokenUserId: decodedToken.userId
      });
      return res.status(403).json({ error: '无权执行此操作' });
    }
    
    const result = await userService.followAuthor(userId, authorId);
    
    const responseTime = Date.now() - startTime;
    console.log(`[${requestId}][POST /api/users/:userId/following/:authorId] 关注成功 (${responseTime}ms):`, {
      userId,
      authorId,
      authorName: result.authorName
    });
    
    res.status(201).json(result);
  } catch (error: any) {
    const responseTime = Date.now() - startTime;
    console.error(`[${requestId}][POST /api/users/:userId/following/:authorId] 关注失败 (${responseTime}ms):`, error);
    
    if (error.message === 'User not found' || error.message === 'Author not found') {
      return res.status(404).json({ error: error.message });
    }
    
    res.status(500).json({ error: '关注作者失败' });
  }
});

// 4. 用户取消关注作者
app.delete('/api/users/:userId/following/:authorId', async (req, res) => {
  const requestId = uuidv4();
  const startTime = Date.now();
  
  try {
    const { userId, authorId } = req.params;
    
    console.log(`[${requestId}][DELETE /api/users/:userId/following/:authorId] 收到请求:`, {
      userId,
      authorId
    });
    
    // 验证用户身份
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      const responseTime = Date.now() - startTime;
      console.error(`[${requestId}][DELETE /api/users/:userId/following/:authorId] 缺少认证令牌 (${responseTime}ms)`);
      return res.status(401).json({ error: '需要认证' });
    }
    
    const decodedToken = await verifyToken(token);
    if (decodedToken.userId !== userId) {
      const responseTime = Date.now() - startTime;
      console.error(`[${requestId}][DELETE /api/users/:userId/following/:authorId] 用户认证失败 (${responseTime}ms)`, {
        requestUserId: userId,
        tokenUserId: decodedToken.userId
      });
      return res.status(403).json({ error: '无权执行此操作' });
    }
    
    const result = await userService.unfollowAuthor(userId, authorId);
    
    const responseTime = Date.now() - startTime;
    console.log(`[${requestId}][DELETE /api/users/:userId/following/:authorId] 取消关注成功 (${responseTime}ms):`, {
      userId,
      authorId
    });
    
    res.json(result);
  } catch (error: any) {
    const responseTime = Date.now() - startTime;
    console.error(`[${requestId}][DELETE /api/users/:userId/following/:authorId] 取消关注失败 (${responseTime}ms):`, error);
    
    if (error.message === 'User not found' || error.message === 'Author not found') {
      return res.status(404).json({ error: error.message });
    }
    
    res.status(500).json({ error: '取消关注作者失败' });
  }
});

// 5. 检查用户是否关注了某作者
app.get('/api/users/:userId/following/:authorId/status', async (req, res) => {
  const requestId = uuidv4();
  const startTime = Date.now();
  
  try {
    const { userId, authorId } = req.params;
    
    console.log(`[${requestId}][GET /api/users/:userId/following/:authorId/status] 收到请求:`, {
      userId,
      authorId
    });
    
    // 验证用户身份
    const token = req.headers.authorization?.split(' ')[1];
    if (token) {
      try {
        const decodedToken = await verifyToken(token);
        if (decodedToken.userId !== userId) {
          console.log(`[${requestId}][GET /api/users/:userId/following/:authorId/status] 用户认证信息不匹配:`, {
            requestUserId: userId,
            tokenUserId: decodedToken.userId
          });
        }
      } catch (authError) {
        console.error(`[${requestId}][GET /api/users/:userId/following/:authorId/status] 用户认证失败:`, authError);
      }
    }
    
    const result = await userService.checkFollowStatus(userId, authorId);
    
    const responseTime = Date.now() - startTime;
    console.log(`[${requestId}][GET /api/users/:userId/following/:authorId/status] 查询成功 (${responseTime}ms):`, {
      userId,
      authorId,
      isFollowing: result.isFollowing
    });
    
    res.json(result);
  } catch (error: any) {
    const responseTime = Date.now() - startTime;
    console.error(`[${requestId}][GET /api/users/:userId/following/:authorId/status] 查询失败 (${responseTime}ms):`, error);
    
    if (error.message === 'User not found' || error.message === 'Author not found') {
      return res.status(404).json({ error: error.message, isFollowing: false });
    }
    
    res.status(500).json({ error: '检查关注状态失败', isFollowing: false });
  }
});

/**
 * 收藏相关路由
 */

// 添加收藏
app.post('/api/stories/:storyId/favorite', async (req, res) => {
  try {
    console.log('[POST 添加收藏] 收到请求:', {
      storyId: req.params.storyId,
      body: req.body,
      headers: {
        authorization: req.headers.authorization ? '存在' : '不存在',
        contentType: req.headers['content-type']
      }
    });
    
    const { storyId } = req.params;
    console.log('[POST 添加收藏] 参数验证: storyId =', storyId);
    
    if (!storyId) {
      console.error('[POST 添加收藏] 缺少故事ID');
      return res.status(400).json({ error: '缺少故事ID' });
    }
    
    // 使用统一认证函数验证用户
    try {
      console.log('[POST 添加收藏] 开始用户认证, 认证数据:', {
        hasAddress: !!req.body.address,
        hasUserId: !!req.body.userId,
        hasToken: !!(req.body.token || req.headers.authorization)
      });
      
      const { user, userId } = await authService.authenticateUser({
        address: req.body.address,
        userId: req.body.userId,
        token: req.body.token || req.headers.authorization?.replace('Bearer ', '')
      });
      
      console.log('[POST 添加收藏] 用户认证成功:', {
        userId,
        address: user.address,
        hasEmail: !!user.email
      });
      
      // 添加收藏
      console.log('[POST 添加收藏] 开始调用收藏服务');
      const favorite = await userService.favoriteStory(userId, storyId);
      
      console.log('[POST 添加收藏] 收藏成功:', {
        favoriteId: favorite.id,
        userId,
        storyId
      });
      
      res.json(favorite);
    } catch (authError) {
      console.error('[POST 添加收藏] 认证失败, 详细信息:', authError);
      console.error('[POST 添加收藏] 认证错误堆栈:', (authError as Error).stack);
      res.status(401).json({ error: (authError as Error).message || '认证失败' });
    }
  } catch (error: any) {
    console.error('[POST 添加收藏] 操作失败, 详细错误:', error);
    console.error('[POST 添加收藏] 错误堆栈:', error.stack);
    
    // 如果是唯一性约束错误，返回已收藏信息
    if (error.code === 'P2002') {
      console.log('[POST 添加收藏] 唯一性约束错误, 可能已经收藏过');
      return res.status(400).json({ error: '已经收藏过该故事' });
    }
    
    // 如果是字段不存在错误
    if (error.code === 'P2003' || error.message?.includes('column') || error.message?.includes('field')) {
      console.error('[POST 添加收藏] 数据库字段错误:', error.message);
      return res.status(500).json({ error: '数据库字段错误，请联系管理员' });
    }
    
    res.status(500).json({ error: error?.message || '添加收藏失败' });
  }
});

// 删除收藏
app.delete('/api/stories/:storyId/favorite', async (req, res) => {
  try {
    console.log('[DELETE 取消收藏] 收到请求:', {
      storyId: req.params.storyId,
      body: req.body,
      auth: req.headers.authorization ? '存在' : '不存在'
    });
    
    const { storyId } = req.params;
    
    // 使用统一认证函数验证用户
    try {
      const { user, userId } = await authService.authenticateUser({
        address: req.body.address,
        userId: req.body.userId,
        token: req.body.token || req.headers.authorization?.replace('Bearer ', '')
      });
      
      // 取消收藏
      await userService.unfavoriteStory(userId, storyId);
      
      res.json({ success: true });
    } catch (authError) {
      console.error('[DELETE 取消收藏] 认证失败:', authError);
      res.status(401).json({ error: (authError as Error).message || '认证失败' });
    }
  } catch (error: any) {
    console.error('[DELETE 取消收藏] 失败:', error);
    
    // 如果是记录不存在错误
    if (error.code === 'P2025') {
      return res.status(404).json({ error: '未收藏该故事' });
    }
    
    res.status(500).json({ error: error?.message || '取消收藏失败' });
  }
});
// 获取用户收藏列表（支持多种认证方式）- 提前定义，确保优先级高于地址路由
app.get('/api/user/bookshelf', async (req, res) => {  
  try {
    console.log('[后端-书架API] 收到请求:', {
      address: req.query.address,
      userId: req.query.userId,
      token: req.query.token ? '存在' : (req.headers.authorization ? '存在于header' : '不存在'),
      query: req.query,
      url: req.url,
      headers: {
        authorization: req.headers.authorization ? '存在' : '不存在',
        contentType: req.headers['content-type']
      }
    });
    
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;
    
    console.log('[后端-书架API] 分页参数:', { page, limit, skip });
    
    // 使用统一认证函数验证用户
    try {
      console.log('[后端-书架API] 开始认证用户');
      
      const { user, userId } = await authService.authenticateUser({
        address: req.query.address as string,
        userId: req.query.userId as string,
        token: (req.query.token || req.headers.authorization?.replace('Bearer ', '')) as string
      });
      
      console.log('[后端-书架API] 用户认证成功:', {
        userId: userId,
        address: user.address,
        email: user.email ? '存在' : '不存在'
      });
      
      // 获取收藏列表
      console.log('[后端-书架API] 开始获取收藏列表');
      const { total, favorites } = await userService.getUserFavorites(userId, {
        skip,
        take: limit
      });
      
      console.log('[后端-书架API] 收藏列表获取成功:', {
        total,
        current: favorites.length
      });
      
      // 格式化返回数据
      const formattedFavorites = favorites.map(fav => {
        // 处理阅读进度
        // @ts-ignore - 数据库模型可能还没更新包含readingProgress字段
        const progress = typeof fav.readingProgress === 'number' ? fav.readingProgress : Math.floor(Math.random() * 100);
        
        return {
          id: fav.id,
          storyId: fav.storyId,
          title: fav.story.title,
          description: fav.story.description,
          coverCid: fav.story.coverCid,
          authorId: fav.story.authorId,
          createdAt: fav.createdAt,
          progress
        };
      });
      
      const response = {
        total,
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        items: formattedFavorites
      };
      
      console.log('[后端-书架API] 请求完成:', {
        totalItems: formattedFavorites.length,
        totalPages: Math.ceil(total / limit)
      });
      
      res.json(response);
    } catch (authError) {
      console.error('[后端-书架API] 认证失败:', {
        error: (authError as Error).message
      });
      res.status(401).json({ error: (authError as Error).message || '认证失败' });
    }
  } catch (error: any) {
    console.error('[后端-书架API] 处理失败:', {
      error: error.message,
      code: error.code
    });
    res.status(500).json({ error: error?.message || '获取书架失败' });
  }
});

/**
 * 用户阅读历史相关路由
 */
// GET - 获取用户阅读历史
app.get('/api/user/reading-history', async (req, res) => {
  try {
    console.log('[GET /api/user/reading-history] 收到请求:', {
      query: req.query
    })
    
    const { userId, address } = req.query
    const page = parseInt(req.query.page as string) || 1
    const limit = parseInt(req.query.limit as string) || 10
    
    if (!userId && !address) {
      console.log('[GET /api/user/reading-history] 错误: 缺少用户标识')
      return res.status(400).json({ error: '缺少必要参数: userId 或 address' })
    }
    
    const result = await userService.getUserReadingHistory(
      { 
        userId: userId as string, 
        address: address as string 
      },
      page,
      limit
    )
    
    console.log('[GET /api/user/reading-history] 查询成功:', {
      total: result.total,
      page,
      limit
    })
    
    res.json(result)
  } catch (error: any) {
    console.error('[GET /api/user/reading-history] 查询失败:', error)
    res.status(500).json({ error: error.message || '获取阅读历史失败' })
  }
})

// POST - 更新用户阅读历史
app.post('/api/user/reading-history', async (req, res) => {
  try {
    console.log('[POST /api/user/reading-history] 收到请求:', {
      body: req.body
    })
    
    const { storyId, userId, address, chapterOrder } = req.body
    
    if (!storyId) {
      console.log('[POST /api/user/reading-history] 错误: 缺少故事ID')
      return res.status(400).json({ error: '缺少必要参数: storyId' })
    }
    
    if (!userId && !address) {
      console.log('[POST /api/user/reading-history] 错误: 缺少用户标识')
      return res.status(400).json({ error: '缺少必要参数: userId 或 address' })
    }
    
    const result = await userService.updateReadingHistory({
      storyId,
      userId,
      address,
      chapterOrder
    })
    
    console.log('[POST /api/user/reading-history] 更新成功:', {
      id: result.id,
      progress: result.readingProgress,
      chapterOrder: result.lastChapterOrder
    })
    
    res.json({
      success: true,
      id: result.id,
      progress: result.readingProgress,
      chapterOrder: result.lastChapterOrder
    })
  } catch (error: any) {
    console.error('[POST /api/user/reading-history] 更新失败:', error)
    res.status(500).json({ error: error.message || '更新阅读历史失败' })
  }
})

// GET - 获取用户评论历史
app.get('/api/user/comments', async (req, res) => {
  try {
    const requestId = Math.random().toString(36).substring(2, 10); // 生成请求ID方便跟踪
    console.log(`[${requestId}][后端API-用户评论历史] 收到请求:`, {
      url: req.url,
      method: req.method,
      query: req.query,
      params: req.params,
      authorization: req.headers.authorization ? '存在' : '不存在',
      userAgent: req.headers['user-agent']?.substring(0, 50) + '...',
      timestamp: new Date().toISOString()
    });
    
    const { userId, address, page = '1', limit = '10' } = req.query;
    
    if (!userId && !address) {
      console.log(`[${requestId}][后端API-用户评论历史] 缺少必要参数: userId或address`);
      return res.status(400).json({ error: '必须提供userId或address参数' });
    }
    
    // 提取当前用户ID (用于获取是否已点赞)
    let currentUserId = null;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      try {
        // 注意: 这里假设有一个验证token并提取userId的函数，实际实现可能不同
        const decoded = await authService.verifyToken(token);
        currentUserId = decoded.userId;
        console.log(`[${requestId}][后端API-用户评论历史] 当前用户认证信息:`, {
          token: token ? token.substring(0, 10) + '...' : null,
          currentUserId
        });
      } catch (error) {
        console.warn(`[${requestId}][后端API-用户评论历史] Token验证失败:`, error);
      }
    } else {
      console.log(`[${requestId}][后端API-用户评论历史] 未提供Token`);
    }
    
    // 转换页码和限制为数字
    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    
    console.log(`[${requestId}][后端API-用户评论历史] 查询参数:`, {
      userId,
      address,
      page: pageNum,
      limit: limitNum,
      currentUserId
    });
    
    // 调用服务获取评论
    const startTime = Date.now();
    const result = await commentService.getUserComments({
      userId: userId as string,
      address: address as string,
      page: pageNum,
      limit: limitNum,
      currentUserId
    });
    const responseTime = Date.now() - startTime;
    
    console.log(`[${requestId}][后端API-用户评论历史] 查询成功:`, {
      responseTime: `${responseTime}ms`,
      total: result.total,
      page: result.page,
      pageCount: result.pageCount,
      commentsCount: result.comments?.length,
      firstCommentId: result.comments?.length > 0 ? result.comments[0].id : null,
      lastCommentId: result.comments?.length > 0 ? result.comments[result.comments.length - 1].id : null
    });
    
    res.json(result);
  } catch (error: any) {
    console.error('[后端API-用户评论历史] 处理异常:', error);
    res.status(500).json({ error: error?.message || '服务器内部错误' });
  }
});

// 获取用户点赞历史
app.get('/api/user/likes', async (req, res) => {
  const requestId = Math.random().toString(36).substring(2, 10);
  const startTime = Date.now();
  
  try {
    console.log(`[${requestId}][GET /api/user/likes] 收到查询请求:`, {
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
      
      console.log(`[${requestId}][GET /api/user/likes] 认证成功:`, {
        userId,
        address: user.address
      });
      
      // 获取分页参数
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const skip = (page - 1) * limit;
      
      // 使用 userService 查询点赞数据
      console.log(`[${requestId}][GET /api/user/likes] 开始查询用户点赞数据:`, {
        userId,
        page,
        limit
      });
      
      // 通过 userService 获取用户点赞列表
      const result = await userService.getUserLikes(userId, {
        skip,
        take: limit
      });
      
      const responseTime = Date.now() - startTime;
      console.log(`[${requestId}][GET /api/user/likes] 查询成功 (${responseTime}ms):`, {
        totalLikes: result.total,
        returnedLikes: result.likes.length,
        page,
        pageCount: Math.ceil(result.total / limit)
      });
      
      res.json({
        likes: result.likes,
        total: result.total,
        page,
        pageCount: Math.ceil(result.total / limit)
      });
    } catch (authError) {
      const responseTime = Date.now() - startTime;
      console.error(`[${requestId}][GET /api/user/likes] 认证失败 (${responseTime}ms):`, authError);
      res.status(401).json({ error: (authError as Error).message || '认证失败' });
    }
  } catch (error: any) {
    const responseTime = Date.now() - startTime;
    console.error(`[${requestId}][GET /api/user/likes] 查询失败 (${responseTime}ms):`, error);
    res.status(500).json({ error: error?.message || '服务器错误' });
  }
});


// 互动数据同步API
app.post('/api/admin/interactions/sync', async (req, res) => {
  try {
    console.log('[POST /api/admin/interactions/sync] 收到手动触发批量上链请求')
    
    const result = await syncService.triggerInteractionBatchUpload();
    
    if (!result) {
      return res.json({ message: '无新互动数据需要上链' });
    }
    
    console.log('[POST /api/admin/interactions/sync] 批量上链成功:', result)
    res.json(result);
  } catch (error: any) {
    console.error('[POST /api/admin/interactions/sync] 批量上链失败:', error)
    res.status(500).json({ error: error?.message });
  }
});

// 获取批次记录列表
app.get('/api/admin/interactions/batches', async (req, res) => {
  try {
    console.log('[GET /api/admin/interactions/batches] 收到查询请求:', {
      query: req.query
    })
    
    const { limit, offset } = req.query;
    
    const batches = await syncService.getInteractionBatches(
      Number(limit) || 10,
      Number(offset) || 0
    );
    
    console.log('[GET /api/admin/interactions/batches] 查询成功:', {
      count: batches.length
    })
    
    res.json(batches);
  } catch (error: any) {
    console.error('[GET /api/admin/interactions/batches] 查询失败:', error)
    res.status(500).json({ error: error?.message });
  }
});

// 获取批次详情
app.get('/api/admin/interactions/batches/:id', async (req, res) => {
  try {
    console.log('[GET /api/admin/interactions/batches/:id] 收到查询请求:', {
      id: req.params.id
    })
    
    const { id } = req.params;
    const batch = await syncService.getInteractionBatchById(id);
    
    if (!batch) {
      return res.status(404).json({ error: '批次记录不存在' });
    }
    
    console.log('[GET /api/admin/interactions/batches/:id] 查询成功:', batch)
    res.json(batch);
  } catch (error: any) {
    console.error('[GET /api/admin/interactions/batches/:id] 查询失败:', error)
    res.status(500).json({ error: error?.message });
  }
});

// 错误处理中间件
app.use((err: any, req: any, res: any, next: any) => {
  console.error('Error:', err)
  res.status(500).json({
    error: err.message || 'Internal server error'
  })
})

// CORS 中间件
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*')
  res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE')
  res.header('Access-Control-Allow-Headers', 'Content-Type')
  next()
})

const port = process.env.PORT || 3001;
app.listen(port, () => {
  console.log(`Backend service running on port ${port}`);
}); 

