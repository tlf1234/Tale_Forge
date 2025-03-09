'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import dynamic from 'next/dynamic'
import { useRouter, usePathname } from 'next/navigation'
import Image from 'next/image'
import { 
  FaPen, 
  FaSave, 
  FaList, 
  FaCog, 
  FaUpload, 
  FaEye, 
  FaImage, 
  FaSitemap, 
  FaTrash, 
  FaEyeSlash,
  FaTimes,
  FaCamera,
  FaSort,
  FaPlus,
  FaWallet,
  FaBook,
  FaMoneyBill,
  FaInfoCircle,
  FaCheck,
  FaHeading
} from 'react-icons/fa'
import { toast } from 'react-hot-toast'
import { Eye as EyeIcon, EyeOff as EyeOffIcon, FileText, BarChart2 } from 'lucide-react'
import WalletRequired from '@/components/web3/WalletRequired'
import ImageCropper from '@/components/ImageCropper'
import styles from './page.module.css'
import Button from '@/components/ui/button'
import { useAccount } from 'wagmi'
import { ethers } from 'ethers'

import { CONTRACT_ADDRESSES,CONTRACT_ABIS } from '@/constants/contracts'

// 定义IconButton的类型
interface IconButtonProps {
  icon: React.ReactNode;
  onClick: () => void;
  className?: string;
  [key: string]: any;
}
// 修改 Editor 组件的类型定义
interface EditorProps {
  key?: string;
  initialContent?: string | null;
  onChange: (content: string) => void;
  editable: boolean;
  className?: string;
  placeholder?: string;
  onSave?: () => void;
}
// 大纲类型
interface Outline {
  id: string;
  title: string;
  description: string;
  chapterId: string;
}

// 卷类型
interface Volume {
  id: string;
  title: string;
  description: string;
  order: number;
}

// 扩展章节类型
interface Chapter {
  id: string;
  title: string;
  content: string;
  order: number;
  volumeId?: string;
  wordCount: number;
  status: 'draft' | 'pending' | 'published';
  price?: number;
  publishTime?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// 写作统计类型
interface WritingStats {
  totalWordCount: number;
  todayWordCount: number;
  averageSpeed: number; // words per minute
  writingDuration: number; // minutes
  lastSaved: Date;
}

// 作品类型
interface Story {
  id: string;
  title: string;
  category: string;
  wordCount: number;
  targetWordCount: number;
  chapterCount?: number;
}




// 修改IconButton的类型和实现
const IconButton: React.FC<IconButtonProps> = ({ icon, onClick, className = '', ...props }) => (
  <button
    onClick={onClick}
    className={`${styles.iconButton} ${className}`}
    {...props}
  >
    {icon}
  </button>
)

// 修改Input组件
const Input: React.FC<React.InputHTMLAttributes<HTMLInputElement>> = (props) => (
  <input {...props} className={styles.input} />
)

// 修改Textarea组件
const Textarea: React.FC<React.TextareaHTMLAttributes<HTMLTextAreaElement>> = (props) => (
  <textarea {...props} className={styles.textarea} />
)

// 修改 Editor 组件的导入
const Editor = dynamic<EditorProps>(
  () => import('@/components/editor/TiptapEditor').then(mod => mod.default as any), 
  {
    ssr: false,
    loading: () => <div className={styles.editorLoading}>加载编辑器...</div>
  }
);

// 作品类型选项
const STORY_TYPES = [
  { id: 'fantasy', name: '玄幻' },
  { id: 'scifi', name: '科幻' },
  { id: 'wuxia', name: '武侠' },
  { id: 'urban', name: '都市' },
  { id: 'romance', name: '言情' },
  { id: 'mystery', name: '悬疑' }
]

// 标签选项
const STORY_TAGS = [
  { id: 'action', name: '动作' },
  { id: 'adventure', name: '冒险' },
  { id: 'comedy', name: '喜剧' },
  { id: 'drama', name: '剧情' },
  { id: 'horror', name: '恐怖' },
  { id: 'romance', name: '爱情' },
]

// 添加创建状态类型
const enum CreateStatus {
  IDLE = 'IDLE',
  UPLOADING = 'UPLOADING',
  CREATING_CONTRACT = 'CREATING_CONTRACT',
  SAVING_DATABASE = 'SAVING_DATABASE',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED'
}

// 错误提示组件
const ErrorDialog = ({ message, onClose }: { message: string; onClose: () => void }) => (
  <div className={styles.modal}>
    <div className={styles.modalContent}>
      <div className={styles.modalHeader}>
        <h2 className={styles.modalTitle}>创建失败</h2>
        <button 
          onClick={onClose}
          className={styles.closeButton}
        >
          ×
        </button>
      </div>
      <div className={styles.modalText}>
        {message}
      </div>
      <div className={styles.modalFooter}>
        <button
          onClick={onClose}
          className={`${styles.button} ${styles.cancelButton}`}
        >
          知道了
        </button>
      </div>
    </div>
  </div>
);

// 提示弹窗组件
const TipDialog = ({ message, onClose }: { message: string; onClose: () => void }) => (
  <div className={styles.modal}>
    <div className={styles.modalContent}>
      <div className={styles.modalHeader}>
        <h2 className={styles.modalTitle}>提示</h2>
        <button 
          className={styles.closeButton}
          onClick={onClose}
        >
          ×
        </button>
      </div>
      <div className={styles.modalText}>{message}</div>
      <div className={styles.modalFooter}>
        <button
          className={`${styles.button} ${styles.cancelButton}`}
          onClick={onClose}
        >
          知道了
        </button>
      </div>
    </div>
  </div>
);

// 作者写作页面
export default function AuthorWrite() {
  const router = useRouter()
  const pathname = usePathname()
  const { address } = useAccount()
  

  // 作品信息状态
  const [storyInfo, setStoryInfo] = useState({
    title: '',
    type: '',
    description: '',
    tags: [] as string[],
    coverImage: '',
    isSerial: true, // 是否连载
    price: 0, // 定价
    isFree: true, // 是否免费
    targetWordCount: 100000, // 目标字数，设置默认值
  })

  // 作品状态
  const [currentStory, setCurrentStory] = useState<Story | null>(null)
  const [showStorySelector, setShowStorySelector] = useState(false)
  const [stories, setStories] = useState<Story[]>([])
  const [isLoadingStories, setIsLoadingStories] = useState(false)
  const [message, setMessage] = useState('')

  
  
  // 章节管理
  const [chapters, setChapters] = useState<Chapter[]>([])
  const [currentChapter, setCurrentChapter] = useState<Chapter | null>(null)
  // 章节加载状态
  const [isChapterLoading, setIsChapterLoading] = useState(true);

  // 简化的状态管理
  const [content, setContent] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [currentChapterId, setCurrentChapterId] = useState<string | null>(null)
  const [hasContentChanged, setHasContentChanged] = useState(false) // 添加内容变更标记
  
  // 界面状态
  const [showSettings, setShowSettings] = useState(false)
  const [showChapters, setShowChapters] = useState(false)
  const [showStatsDialog, setShowStatsDialog] = useState(false)
  const [isPreview, setIsPreview] = useState(false)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout>()
  
  // 文件上传相关
  const coverInputRef = useRef<HTMLInputElement>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)

  // 大纲管理
  const [outlines, setOutlines] = useState<Outline[]>([])
  const [showOutlineDialog, setShowOutlineDialog] = useState(false)
  
  // 卷管理
  const [volumes, setVolumes] = useState<Volume[]>([])
  
  // 写作统计
  const [wordCountGoal, setWordCountGoal] = useState(0);
  const [writingStartTime, setWritingStartTime] = useState<Date | null>(null);
  const [totalWritingTime, setTotalWritingTime] = useState(0);
  const [writingStats, setWritingStats] = useState<WritingStats>({
    totalWordCount: 0,
    todayWordCount: 0,
    averageSpeed: 0,
    writingDuration: 0,
    lastSaved: new Date()
  })

