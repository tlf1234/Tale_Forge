import express from 'express';
import { storyService, userService, commentService } from './services';
import type { StoryStatus } from '@prisma/client'

const app = express();
// 增加请求体大小限制到 10MB
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

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

// 用户相关路由
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
    const author = await userService.getAuthorByAddress(address);
    
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

// POST - 验证作者身份
app.post('/api/authors/verify', async (req, res) => {
  console.log('[POST /api/authors/verify] 收到验证请求:', {
    body: req.body
  })
  // 处理验证
})


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
    const author = await userService.getAuthorByAddress(address)
    
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
  try {
    const { category, authorId, status, skip, take, orderBy } = req.query;
    const stories = await storyService.getStories({
      category: category as string,
      authorId: authorId as string,
      status: status as StoryStatus,
      skip: Number(skip),
      take: Number(take),
      orderBy: orderBy as string
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
    const { id } = req.params;
    const story = await storyService.getStory(id);
    res.json(story);
  } catch (error: any) {
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


// 关注相关路由
// GET - 获取关注列表
app.get('/api/authors/:address/follows', async (req, res) => {
  try {
    console.log('[GET /api/authors/:address/follows] 收到查询关注列表请求:', {
      address: req.params.address
    })
    
    const { address } = req.params;
    const follows = await userService.getAuthorFollows(address);
    
    console.log('[GET /api/authors/:address/follows] 查询成功:', follows)
    res.json(follows);
  } catch (error: any) {
    console.error('[GET /api/authors/:address/follows] 查询失败:', error)
    res.status(500).json({ error: error?.message });
  }
});

// POST - 创建新的关注关系
app.post('/api/authors/:address/follows', async (req, res) => {
  try {
    console.log('[POST /api/authors/:address/follows] 收到关注请求:', {
      address: req.params.address,
      followerAddress: req.body.followerAddress
    })
    
    const { address } = req.params;
    const { followerAddress } = req.body;
    const follow = await userService.followAuthor(address, followerAddress);
    
    console.log('[POST /api/authors/:address/follows] 关注成功:', follow)
    res.json(follow);
  } catch (error: any) {
    console.error('[POST /api/authors/:address/follows] 关注失败:', error)
    res.status(500).json({ error: error?.message });
  }
});

// DELETE - 删除关注关系
app.delete('/api/authors/:address/follows', async (req, res) => {
  try {
    console.log('[DELETE /api/authors/:address/follows] 收到取消关注请求:', {
      address: req.params.address,
      followerAddress: req.body.followerAddress
    })
    
    const { address } = req.params;
    const { followerAddress } = req.body;
    await userService.unfollowAuthor(address, followerAddress);
    
    console.log('[DELETE /api/authors/:address/follows] 取消关注成功')
    res.json({ success: true });
  } catch (error: any) {
    console.error('[DELETE /api/authors/:address/follows] 取消关注失败:', error)
    res.status(500).json({ error: error?.message });
  }
});

// 评论相关路由
app.get('/api/stories/:storyId/comments', async (req, res) => {
  try {
    const { storyId } = req.params;
    const { skip, take } = req.query;
    const comments = await commentService.getStoryComments(storyId, {
      skip: Number(skip),
      take: Number(take),
      currentUserId: req.body.userId
    });
    res.json(comments);
  } catch (error: any) {
    res.status(500).json({ error: error?.message });
  }
});

// 评论相关路由
app.post('/api/comments', async (req, res) => {
  try {
    const comment = await commentService.createComment(req.body);
    res.json(comment);
  } catch (error: any) {
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