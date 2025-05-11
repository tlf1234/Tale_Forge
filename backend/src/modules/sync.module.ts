import { Module, OnModuleInit } from '@nestjs/common';
import { syncService } from '../services/sync.service';


//两个地方设置了定时任务，一个是备份，一个是互动数据上链。
@Module({
  providers: [
    {
      provide: 'SYNC_SERVICE',
      useValue: syncService
    }
  ],
  exports: [
    'SYNC_SERVICE'
  ]
})
export class SyncModule implements OnModuleInit {
  onModuleInit() {
    // 启动定时上链任务
    this.startInteractionSyncTask();
  }

  private async startInteractionSyncTask() {
    try {
      console.log('[SyncModule] 启动互动数据同步定时任务');
      await syncService.scheduleInteractionUploads();
    } catch (error) {
      console.error('[SyncModule] 启动互动数据同步定时任务失败:', error);
    }
  }
} 