  // 在顶部添加新的状态
  const [lastSavedContent, setLastSavedContent] = useState('');
  const [lastSavedTitle, setLastSavedTitle] = useState('');



  // 添加编辑状态管理
  const [editingChapterId, setEditingChapterId] = useState<string | null>(null);

  // 在组件顶部添加新的状态
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [chapterToDelete, setChapterToDelete] = useState<string | null>(null);

  // 在状态管理部分添加新的状态
  const [showCreateConfirm, setShowCreateConfirm] = useState(false)
  const [isCreating, setIsCreating] = useState(false)

  // 添加错误提示状态
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // 在状态管理部分添加新的状态
  const [showCoverCropper, setShowCoverCropper] = useState(false);
  const [selectedCoverFile, setSelectedCoverFile] = useState<File | null>(null);

  // 在状态管理部分添加新的状态
  const [showTipDialog, setShowTipDialog] = useState(false);

  // 在状态管理部分添加新的状态
  const [createStatus, setCreateStatus] = useState<CreateStatus | null>(null)
  const [createProgress, setCreateProgress] = useState(0)

  // 在状态定义部分添加新的状态
  const [showCreateChapterDialog, setShowCreateChapterDialog] = useState(false);
  const [newChapterTitle, setNewChapterTitle] = useState('');

  // 错误提示函数
  const showError = (error: unknown, defaultMessage: string) => {
    console.error(error);
    let message = defaultMessage;
    if (error instanceof Error) {
      message = error.message;
    } else if (typeof error === 'string') {
      message = error;
    }
    // 使用toast显示错误，而不是设置errorMessage
    toast.error(message);
  };

  // 成功提示函数
  const showSuccess = (message: string) => {
    toast.success(message);
  };

  // 修改确认对话框函数
  const showConfirm = (message: string): boolean => {
    return window.confirm(message);
  };

  // 修改提示函数
  const showNoStoryTip = () => {
    setShowTipDialog(true);
  };


  // 切换作品创建面板
  const toggleSettings = () => {
    setShowSettings(prev => !prev);
    setShowChapters(false);
  };

  // 切换章节管理面板
  const toggleChapters = () => {
    setShowChapters(prev => !prev);
    setShowSettings(false);
  };

  
  /**
   * 作品创建及加载相关 
   * 
  */
  // 修改加载时机
  useEffect(() => {
    // 清理错误消息
    setErrorMessage(null);
    console.log('检查钱包地址:', address)
    if (address) {
      console.log('准备加载作品列表...')
      loadStories()
    } else {
      console.log('未连接钱包')
    }
  }, [address]) // 确保依赖项包含 address
  
  
  // 加载作品列表
  const loadStories = async () => {
    try {
      setIsLoadingStories(true)
      
      // 检查钱包地址
      if (!address) {
        console.log('未找到钱包地址，跳过加载作品列表')
        return
      }
      
      console.log('开始加载作品列表，作者地址:', address)
      const response = await fetch(`/api/authors/${address}/stories`)
      
      if (!response.ok) {
        const errorData = await response.json()
        console.error('API错误响应:', errorData)
        throw new Error(errorData.error || '加载作品列表失败')
      }
      
      const data = await response.json()
      console.log('成功加载作品列表:', data)

      // 显示同步状态或错误信息
      if (data.message) {
        setMessage(data.message)
      } else if (data.error) {
        setMessage(data.error)
      } else {
        setMessage('')
      }
      
      // 如果有作品列表则显示
      if (data.stories.length > 0) {
        setStories(data.stories)
      } else {
        setStories([])
        if (!data.message && !data.error) {
          setMessage('暂无作品')
        }
      }
    } catch (error) {
      console.error('加载作品列表失败:', error)
      showError(error, '加载作品列表失败')
      setStories([]) // 设置空数组确保界面正常显示
    } finally {
      setIsLoadingStories(false)
    }
  }

  // 选择作品
  const handleStorySelect = async (story: Story) => {
    try {
      // 如果有未保存的更改,提示用户
      if (hasUnsavedChanges) {
        const confirm = window.confirm('当前章节有未保存的更改,切换作品将丢失这些更改,是否继续?')
        if (!confirm) return
      }
      
      setCurrentStory(story)
      localStorage.setItem('currentStoryId', story.id)
      setShowStorySelector(false)
      
      // 重置编辑器状态
      setContent('')
      setCurrentChapterId(null)
      setHasUnsavedChanges(false)
      
      // 加载新作品的章节列表
      await loadChapterList()
    } catch (error) {
      showError(error, '切换作品失败')
    }
  }

  /**作品创建 */
  // 创建作品
  const handleCreateStory = async () => {
    try {
      // 验证必填字段
      const validationErrors = [];
      if (!storyInfo.title.trim()) {
        validationErrors.push('作品标题不能为空');
      }
      if (!storyInfo.type) {
        validationErrors.push('请选择作品类型');
      }
      if (!storyInfo.description.trim()) {
        validationErrors.push('作品简介不能为空');
      }
      if (!storyInfo.targetWordCount || storyInfo.targetWordCount < 100000) {
        validationErrors.push('目标字数不能少于10万字。原因：较低的目标字数可能影响作品质量评估和NFT价值，同时不利于读者对作品完整度的判断。');
      }
      if (!storyInfo.isFree && (!storyInfo.price || storyInfo.price <= 0)) {
        validationErrors.push('付费作品必须设置价格');
      }

      // 如果有验证错误，显示错误信息并返回
      if (validationErrors.length > 0) {
        showError(validationErrors.join('\n\n'), '创建失败');
        return;
      }

      setShowCreateConfirm(true);
    } catch (error) {
      showError(error, '创建作品失败');
    }
  }

