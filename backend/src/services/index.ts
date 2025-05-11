export * from './story.service'
export * from './user.service'
export * from './comment.service'
export * from './sync.service'
export * from './image.service'
export * from './nft.service'

// 创建服务实例
import { StoryService } from './story.service'
import { UserService } from './user.service'
import { CommentService } from './comment.service'
import { SyncService } from './sync.service'
import { NftService } from './nft.service'
import { AIService } from './ai.service'
import { ImageService } from './image.service'
import { rankingService } from './ranking.service'

const storyService = new StoryService()
const userService = new UserService()
const commentService = new CommentService()
const syncService = new SyncService()
const nftService = new NftService()
const aiService = new AIService()
const imageService = new ImageService()

// 导出服务实例
export {
  storyService,
  userService,
  commentService,
  syncService,
  nftService,
  aiService,
  imageService,
  rankingService
}
