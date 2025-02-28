import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { Chapter } from '@/types/story';

// 确保数据目录存在
async function ensureDir(storyId: string) {
  const dataDir = path.join(process.cwd(), 'data', 'stories', storyId, 'chapters');
  try {
    await fs.mkdir(dataDir, { recursive: true });
    console.log('数据目录已创建或已存在:', dataDir);
    return dataDir;
  } catch (error) {
    console.error('创建数据目录失败:', error);
    throw error;
  }
}

// 获取章节内容
async function getChapter(storyId: string, chapterId: string): Promise<Chapter | null> {
  const dataDir = await ensureDir(storyId);
  const chapterPath = path.join(dataDir, `${chapterId}.json`);
  
  try {
    const content = await fs.readFile(chapterPath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    console.error('读取章节失败:', error);
    return null;
  }
}

// 保存章节内容
async function saveChapter(storyId: string, chapter: Chapter) {
  const dataDir = await ensureDir(storyId);
  const chapterPath = path.join(dataDir, `${chapter.id}.json`);
  await fs.writeFile(chapterPath, JSON.stringify(chapter, null, 2), 'utf-8');
}

// 模拟上传到IPFS
async function uploadToIPFS(content: string): Promise<string> {
  // TODO: 实现真实的IPFS上传
  return `ipfs-${Date.now()}`;
}

// 模拟上传到后台服务器
async function uploadToServer(chapter: Chapter): Promise<string> {
  // TODO: 实现真实的服务器上传
  return `server-${Date.now()}`;
}

// 模拟上链
async function uploadToBlockchain(metadata: any): Promise<string> {
  // TODO: 实现真实的上链操作
  return `tx-${Date.now()}`;
}

// 获取章节
export async function GET(
  request: Request,
  { params }: { params: { id: string; chapterId: string } }
) {
  try {
    const { id: storyId, chapterId } = params;
    const chapter = await getChapter(storyId, chapterId);
    
    if (!chapter) {
      return NextResponse.json(
        { error: '章节不存在' },
        { status: 404 }
      );
    }
    
    return NextResponse.json(chapter);
  } catch (error) {
    console.error('获取章节失败:', error);
    return NextResponse.json(
      { error: '获取章节失败' },
      { status: 500 }
    );
  }
}

// 更新章节
export async function PUT(
  request: Request,
  { params }: { params: { id: string; chapterId: string } }
) {
  try {
    const { id: storyId, chapterId } = params;
    const updates = await request.json();
    
    const chapter = await getChapter(storyId, chapterId);
    if (!chapter) {
      return NextResponse.json(
        { error: '章节不存在' },
        { status: 404 }
      );
    }
    
    // 更新章节
    const updatedChapter = {
      ...chapter,
      ...updates,
      updatedAt: new Date().toISOString()
    };
    
    await saveChapter(storyId, updatedChapter);
    return NextResponse.json(updatedChapter);
  } catch (error) {
    console.error('更新章节失败:', error);
    return NextResponse.json(
      { error: '更新章节失败' },
      { status: 500 }
    );
  }
}

// 发布章节
export async function POST(
  request: Request,
  { params }: { params: { id: string; chapterId: string } }
) {
  try {
    const { id: storyId, chapterId } = params;
    
    // 读取章节内容
    const chapter = await getChapter(storyId, chapterId);
    if (!chapter) {
      return NextResponse.json(
        { error: '章节不存在' },
        { status: 404 }
      );
    }
    
    // 检查章节状态
    if (chapter.status === 'published') {
      return NextResponse.json(
        { error: '章节已发布' },
        { status: 400 }
      );
    }
    
    // 1. 上传到IPFS
    console.log('上传到IPFS...');
    const ipfsCid = await uploadToIPFS(chapter.content);
    
    // 2. 上传到后台服务器
    console.log('上传到后台服务器...');
    const serverId = await uploadToServer(chapter);
    
    // 3. 上传到区块链
    console.log('上传到区块链...');
    const metadata = {
      title: chapter.title,
      ipfsCid,
      serverId,
      wordCount: chapter.wordCount,
      timestamp: Date.now()
    };
    const txHash = await uploadToBlockchain(metadata);
    
    // 4. 更新章节状态
    chapter.status = 'published';
    chapter.contentCid = ipfsCid;
    chapter.publishedData = {
      serverId,
      ipfsCid,
      txHash,
      publishedAt: new Date().toISOString(),
      version: 1
    };
    
    // 5. 保存更新后的章节
    await saveChapter(storyId, chapter);
    
    return NextResponse.json(chapter);
  } catch (error) {
    console.error('发布章节失败:', error);
    return NextResponse.json(
      { error: '发布章节失败' },
      { status: 500 }
    );
  }
}

// 删除章节
export async function DELETE(
  request: Request,
  { params }: { params: { id: string; chapterId: string } }
) {
  try {
    const { id: storyId, chapterId } = params;
    const dataDir = await ensureDir(storyId);
    const chapterPath = path.join(dataDir, `${chapterId}.json`);
    
    try {
      await fs.unlink(chapterPath);
      return NextResponse.json({ success: true });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return NextResponse.json(
          { error: '章节不存在' },
          { status: 404 }
        );
      }
      throw error;
    }
  } catch (error) {
    console.error('删除章节失败:', error);
    return NextResponse.json(
      { error: '删除章节失败' },
      { status: 500 }
    );
  }
}