  // 修改handleConfirmCreate函数
  const handleConfirmCreate = async () => {
    try {
      // 验证必填字段
      const validationErrors = [];
      if (!storyInfo.title.trim()) {
        validationErrors.push('作品标题不能为空');
      }
      if (!storyInfo.type) {
        validationErrors.push('请选择作品类型');
      }
      if (!storyInfo.description.trim()) {
        validationErrors.push('作品简介不能为空');
      }
      if (!storyInfo.targetWordCount || storyInfo.targetWordCount < 100000) {
        validationErrors.push('目标字数不能少于10万字。原因：较低的目标字数可能影响作品质量评估和NFT价值，同时不利于读者对作品完整度的判断。');
      }
      if (!storyInfo.isFree && (!storyInfo.price || storyInfo.price <= 0)) {
        validationErrors.push('付费作品必须设置价格');
      }

      if (validationErrors.length > 0) {
        showError(validationErrors.join('\n\n'), '请完善作品信息');
        return;
      }

      // 检查钱包连接
      if (!address) {
        showError('请先连接钱包', '钱包未连接');
        return;
      }

      setIsCreating(true);
      setCreateProgress(0);

      // 第一步：上传内容到IPFS
      setCreateStatus(CreateStatus.UPLOADING);
      setCreateProgress(20);
      
      console.log('开始上传内容到IPFS...');
      const ipfsResponse = await fetch('/api/stories/upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: storyInfo.title,
          description: storyInfo.description,
          content: content,
          coverImage: storyInfo.coverImage,
          authorAddress: address,
          category: storyInfo.type,
          tags: storyInfo.tags
        })
      });

      let ipfsData;
      try {
        ipfsData = await ipfsResponse.json();
      } catch (error) {
        console.error('解析API响应失败:', error);
        throw new Error('内容上传失败: 无法解析服务器响应');
      }

      if (!ipfsData.success) {
        console.error('上传失败:', ipfsData);
        throw new Error(ipfsData.message || '内容上传失败');
      }

      if (!ipfsData.contentCid || !ipfsData.coverCid) {
        console.error('API响应格式错误:', ipfsData);
        throw new Error('内容上传失败: 服务器返回的数据格式不正确');
      }

      console.log('IPFS上传成功:', ipfsData);

      // 准备智能合约调用参数
      const { contentCid, coverCid } = ipfsData;
      if (!contentCid || !coverCid) {
        throw new Error('IPFS上传返回的CID无效');
      }

      // 调用智能合约创建故事
      console.log('开始调用智能合约创建故事...');
      try {
        // 确保已连接钱包
        if (!window.ethereum) {
          throw new Error('未检测到钱包');
        }

        const provider = new ethers.providers.Web3Provider(window.ethereum);
        const signer = provider.getSigner();
        
        // 创建合约实例
        const storyManagerContract = new ethers.Contract(
          CONTRACT_ADDRESSES.StoryManager,
          CONTRACT_ABIS.StoryManager,
          signer
        );

        const tx = await storyManagerContract.createStory(
          storyInfo.title,
          storyInfo.description,
          coverCid,
          contentCid,
          storyInfo.targetWordCount
        );
        
        console.log('等待交易确认...');
        const receipt = await tx.wait();
        console.log('故事创建成功！交易收据:', receipt);

        // 保存到数据库
        console.log('开始保存到数据库，发送数据:', {
          title: storyInfo.title,
          description: storyInfo.description,
          content: content,
          coverImage: storyInfo.coverImage,
          authorAddress: address,
          contentCid,
          coverCid,
          category: storyInfo.type,
          tags: storyInfo.tags,
          targetWordCount: storyInfo.targetWordCount
        });

        const saveResponse = await fetch('/api/stories/save', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            title: storyInfo.title,
            description: storyInfo.description,
            content: content,
            coverImage: storyInfo.coverImage,
            authorAddress: address,
            contentCid,
            coverCid,
            category: storyInfo.type,
            tags: storyInfo.tags,
            targetWordCount: storyInfo.targetWordCount
          })
        });

        let saveData;
        try {
          saveData = await saveResponse.json();
          console.log('数据库保存响应:', saveData);
          
          if (!saveResponse.ok) {
            console.error('保存失败，HTTP状态:', saveResponse.status);
            throw new Error(saveData.message || '保存失败');
          }

          if (saveData.success) {
            setCreateStatus(CreateStatus.COMPLETED);
            setCreateProgress(100);
            
            // 显示成功提示
            toast.success('作品创建成功！');
            
            // 关闭弹窗
            setShowCreateConfirm(false);
            
            // 跳转到作品详情页
            router.push(`/author/stories/${saveData.data.id}`);
          }
        } catch (error: unknown) {
          console.error('保存到数据库失败:', error);
          throw new Error(typeof error === 'object' && error && 'message' in error ? (error.message as string) : '保存失败');
        }

        const story = saveData.data;
        console.log('保存到数据库成功:', story);
        
        return story;
      } catch (error) {
        console.error('创建故事失败:', error);
        throw error;
      }

    } catch (error: any) {
      console.error('创建作品失败:', error);
      showError(error, error.message || '创建作品失败，请稍后重试');
      setCreateStatus(null);
    } finally {
      setIsCreating(false);
    }
  };

  // 添加封面处理函数
  const handleCoverSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        if (e.target?.result) {
          setSelectedCoverFile(file);
          setShowCoverCropper(true);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  // 添加封面裁剪处理函数
  const handleCropComplete = async (croppedImage: string) => {
    try {
      // 直接使用裁剪后的base64图片URL
      handleInfoChange('coverImage', croppedImage);
      setShowCoverCropper(false);
      setSelectedCoverFile(null);
      showSuccess('封面上传成功');
    } catch (error) {
      showError(error, '封面上传失败');
    }
  };

  // 处理作品信息更新
  const handleInfoChange = (field: keyof typeof storyInfo, value: any) => {
    setStoryInfo(prev => ({
      ...prev,
      [field]: value
    }));
  };


  /**章节列表创建及加载相关
   * 对于章节我们是直接加载已经发布的，而不是本地编辑，因为我们主要的目的是发布作品。
   * 并不是以写作为主的在线工具软件。要先明白这一原则，不要开发走偏了。
   * 增加一个文件加载显示功能，以方便作者用其它写作软件写好文章后直接加载进来，方便发布。
  */


  // 添加章节的处理函数
  const handleAddChapter = async (volumeId?: string) => {
    // 显示创建章节对话框
    setNewChapterTitle(`第${chapters.length + 1}章  `); // 在章节标题后添加两个空格
    setShowCreateChapterDialog(true);
  };

  // 添加确认创建章节的函数
  const handleConfirmAddChapter = async () => {
    try {
      console.log('开始创建新章节...');
      const storyId = localStorage.getItem('currentStoryId');
      if (!storyId) {
        throw new Error('未找到当前故事，请先选择或创建故事');
      }

      if (!newChapterTitle.trim()) {
        toast.error('章节标题不能为空');
        return;
      }

      // 先关闭对话框，避免操作延迟
      setShowCreateChapterDialog(false);
      
      // 创建章节，这个创建章节实际是在数据库中创建一个章节，
      // 并不是上链和上分布式存储，只有进行发布时才会把章节元数据和内容才会发布到相关链上和分布式存储。
      const response = await fetch(`/api/stories/${storyId}/chapters`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: newChapterTitle,
          content: '',
          order: chapters.length + 1
        }),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || '创建章节失败');
      }
      
      const newChapter = await response.json();
      console.log('创建新章节成功:', newChapter);
      
      // 立即更新章节列表
      const updatedChapters = await updateChapterList();
      if (updatedChapters) {
        toast.success('创建章节成功');
      }else{
        toast.error('创建章节失败');
      }

      // 重置标题
      setNewChapterTitle('');
    } catch (error) {
      console.error('创建章节失败:', error);
      toast.error(error instanceof Error ? error.message : '创建章节失败，请稍后重试');
    }
  };

  // 添加取消创建章节的函数
  const handleCancelAddChapter = () => {
    setShowCreateChapterDialog(false);
    setNewChapterTitle('');
  };

 
  // 加载章节列表的函数
  const loadChapterList = async () => {
    try {
      setIsChapterLoading(true);
      console.log('开始加载章节列表...');
      
      const storyId = localStorage.getItem('currentStoryId');
      if (!storyId) {
        console.log('未找到当前故事ID，跳过加载章节');
        setIsChapterLoading(false);
        return;
      }
      console.log('当前故事ID:', storyId);
      const response = await fetch(`/api/stories/${storyId}/chapters`);//
      if (!response.ok) {
        throw new Error('获取章节列表失败');
      }

      const data = await response.json();
      console.log('获取到章节列表:', data);
      
      const sortedChapters = data.sort((a: Chapter, b: Chapter) => a.order - b.order);
      setChapters(sortedChapters);

      if (sortedChapters.length === 0) {
        console.log('没有找到章节，等待用户创建...');
        // 不自动创建章节，等待用户手动创建
        setContent('');
        setCurrentChapterId(null);
        setCurrentChapter(null);
        showSuccess('请点击"+ 新建"按钮创建第一个章节');
      } else {
        console.log('找到现有章节，加载第一个章节...');
        // 确保第一个章节存在且有 id
        if (sortedChapters[0] && sortedChapters[0].id) {
          await loadChapter(sortedChapters[0].id);
        } else {
          console.error('章节数据无效:', sortedChapters[0]);
          throw new Error('章节数据无效');
        }
      }
    } catch (error: any) {
      console.error('加载章节列表失败:', error);
      showError(error, '加载章节列表失败，请稍后重试');
      // 设置一个空的章节列表
      setChapters([]);
      setContent('');
      setCurrentChapterId(null);
      setCurrentChapter(null);
    } finally {
      setIsChapterLoading(false);
    }
  };

  // 加载章节内容
  const loadChapter = async (chapterId: string) => {
    try {
      const storyId = localStorage.getItem('currentStoryId');
      if (!storyId) {
        throw new Error('未找到当前故事');
      }
      
      const response = await fetch(`/api/stories/${storyId}/chapters/${chapterId}`);
      if (!response.ok) {
        throw new Error('加载章节失败');
      }
      const chapter = await response.json();
      setCurrentChapter(chapter);
      setContent(chapter.content);
      setLastSavedContent(chapter.content);
      setCurrentChapterId(chapter.id);
      setHasUnsavedChanges(false);
      return chapter;
    } catch (error) {
      showError(error, '加载章节失败');
      return null;
    }
  };

  // 章节排序和统计函数
  const processChapters = useCallback((chapterList: Chapter[]) => {
    // 按顺序排序
    const sortedChapters = [...chapterList].sort((a, b) => a.order - b.order);
    
    // 计算总字数
    let totalWords = 0;
    let todayWords = 0;
    const today = new Date().setHours(0, 0, 0, 0);

    sortedChapters.forEach(chapter => {
      // 计算章节字数
      const content = chapter.content || '';
      const wordCount = content.replace(/<[^>]*>/g, '') // 移除 HTML 标签
        .replace(/[\u200B-\u200D\uFEFF]/g, '') // 移除零宽字符
        .trim() // 移除首尾空格
        .replace(/\s+/g, ' ') // 将多个空格替换为单个空格
        .split(/\s+/).length; // 按空格分割并计数
      
      // 更新章节字数
      chapter.wordCount = wordCount;
      totalWords += wordCount;

      // 计算今日字数
      const updateTime = new Date(chapter.updatedAt).setHours(0, 0, 0, 0);
      if (updateTime === today) {
        todayWords += wordCount;
      }
    });

    // 更新写作统计
    setWritingStats(prev => ({
      ...prev,
      totalWordCount: totalWords,
      todayWordCount: todayWords
    }));

    return sortedChapters;
  }, []);

  // 保存章节的函数。。。这里有问题
  const handleSave = useCallback(async (): Promise<boolean> => {
    if (!currentChapterId || isSaving) return false;
    
    setIsSaving(true);
    try {
      //这个路径有问题。
      const saveResponse = await fetch(`/api/chapters/${currentChapterId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: content,
          title: currentChapter?.title,
          outlines,
        }),
      });

      if (!saveResponse.ok) {
        const error = await saveResponse.json();
        throw new Error(error.error || '保存失败');
      }

      const savedChapter = await saveResponse.json();
      
      setCurrentChapter(savedChapter);
      setChapters(chapters.map(ch => 
        ch.id === savedChapter.id ? savedChapter : ch
      ));
      
      setLastSavedContent(content);
      setHasUnsavedChanges(false);
      
      localStorage.removeItem(`draft_${currentChapterId}`);
      showSuccess('保存成功');
      return true;
    } catch (error) {
      showError(error, '保存失败，请稍后重试');
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [currentChapterId, isSaving, content, chapters, currentChapter, outlines]);

  // 更新章节列表函数
  const updateChapterList = async () => {
    const storyId = localStorage.getItem('currentStoryId');
    if (!storyId) return null;
    
    try {
      const response = await fetch(`/api/stories/${storyId}/chapters`);
      if (!response.ok) {
        throw new Error('获取章节列表失败');
      }
      const updatedChapters = await response.json();
      const sortedChapters = updatedChapters.sort((a: Chapter, b: Chapter) => a.order - b.order);
      setChapters(sortedChapters);
      return sortedChapters;
    } catch (error) {
      showError(error, '获取章节列表失败');
      return null;
    }
  };



  // 修改章节更新函数
  const handleChapterUpdate = (chapterId: string, field: keyof Chapter, value: any) => {
    setChapters(chapters.map(ch => 
      ch.id === chapterId ? { ...ch, [field]: value } : ch
    ))
  }

  // 处理确认删除章节
  const handleConfirmDelete = async () => {
    if (!chapterToDelete) return;
    
    try {
      const storyId = localStorage.getItem('currentStoryId');
      if (!storyId) {
        throw new Error('未找到当前故事');
      }
      
      // 使用 API 客户端删除章节
      const response = await fetch(`/api/stories/${storyId}/chapters/${chapterToDelete}`, {
        method: 'DELETE'
      });
      
      if (!response.ok) {
        throw new Error('删除失败');
      }
      
      // 如果删除的是当前章节，清空编辑器
      if (currentChapter?.id === chapterToDelete) {
        setContent('');
        setCurrentChapter(null);
      }
      
      // 更新章节列表
      await updateChapterList();
      
      // 关闭对话框
      setShowDeleteDialog(false);
      setChapterToDelete(null);
      
      showSuccess('删除成功');
    } catch (error) {
      showError(error, '删除失败');
    }
  };

  // 添加字数计算函数
  const calculateWordCount = (content: string): number => {
    if (!content) return 0;
    // 移除HTML标签和空白字符，保留纯文本内容
    const plainText = content.replace(/<[^>]*>/g, '').replace(/\s+/g, '');
    return plainText.length;
  };


// 处理编辑章节按钮点击
const handleEditClick = (e: React.MouseEvent, chapterId: string) => {
  e.stopPropagation();
  setEditingChapterId(chapterId);
}

// 处理章节保存按钮点击
const handleSaveClick = async (e: React.MouseEvent, chapterId: string) => {
  e.stopPropagation();
  setEditingChapterId(null);
  
  try {
    const storyId = localStorage.getItem('currentStoryId');
    if (!storyId) {
      throw new Error('未找到当前故事');
    }

    // 获取当前章节
    const currentChapter = chapters.find(ch => ch.id === chapterId);
    if (!currentChapter) {
      throw new Error('未找到当前章节');
    }

    // 使用 API 客户端保存章节草稿
    const response = await fetch(`/api/stories/${storyId}/chapters/${chapterId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        content,
        title: currentChapter.title
      })
    });

    if (!response.ok) {
      throw new Error('保存失败');
    }

    const savedChapter = await response.json();
    setLastSavedContent(content);
    setHasUnsavedChanges(false);
    showSuccess('保存成功');
    
    // 更新章节列表
    await updateChapterList();
  } catch (error) {
    showError(error, '保存失败');
  }
};

