import express from 'express';
import { storyService, userService, commentService } from './services';
import type { StoryStatus } from '@prisma/client'

const app = express();
app.use(express.json());

// 用户相关路由
app.get('/api/users/:address', async (req, res) => {
  try {
    const { address } = req.params;
    const user = await userService.getUser(address);
    res.json(user);
  } catch (error: any) {
    res.status(500).json({ error: error?.message });
  }
});

// 用户相关路由
app.post('/api/users', async (req, res) => {
  try {
    const user = await userService.getOrCreateUser(req.body.address);
    res.json(user);
  } catch (error: any) {
    res.status(500).json({ error: error?.message });
  }
});

// 更新用户信息
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

// 故事相关路由
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

app.get('/api/stories/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const story = await storyService.getStory(id);
    res.json(story);
  } catch (error: any) {
    res.status(500).json({ error: error?.message });
  }
});

app.post('/api/stories/validate', async (req, res) => {
  try {
    const result = await storyService.validateStory(req.body);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error?.message });
  }
});

app.post('/api/stories', async (req, res) => {
  try {
    const story = await storyService.saveStory(req.body);
    res.json(story);
  } catch (error: any) {
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

// 作者相关路由
app.post('/api/authors/register', async (req, res) => {
  try {
    const author = await userService.registerAuthor(req.body);
    res.json(author);
  } catch (error: any) {
    res.status(500).json({ error: error?.message });
  }
});

// 获取作者信息
app.get('/api/authors/:address', async (req, res) => {
  try {
    const { address } = req.params;
    const author = await userService.getAuthorByAddress(address);
    res.json(author);
  } catch (error: any) {
    if (error.message === 'Author not found') {
      res.status(404).json({ error: error.message });
    } else {
      res.status(500).json({ error: error.message });
    }
  }
});


app.post('/api/authors/update', async (req, res) => {
  // 处理更新
})

app.post('/api/authors/verify', async (req, res) => {
  // 处理验证
})

// 关注相关路由
app.get('/api/authors/:address/follows', async (req, res) => {
  try {
    const { address } = req.params;
    const follows = await userService.getAuthorFollows(address);
    res.json(follows);
  } catch (error: any) {
    res.status(500).json({ error: error?.message });
  }
});

app.post('/api/authors/:address/follows', async (req, res) => {
  try {
    const { address } = req.params;
    const { followerAddress } = req.body;
    const follow = await userService.followAuthor(address, followerAddress);
    res.json(follow);
  } catch (error: any) {
    res.status(500).json({ error: error?.message });
  }
});

app.delete('/api/authors/:address/follows', async (req, res) => {
  try {
    const { address } = req.params;
    const { followerAddress } = req.body;
    await userService.unfollowAuthor(address, followerAddress);
    res.json({ success: true });
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