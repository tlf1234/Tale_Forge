import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { Chapter } from '@/types/story';


// 获取章节列表
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id: storyId } = params;
    const chapters = await getChapterList(storyId);
    return NextResponse.json(chapters);
  } catch (error) {
    console.error('获取章节列表失败:', error);
    return NextResponse.json(
      { error: '获取章节列表失败' },
      { status: 500 }
    );
  }
}

// 创建新章节
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id: storyId } = params;
    const chapterData = await request.json();
    
    const chapter = await createChapter(storyId, chapterData);
    return NextResponse.json(chapter);
  } catch (error) {
    console.error('创建章节失败:', error);
    return NextResponse.json(
      { error: '创建章节失败' },
      { status: 500 }
    );
  }
}



// 确保数据目录存在
async function ensureDir(storyId: string) {
  const dataDir = path.join(process.cwd(), 'data', 'stories', storyId, 'chapters');
  try {
    await fs.mkdir(dataDir, { recursive: true });
    return dataDir;
  } catch (error) {
    console.error('创建数据目录失败:', error);
    throw error;
  }
}

// 获取章节列表
async function getChapterList(storyId: string): Promise<Chapter[]> {
  const dataDir = await ensureDir(storyId);
  const indexPath = path.join(dataDir, 'index.json');
  
  try {
    // 首先尝试从索引文件读取
    const content = await fs.readFile(indexPath, 'utf-8');
    const chapters = JSON.parse(content) as Chapter[];
    
    // 确保所有章节都有必要的字段
    chapters.forEach((chapter, index) => {
      if (!chapter.order) {
        chapter.order = index + 1;
      }
      if (!chapter.status) {
        chapter.status = 'draft';
      }
    });
    
    // 按order排序
    return chapters.sort((a, b) => a.order - b.order);
  } catch (error) {
    // 如果索引文件不存在，扫描目录获取所有章节
    try {
      const files = await fs.readdir(dataDir);
      const chapterFiles = files.filter(file => file.endsWith('.json') && file !== 'index.json');
      
      // 读取所有章节文件
      const chapters = await Promise.all(
        chapterFiles.map(async (file): Promise<Chapter> => {
          const filePath = path.join(dataDir, file);
          const content = await fs.readFile(filePath, 'utf-8');
          const chapter = JSON.parse(content);
          return chapter;
        })
      );
      
      // 确保所有章节都有必要的字段
      chapters.forEach((chapter, index) => {
        if (!chapter.order) {
          chapter.order = index + 1;
        }
        if (!chapter.status) {
          chapter.status = 'draft';
        }
      });
      
      // 按order排序
      const sortedChapters = chapters.sort((a, b) => a.order - b.order);
      
      // 保存到索引文件
      await saveChapterList(storyId, sortedChapters);
      
      return sortedChapters;
    } catch (error) {
      console.error('扫描目录失败:', error);
      return [];
    }
  }
}

// 保存章节列表
async function saveChapterList(storyId: string, chapters: Chapter[]) {
  const dataDir = await ensureDir(storyId);
  const indexPath = path.join(dataDir, 'index.json');
  await fs.writeFile(indexPath, JSON.stringify(chapters, null, 2), 'utf-8');
}

// 创建新章节
async function createChapter(storyId: string, chapter: Partial<Chapter>): Promise<Chapter> {
  const chapters = await getChapterList(storyId);
  
  // 生成新章节的顺序号
  const maxOrder = chapters.reduce((max, ch) => Math.max(max, ch.order || 0), 0);
  
  const newChapter: Chapter = {
    id: `${Date.now()}`,
    title: chapter.title || '新章节',
    content: chapter.content || '',
    wordCount: chapter.content ? chapter.content.replace(/<[^>]*>/g, '').replace(/\s+/g, '').length : 0,
    order: chapter.order || maxOrder + 1,
    status: chapter.status || 'draft',
    isVip: chapter.isVip || false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  
  // 保存新章节
  const dataDir = await ensureDir(storyId);
  const chapterPath = path.join(dataDir, `${newChapter.id}.json`);
  await fs.writeFile(chapterPath, JSON.stringify(newChapter, null, 2), 'utf-8');
  
  // 更新章节列表
  chapters.push(newChapter);
  await saveChapterList(storyId, chapters);
  
  return newChapter;
}