// 处理章节发布按钮点击
const handlePublishChapter = async (chapterId: string) => {
  if (!address) {
    toast.error('请先连接钱包');
    return;
  }

  try {
    // 先保存最新内容
    await handleSaveClick({ stopPropagation: () => {} } as React.MouseEvent, chapterId);

    const storyId = localStorage.getItem('currentStoryId');
    if (!storyId) {
      throw new Error('未找到当前故事');
    }

    // 使用 API 客户端发布章节
    const response = await fetch(`/api/stories/${storyId}/chapters/${chapterId}/publish`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        authorAddress: address
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || '发布失败');
    }

    const publishedChapter = await response.json();
    showSuccess('章节已发布到区块链');
    
    // 更新章节列表
    await updateChapterList();
  } catch (error) {
    showError(error, '发布章节失败');
  }
};

// 处理删除章节按钮点击
const handleDeleteClick = (e: React.MouseEvent, chapterId: string) => {
  e.stopPropagation();
  setChapterToDelete(chapterId);
  setShowDeleteDialog(true);
};






// 添加故事大纲
const addOutline = (title: string, description: string) => {
  if (!currentChapter) return
  
  const newOutline: Outline = {
    id: Date.now().toString(),
    title,
    description,
    chapterId: currentChapter.id
  }
  
  setOutlines([...outlines, newOutline])
  setShowOutlineDialog(false)
}

  // 处理卷添加
  // const handleAddVolume = () => {
  //   const newVolume: Volume = {
  //     id: Date.now().toString(),
  //     title: `第${volumes.length + 1}卷`,
  //     description: '',
  //     order: volumes.length + 1,
  //   };
  //   setVolumes([...volumes, newVolume]);
  // };

  

  /**
   * 编辑框工具栏
   *  
  */

  // 编辑框工具栏
  const renderToolbar = () => (
  <div className={styles.toolbar}>
  <div className={styles.toolbarLeft}>
    <button
      className={`${styles.iconButton} ${showChapters ? styles.active : ''}`}
      onClick={toggleChapters}
      title="章节管理"
    >
      <FaList />
    </button>
    <button
      className={`${styles.iconButton} ${showSettings ? styles.active : ''}`}
      onClick={toggleSettings}
      title="作品创建"
    >
      <FaPlus />
    </button>
  </div>

  <div className={styles.toolbarCenter}>
    <div className={styles.writingStats}>
      <span>写作时长: {formatTime(totalWritingTime)}</span>
      <span>目标字数: {wordCountGoal}</span>
    </div>
  </div>

  <div className={styles.toolbarRight}>
    <button
      className={`${styles.iconButton} ${isPreview ? styles.active : ''}`}
      onClick={() => setIsPreview(!isPreview)}
      title="预览"
    >
      {isPreview ? <FaEye className={styles.icon} /> : <FaEyeSlash className={styles.icon} />}
    </button>
    <button
      className={`${styles.primaryButton} ${isSaving ? styles.saving : ''} ${hasUnsavedChanges ? styles.hasChanges : ''}`}
      onClick={async () => {
        await handleSave();
      }}
      disabled={isSaving || !currentChapterId || !hasUnsavedChanges}
    >
      <FaSave />
      {isSaving ? '保存中...' : hasUnsavedChanges ? '保存' : '已保存'}
    </button>
    <IconButton
      icon={<FaUpload />}
      onClick={handlePublish}
      disabled={isSaving}
      title="发布到区块链"
    />
  </div>
  </div>
  )

  // 在 AuthorWrite 组件中添加发布功能
  const handlePublish = async () => {
  if (!storyInfo.title || !content) {
  toast.error('请填写标题和内容')
  return
  }

  if (!address) {
  toast.error('请先连接钱包')
  return
  }

  try {
  setIsSaving(true)

  // 准备要上传的数据
  const formData = {
    title: storyInfo.title,
    description: storyInfo.description || '',
    content: content,
    coverImage: storyInfo.coverImage || '/images/default-cover.jpg', // 使用默认封面
    authorAddress: address,
    targetWordCount: storyInfo.targetWordCount || 10000,
    category: storyInfo.type || 'other'
  }

  // 上传到 IPFS 并创建故事
  const response = await fetch('/api/stories/create', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(formData)
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || '发布失败')
  }

  const data = await response.json()
  toast.success('发布成功！')

  // 更新故事状态
  setStoryInfo(prev => ({
    ...prev,
    published: true,
    publishedAt: new Date(),
    ipfsHash: data.story.contentCid
  }))

  // 可以选择跳转到故事详情页
  router.push(`/stories/${data.story.id}`)

  } catch (error: any) {
  toast.error(error?.message || '发布失败')
  console.error('Failed to publish story:', error)
  } finally {
  setIsSaving(false)
  }
  }


  // 修改内容变更处理
  const handleContentChange = useCallback((newContent: string) => {
  console.log('内容变更');
  setContent(newContent);
  setHasContentChanged(true); // 标记内容已变更

  // 计算字数
  const wordCount = newContent.replace(/<[^>]*>/g, '') // 移除 HTML 标签
  .replace(/[\u200B-\u200D\uFEFF]/g, '') // 移除零宽字符
  .trim() // 移除首尾空格
  .replace(/\s+/g, ' ') // 将多个空格替换为单个空格
  .split(/\s+/).length; // 按空格分割并计数

  // 使用 localStorage 作为临时存储
  if (currentChapterId) {
  // 只有当内容真的发生变化时才标记为未保存
  const hasChanges = newContent !== lastSavedContent;
  setHasUnsavedChanges(hasChanges);

  if (hasChanges) {
    localStorage.setItem(`draft_${currentChapterId}`, newContent);
    // 更新字数统计
    setWritingStats(prev => ({
      ...prev,
      totalWordCount: prev.totalWordCount + (wordCount - (currentChapter?.wordCount || 0)),
      todayWordCount: prev.todayWordCount + (wordCount - (currentChapter?.wordCount || 0))
    }));
  }
  }
  }, [currentChapterId, lastSavedContent, currentChapter]);

  // 添加路由切换拦截
  useEffect(() => {
  // 监听浏览器的后退/前进
  const handlePopState = async (e: PopStateEvent) => {
  if (hasUnsavedChanges && content !== '') {
    const confirm = window.confirm('你有未保存的更改，确定要离开吗？');
    if (!confirm) {
      // 阻止后退/前进
      e.preventDefault();
      window.history.pushState(null, '', pathname);
    } else {
      // 用户确认离开，先保存
      await handleSave();
      // 允许导航
      window.history.go(-1);
    }
  }
  };

  // 监听所有链接点击
  const handleLinkClick = async (e: MouseEvent) => {
  const target = e.target as HTMLElement;
  const link = target.closest('a');
  if (link && link.href && !link.href.includes(pathname) && hasUnsavedChanges && content !== '') {
    e.preventDefault();
    const confirm = window.confirm('你有未保存的更改，确定要离开吗？');
    if (confirm) {
      await handleSave();
      window.location.href = link.href;
    }
  }
  };

  window.addEventListener('popstate', handlePopState);
  document.addEventListener('click', handleLinkClick);

  return () => {
  window.removeEventListener('popstate', handlePopState);
  document.removeEventListener('click', handleLinkClick);
  };
  }, [hasUnsavedChanges, pathname, handleSave, content]);

  // 修改 beforeunload 事件监听
  useEffect(() => {
  const handleBeforeUnload = (e: BeforeUnloadEvent) => {
  if (hasUnsavedChanges && content !== '') {
    e.preventDefault();
    e.returnValue = '你有未保存的更改，确定要离开吗？';
    return e.returnValue;
  }
  };

  window.addEventListener('beforeunload', handleBeforeUnload);
  return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges, content]);


  // 计算写作统计的 useEffect
  useEffect(() => {
  if (!currentChapter) return

  const wordCount = content.length // 使用 content 而不是 currentChapter.content
  const now = new Date()
  const duration = (now.getTime() - writingStats.lastSaved.getTime()) / 1000 / 60

  // 避免在 useEffect 中直接更新依赖项
  const newStats = {
  totalWordCount: chapters.reduce((sum, ch) => sum + ch.wordCount, 0),
  todayWordCount: wordCount,
  averageSpeed: duration > 0 ? wordCount / duration : 0,
  writingDuration: duration,
  lastSaved: now
  }

  if (JSON.stringify(newStats) !== JSON.stringify(writingStats)) {
  setWritingStats(newStats)
  }
  }, [content, chapters]) // 只依赖 content 和 chapters

  // 修改写作时长统计的 useEffect
  useEffect(() => {
  if (!writingStartTime) {
  setWritingStartTime(new Date())
  return
  }

  const intervalId = setInterval(() => {
  const now = new Date()
  const diff = now.getTime() - writingStartTime.getTime()
  setTotalWritingTime(Math.floor(diff / 1000))
  }, 1000)

  return () => clearInterval(intervalId)
  }, [writingStartTime]) // 只依赖 writingStartTime

  // 移除导航拦截，自动保存相关
  useEffect(() => {
  const cleanup = () => {
  if (autoSaveTimeoutRef.current) {
  clearTimeout(autoSaveTimeoutRef.current)
  }
  }
  return cleanup
  }, [])

  // 添加自动保存清理
  useEffect(() => {
  return () => {
  if (autoSaveTimeoutRef.current) {
  clearTimeout(autoSaveTimeoutRef.current);
  }
  };
  }, []);

  // 自动保存功能
  useEffect(() => {
  if (!currentChapterId || !content || !hasContentChanged) return; // 只在内容变更时触发

  const timeoutId = setTimeout(() => {
  console.log('自动保存草稿...');
  localStorage.setItem(`draft_${currentChapterId}`, content);
  setHasContentChanged(false); // 重置内容变更标记
  }, 30000); // 每30秒保存一次

  return () => clearTimeout(timeoutId);
  }, [currentChapterId, content, hasContentChanged]);

  // 组件卸载时保存草稿
  useEffect(() => {
  return () => {
  if (currentChapterId && content) {
  console.log('组件卸载，保存草稿...');
  localStorage.setItem(`draft_${currentChapterId}`, content);
  }
  }
  }, [currentChapterId, content]);



  // 在 showStorySelector 状态变化时添加日志
  useEffect(() => {
  console.log('作品选择器显示状态:', showStorySelector)
  }, [showStorySelector])

  // 修改选择作品按钮的点击处理
  const handleShowStorySelector = () => {
  console.log('点击选择作品按钮')
  console.log('当前作品数量:', stories.length)
  if (stories.length > 0) {
  setShowStorySelector(true)
  } else {
  showNoStoryTip()
  }
  }



  /*
    页面渲染
  */
  return (
    <WalletRequired
      title="开始创作"
      description="连接钱包以开始您的创作"
      icon={<FaPen className="w-10 h-10 text-indigo-600" />}
    >
      <div className={styles.container}>
        {showTipDialog && (
          <TipDialog
            message="您还没有创建任何作品"
            onClose={() => setShowTipDialog(false)}
          />
        )}
        
        {/* 添加错误提示对话框 */}
        {errorMessage && (
          <ErrorDialog
            message={errorMessage}
            onClose={() => setErrorMessage(null)}
          />
        )}
        
        {isLoadingStories ? (
          <div className={styles.loading}>加载中...</div>
        ) : (
          <>
            {/* 顶部工具栏 */}
            {renderToolbar()}

            <div className={styles.content}>
              {/* 左侧边栏 */}
              <div className={`${styles.sidebar} ${(showChapters || showSettings) ? styles.expanded : ''}`}>
                
                {/* 作品选择器 - 只在非设置模式下显示 */}
                {!showSettings && (
                  <div className={styles.storySection}>
                    <div className={styles.storySelectorHeader}>
                      <IconButton
                        icon={<FaList />}
                        onClick={handleShowStorySelector}
                        title="选择作品"
                      />
                      <span className={styles.sectionTitle}>当前作品</span>
                      <IconButton
                        icon={<FaPlus />}
                        onClick={() => router.push('/author/works')}
                        title="前往作品管理"
                      />
                    </div>
                    
                    {currentStory ? (
                      <div className={styles.storyCard}>
                        <h3>{currentStory.title}</h3>
                        <p className={styles.storyType}>
                          {STORY_TYPES.find(t => t.id === currentStory.category)?.name || currentStory.category}
                        </p>
                        <p className={styles.storyStats}>
                          字数：{currentStory.wordCount || 0}
                          {currentStory.targetWordCount > 0 && ` / ${currentStory.targetWordCount}`}
                        </p>
                      </div>
                    ) : (
                      <div className={styles.noStory}>
                        <p>请选择要编辑的作品</p>
                        <button
                          className={styles.createButton}
                          onClick={handleShowStorySelector}
                        >
                          选择作品
                        </button>
                      </div>
                    )}

                    {/* 作品选择器弹窗 */}
                    {showStorySelector && stories.length > 0 && (
                      <>
                        {/* 遮罩层 */}
                        <div style={{
                          position: 'fixed',
                          top: 0,
                          left: 0,
                          right: 0,
                          bottom: 0,
                          backgroundColor: 'rgba(0, 0, 0, 0.5)',
                          zIndex: 999
                        }} />
                        
                        {/* 选择器弹窗 */}
                        <div style={{
                          position: 'fixed',
                          top: '50%',
                          left: '50%',
                          transform: 'translate(-50%, -50%)',
                          backgroundColor: 'white',
                          padding: '24px',
                          borderRadius: '12px',
                          boxShadow: '0 8px 16px rgba(0, 0, 0, 0.2)',
                          zIndex: 1000,
                          width: '90%',
                          maxWidth: '600px',
                          height: '80vh',
                          display: 'flex',
                          flexDirection: 'column',
                          overflow: 'hidden' // 防止内容溢出
                        }}>
                          {/* 标题栏 */}
                          <div style={{
                            marginBottom: '24px',
                            paddingBottom: '16px',
                            borderBottom: '1px solid #e5e7eb',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                          }}>
                            <h3 style={{ 
                              margin: 0,
                              fontSize: '1.5rem',
                              fontWeight: '600',
                              color: '#111827'
                            }}>选择作品</h3>
                            <IconButton
                              icon={<FaTimes />}
                              onClick={() => setShowStorySelector(false)}
                              title="关闭"
                              style={{
                                padding: '8px',
                                borderRadius: '8px',
                                backgroundColor: '#f3f4f6',
                                cursor: 'pointer'
                              }}
                            />
                          </div>

                          {/* 列表内容区 */}
                          <div style={{
                            flex: 1,
                            overflow: 'auto',
                            marginRight: '-8px', // 为滚动条预留空间
                            paddingRight: '8px'  // 补偿右侧间距
                          }}>
                            <div style={{
                              display: 'grid',
                              gap: '16px'
                            }}>
                              {stories.map(story => (
                                <div
                                  key={story.id}
                                  onClick={() => handleStorySelect(story)}
                                  className={styles.storyItem}
                                  style={{
                                    padding: '20px',
                                    border: '1px solid #e5e7eb',
                                    borderRadius: '12px',
                                    cursor: 'pointer',
                                    backgroundColor: currentStory?.id === story.id ? '#f3f4f6' : 'white',
                                    transition: 'all 0.2s ease',
                                  }}
                                >
                                  <h4 style={{ 
                                    margin: '0 0 12px 0',
                                    fontSize: '1.25rem',
                                    fontWeight: '600',
                                    color: '#111827'
                                  }}>{story.title}</h4>
                                  <p style={{ 
                                    margin: '0 0 12px 0',
                                    color: '#4b5563',
                                    fontSize: '1rem'
                                  }}>
                                    {STORY_TYPES.find(t => t.id === story.category)?.name || story.category}
                                  </p>
                                  <div style={{ 
                                    display: 'flex',
                                    gap: '24px',
                                    fontSize: '0.875rem',
                                    color: '#6b7280'
                                  }}>
                                    <span>字数：{story.wordCount || 0}</span>
                                    <span>章节：{story.chapterCount || 0}</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                )}

                {/* 左侧面板 */}
                {currentStory && (showChapters || showSettings) && (
                  <div className={styles.leftPanel}>
                    {/* 章节管理面板 */}
                    {showChapters && (
                      <div className={styles.chaptersPanel}>
                        <div className={styles.chapterHeader}>
                          <h2 className={styles.panelTitle}>
                            章节管理
                            <span className={styles.chapterCount}>({chapters.length})</span>
                          </h2>
                          <div className={styles.headerActions}>
                            <button className={styles.sortButton}>
                              <FaSort />
                            </button>
                            <button
                              className={styles.addChapterButton}
                              onClick={() => handleAddChapter()}
                            >
                              + 新建
                            </button>
                          </div>
                        </div>

                        <div className={styles.chapterList}>
                          {chapters.map((chapter) => (
                            <div
                              key={chapter.id}
                              className={`${styles.chapterItem} ${
                                currentChapter?.id === chapter.id ? styles.activeChapter : ''
                              }`}
                              onClick={() => loadChapter(chapter.id)}
                            >
                              <div className={styles.chapterMain}>
                                {editingChapterId === chapter.id ? (
                                  <input
                                    type="text"
                                    value={chapter.title}
                                    onChange={(e) => handleChapterUpdate(chapter.id, 'title', e.target.value)}
                                    className={styles.chapterTitleInput}
                                    onClick={(e) => e.stopPropagation()}
                                    autoFocus
                                  />
                                ) : (
                                  <span className={styles.chapterTitle}>{chapter.title}</span>
                                )}
                                <div className={styles.chapterInfo}>
                                  <span className={styles.wordCount}>
                                    {calculateWordCount(chapter.content)}字
                                  </span>
                                  <select
                                    value={chapter.status}
                                    onChange={(e) => handleChapterUpdate(chapter.id, 'status', e.target.value)}
                                    className={styles.chapterStatus}
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <option value="draft">草稿</option>
                                    <option value="pending">待审核</option>
                                    <option value="published">已发布</option>
                                  </select>
                                </div>
                              </div>
                              <div className={styles.chapterActions}>
                                {editingChapterId === chapter.id ? (
                                  <button
                                    className={styles.actionButton}
                                    onClick={(e) => handleSaveClick(e, chapter.id)}
                                    title="保存"
                                  >
                                    <FaSave />
                                  </button>
                                ) : (
                                  <>
                                    <button
                                      className={styles.actionButton}
                                      onClick={(e) => handleEditClick(e, chapter.id)}
                                      title="编辑"
                                    >
                                      <FaPen />
                                    </button>
                                    <button
                                      className={styles.actionButton}
                                      onClick={(e) => handleDeleteClick(e, chapter.id)}
                                      title="删除"
                                    >
                                      <FaTrash />
                                    </button>
                                    {chapter.status !== 'published' && (
                                      <button
                                        className={styles.actionButton}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handlePublishChapter(chapter.id);
                                        }}
                                        title="发布到区块链"
                                      >
                                        <FaUpload />
                                      </button>
                                    )}
                                  </>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>

                        <div className={styles.chapterStats}>
                          <div className={styles.statItem}>
                            总字数: {writingStats.totalWordCount}
                          </div>
                          <div className={styles.statItem}>
                            已发布: {chapters.filter(ch => ch.status === 'published').length}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* 作品设置面板 */}
                    {showSettings && (
                      <div className={styles.settingsPanel}>
                        <div className={styles.settingsHeader}>
                          <h2 className={styles.panelTitle}>创建新作品</h2>
                        </div>
                        <div className={styles.settingsContent}>
                          <div className={styles.formGroup}>
                            <label className={styles.label}>作品标题</label>
                            <input
                              type="text"
                              className={styles.input}
                              value={storyInfo.title}
                              onChange={e => handleInfoChange('title', e.target.value)}
                              placeholder="请输入作品标题"
                            />
                          </div>

                          <div className={styles.formGroup}>
                            <label className={styles.label}>作品类型</label>
                            <div className={styles.typeGrid}>
                              {STORY_TYPES.map(type => (
                                <button
                                  key={type.id}
                                  className={`${styles.typeButton} ${storyInfo.type === type.id ? styles.active : ''}`}
                                  onClick={() => handleInfoChange('type', type.id)}
                                >
                                  {type.name}
                                </button>
                              ))}
                            </div>
                          </div>

                          <div className={styles.formGroup}>
                            <label className={styles.label}>作品简介</label>
                            <textarea
                              className={styles.textarea}
                              value={storyInfo.description}
                              onChange={e => handleInfoChange('description', e.target.value)}
                              placeholder="请输入作品简介"
                              rows={4}
                            />
                          </div>

                          <div className={`${styles.formGroup} ${styles.targetWordCountGroup}`}>
                            <label className={styles.label}>
                              目标字数
                              <span className={styles.requiredStar}>*</span>
                              <span className={styles.importantBadge}>重要</span>
                            </label>
                            <div className={styles.targetWordCountInput}>
                              <input
                                type="number"
                                className={styles.input}
                                value={storyInfo.targetWordCount}
                                onChange={e => handleInfoChange('targetWordCount', e.target.value)}
                                placeholder="请设置作品目标字数"
                                min="0"
                                step="10000"
                              />
                              <span className={styles.wordCountUnit}>字</span>
                            </div>
                            <p className={styles.wordCountHint}>目标字数将影响作品NFT铸造、挖矿奖励及作品价值评估。</p>
                          </div>

                          <div className={styles.formGroup}>
                            <label className={styles.label}>发布设置</label>
                            <div className={styles.publishSettings}>
                              <label className={styles.checkboxLabel}>
                                <input
                                  type="checkbox"
                                  checked={storyInfo.isSerial}
                                  onChange={e => handleInfoChange('isSerial', e.target.checked)}
                                />
                                连载作品
                              </label>
                              <label className={styles.checkboxLabel}>
                                <input
                                  type="checkbox"
                                  checked={storyInfo.isFree}
                                  onChange={e => handleInfoChange('isFree', e.target.checked)}
                                />
                                免费阅读
                              </label>
                            </div>
                            {!storyInfo.isFree && (
                              <input
                                type="number"
                                className={styles.input}
                                value={storyInfo.price}
                                onChange={e => handleInfoChange('price', parseFloat(e.target.value))}
                                placeholder="设置价格（ETH）"
                                min="0"
                                step="0.01"
                              />
                            )}
                          </div>

                          <div className={styles.formGroup}>
                            <label className={styles.label}>作品封面</label>
                            <div className="relative">
                              <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center">
                                {storyInfo.coverImage ? (
                                  <div className="relative w-full aspect-[3/4] max-w-[240px] mx-auto">
                                    <img 
                                      src={storyInfo.coverImage} 
                                      alt="作品封面" 
                                      className="w-full h-full object-cover rounded-lg"
                                    />
                                    <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity bg-black/50 rounded-lg">
                                      <label className="cursor-pointer p-2 bg-white rounded-lg shadow hover:bg-gray-50">
                                        <input
                                          type="file"
                                          accept="image/*"
                                          onChange={handleCoverSelect}
                                          className="hidden"
                                        />
                                        <FaCamera className="w-6 h-6 text-gray-600" />
                                      </label>
                                      <button
                                        onClick={() => handleInfoChange('coverImage', '')}
                                        className="ml-2 p-2 bg-red-500 text-white rounded-lg shadow hover:bg-red-600"
                                      >
                                        <FaTimes className="w-6 h-6" />
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                  <label className="cursor-pointer">
                                    <div className="flex flex-col items-center justify-center py-8">
                                      <FaCamera className="w-12 h-12 text-gray-400 mb-4" />
                                      <p className="text-sm text-gray-500 mb-2">点击或拖拽上传封面</p>
                                      <p className="text-xs text-gray-400">建议尺寸: 600x800px</p>
                                    </div>
                                    <input
                                      type="file"
                                      accept="image/*"
                                      onChange={handleCoverSelect}
                                      className="hidden"
                                    />
                                  </label>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className={styles.formActions}>
                            <Button onClick={handleCreateStory} className={styles.confirmButton}>
                              创建作品
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* 编辑器区域 */}
              <div className={styles.editor}>
                <div className={styles.editorContent}>
                  <div className={styles.editorInner}>
                    <Editor
                      key={currentChapterId || undefined}
                      initialContent={content}
                      onChange={handleContentChange}
                      editable={!isPreview}
                      className={isPreview ? styles.previewContent : styles.content}
                      placeholder="开始创作你的故事..."
                      onSave={async () => {
                        await handleSave();
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* 大纲对话框 */}
              {showOutlineDialog && (
                <div className={styles.modal}>
                  <div className={styles.modalContent}>
                    <div className={styles.modalHeader}>
                      <h2>添加大纲</h2>
                      <button 
                        className={styles.closeButton}
                        onClick={() => setShowOutlineDialog(false)}
                      >
                        ×
                      </button>
                    </div>
                    <form onSubmit={(e) => {
                      e.preventDefault();
                      const form = e.target as HTMLFormElement;
                      const title = (form.elements.namedItem('title') as HTMLInputElement).value;
                      const description = (form.elements.namedItem('description') as HTMLTextAreaElement).value;
                      addOutline(title, description);
                      setShowOutlineDialog(false);
                    }}>
                      <Input id="title" placeholder="大纲标题" required />
                      <Textarea id="description" placeholder="大纲描述" required />
                      <div className={styles.modalFooter}>
                        <Button type="button" variant="outline" onClick={() => setShowOutlineDialog(false)}>取消</Button>
                        <Button type="submit">保存</Button>
                      </div>
                    </form>
                  </div>
                </div>
              )}

              {/* 写作统计对话框 */}
              {showStatsDialog && (
                <div className={styles.modal}>
                  <div className={styles.modalContent}>
                    <h2>写作统计</h2>
                    <div>
                      <div>总字数: {writingStats.totalWordCount}</div>
                      <div>今日字数: {writingStats.todayWordCount}</div>
                      <div>平均速度: {Math.round(writingStats.averageSpeed)} 字/分钟</div>
                      <div>写作时长: {Math.round(writingStats.writingDuration)} 分钟</div>
                    </div>
                    <Button onClick={() => setShowStatsDialog(false)}>关闭</Button>
                  </div>
                </div>
              )}

              {/* 添加删除确认弹窗 */}
              {showDeleteDialog && (
                <div className={styles.modal}>
                  <div className={styles.modalContent}>
                    <div className={styles.modalHeader}>
                      <h2>确认删除</h2>
                      <button 
                        className={styles.closeButton}
                        onClick={() => {
                          setShowDeleteDialog(false);
                          setChapterToDelete(null);
                        }}
                      >
                        ×
                      </button>
                    </div>
                    <p className={styles.modalText}>确定要删除这个章节吗？此操作不可恢复。</p>
                    <div className={styles.modalFooter}>
                      <Button
                        className={`${styles.button} ${styles.cancelButton}`}
                        onClick={() => {
                          setShowDeleteDialog(false);
                          setChapterToDelete(null);
                        }}
                      >
                        取消
                      </Button>
                      <Button
                        className={`${styles.button} ${styles.deleteButton}`}
                        onClick={handleConfirmDelete}
                      >
                        删除
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {/* 作品创建确认弹窗 */}
              {showCreateConfirm && (
                <div className={styles.previewOverlay}>
                  <div className={styles.previewPanel}>
                    <div className={styles.previewHeader}>
                      <h2>创建新作品</h2>
                      <button 
                        className={styles.closeButton}
                        onClick={() => !isCreating && setShowCreateConfirm(false)}
                        disabled={isCreating}
                      >
                        <FaTimes />
                      </button>
                    </div>
                    <div className={styles.previewContent}>
                      <div className={styles.previewLeft}>
                        {storyInfo.coverImage ? (
                          <img 
                            src={storyInfo.coverImage} 
                            alt="作品封面"
                            className={styles.previewCover}
                          />
                        ) : (
                          <div className={styles.previewCoverPlaceholder}>
                            <FaImage className={styles.placeholderIcon} />
                            <span>暂无封面</span>
                          </div>
                        )}
                      </div>
                      <div className={styles.previewRight}>
                        <h3 className={styles.previewTitle}>{storyInfo.title}</h3>
                        <span className={styles.previewType}>
                          {STORY_TYPES.find(t => t.id === storyInfo.type)?.name || '未选择类型'}
                        </span>
                        <div className={styles.previewDescription}>
                          {storyInfo.description || '暂无简介'}
                        </div>
                        <div className={styles.previewDetails}>
                          <div className={styles.previewDetailItem}>
                            <FaBook className={styles.detailIcon} />
                            <span>{storyInfo.isSerial ? '连载中' : '已完结'}</span>
                          </div>
                          <div className={styles.previewDetailItem}>
                            <FaMoneyBill className={styles.detailIcon} />
                            <span>{storyInfo.isFree ? '免费阅读' : `${storyInfo.price} ETH`}</span>
                          </div>
                          {storyInfo.targetWordCount > 0 && (
                            <div className={styles.previewDetailItem}>
                              <FaPen className={styles.detailIcon} />
                              <span>目标字数：{storyInfo.targetWordCount}</span>
                            </div>
                          )}
                        </div>
                        <div className={styles.previewWarning}>
                          <FaInfoCircle className={styles.warningIcon} />
                          <span>创建作品需要连接钱包并支付少量gas费用</span>
                        </div>
                      </div>
                    </div>
                    {createStatus && (
                      <div className={styles.createProgress}>
                        <div className={styles.progressBar}>
                          <div 
                            className={styles.progressFill} 
                            style={{ width: `${createProgress}%` }}
                          />
                        </div>
                        <div className={styles.progressStatus}>
                          {createStatus === CreateStatus.UPLOADING && '正在上传封面...'}
                          {createStatus === CreateStatus.UPLOADING && '正在上传内容...'}
                          {createStatus === CreateStatus.CREATING_CONTRACT && '正在创建合约...'}
                          {createStatus === CreateStatus.SAVING_DATABASE && '正在保存数据...'}
                          {createStatus === CreateStatus.COMPLETED && '创建完成！'}
                        </div>
                      </div>
                    )}
                    <div className={styles.previewActions}>
                      <button
                        className={styles.cancelButton}
                        onClick={() => !isCreating && setShowCreateConfirm(false)}
                        disabled={isCreating}
                      >
                        取消
                      </button>
                      <button
                        className={styles.confirmButton}
                        onClick={handleConfirmCreate}
                        disabled={isCreating}
                      >
                        {isCreating ? (
                          <>
                            <div className={styles.loadingSpinner} />
                            创建中...
                          </>
                        ) : (
                          <>
                            <FaCheck />
                            确认创建
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* 作品添加图片裁剪对话框 */}
              {showCoverCropper && selectedCoverFile && (
                <div className={styles.modal}>
                  <div className={styles.modalContent}>
                    <div className={styles.modalHeader}>
                      <h2>裁剪封面</h2>
                      <button 
                        className={styles.closeButton}
                        onClick={() => {
                          setShowCoverCropper(false);
                          setSelectedCoverFile(null);
                        }}
                      >
                        <FaTimes />
                      </button>
                    </div>
                    <ImageCropper
                      image={URL.createObjectURL(selectedCoverFile)}
                      onCropComplete={handleCropComplete}
                      aspectRatio={3/4}
                      minWidth={600}
                      minHeight={800}
                      onCancel={() => {
                        setShowCoverCropper(false);
                        setSelectedCoverFile(null);
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
      {/* 创建章节对话框 - 美化版 */}
      {showCreateChapterDialog && (
        <div className={styles.modalOverlay}>
          <div className={styles.modernModal}>
            <div className={styles.modernModalHeader}>
              <h3>创建新章节</h3>
              <button 
                className={styles.modernCloseButton}
                onClick={handleCancelAddChapter}
                aria-label="关闭"
              >
                <FaTimes />
              </button>
            </div>
            <div className={styles.modernModalBody}>
              <div className={styles.modernFormGroup}>
                <label htmlFor="chapterTitle" className={styles.modernLabel}>章节标题</label>
                <div className={styles.inputWrapper}>
                  <span className={styles.inputIcon}>
                    <FaHeading />
                  </span>
                  <input
                    id="chapterTitle"
                    type="text"
                    value={newChapterTitle}
                    onChange={(e) => setNewChapterTitle(e.target.value)}
                    className={styles.modernInput}
                    placeholder="请输入章节标题"
                    autoFocus
                    spellCheck="false"
                    autoCorrect="off"
                    autoCapitalize="off"
                    ref={(input) => {
                      // 当输入框挂载后，将光标移动到末尾
                      if (input) {
                        setTimeout(() => {
                          input.focus();
                          input.selectionStart = input.selectionEnd = input.value.length;
                        }, 50);
                      }
                    }}
                  />
                </div>
                <p className={styles.inputHint}>好的章节标题能够吸引读者并概括章节内容</p>
              </div>
            </div>
            <div className={styles.modernModalFooter}>
              <button 
                className={styles.modernCancelButton}
                onClick={handleCancelAddChapter}
              >
                取消
              </button>
              <button 
                className={styles.modernConfirmButton}
                onClick={handleConfirmAddChapter}
              >
                <FaPlus className={styles.buttonIcon} />
                创建章节
              </button>
            </div>
          </div>
        </div>
      )}
    </WalletRequired>
  )
}

// 格式化时间函数
function formatTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
} 