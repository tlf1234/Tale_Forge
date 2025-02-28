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

app.post('/api/users', async (req, res) => {
  try {
    const user = await userService.getOrCreateUser(req.body.address);
    res.json(user);
  } catch (error: any) {
    res.status(500).json({ error: error?.message });
  }
});

app.put('/api/users/:address', async (req, res) => {
  try {
    const { address } = req.params;
    const user = await userService.updateUser(address, req.body);
    res.json(user);
  } catch (error: any) {
    res.status(500).json({ error: error?.message });
  }
});

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

const port = process.env.PORT || 3001;
app.listen(port, () => {
  console.log(`Backend service running on port ${port}`);
}); 