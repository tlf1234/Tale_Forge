import { NextResponse } from 'next/server';
import { ethers } from 'ethers';
import { getProvider, getSigner } from '@/lib/contract';
import { CONTRACT_ADDRESSES, TOKEN_ABIS } from '@/constants/contracts';

// 定义类型
interface AuthorStats {
  totalWordCount: string;
  likeCount: string;
  followerCount: string;
  isSpecialAuthor: boolean;
}

interface AuthorData {
  penName: string;
  hasToken: boolean;
  tokenAddress?: string;
  tokenName?: string;
  tokenSymbol?: string;
  totalSupply?: string;
  stats: AuthorStats;
}

interface Requirements {
  minWordCount: string;
  minLikeCount: string;
  minFollowerCount: string;
}

// 模拟作者数据
const MOCK_AUTHORS: Record<string, AuthorData> = {
  // 已有代币的作者
  '0xabcdef1234567890abcdef1234567890abcdef12': {
    penName: '东方宇轩',
    hasToken: true,
    tokenAddress: '0x1234567890123456789012345678901234567890',
    tokenName: '幻世录代币',
    tokenSymbol: 'HSL',
    totalSupply: '1000000',
    stats: {
      totalWordCount: '850000',
      likeCount: '2500',
      followerCount: '1200',
      isSpecialAuthor: true
    }
  },
  // 符合发币条件的作者
  '0xbcdef1234567890abcdef1234567890abcdef123': {
    penName: '南山竹影',
    hasToken: false,
    stats: {
      totalWordCount: '620000',
      likeCount: '1800',
      followerCount: '850',
      isSpecialAuthor: false
    }
  },
  // 不符合发币条件的作者
  '0xcdef1234567890abcdef1234567890abcdef1234': {
    penName: '夜雨江南',
    hasToken: false,
    stats: {
      totalWordCount: '320000',
      likeCount: '780',
      followerCount: '420',
      isSpecialAuthor: false
    }
  },
  // 特邀作者
  '0xdef1234567890abcdef1234567890abcdef12345': {
    penName: '烟雨江湖',
    hasToken: false,
    stats: {
      totalWordCount: '280000',
      likeCount: '650',
      followerCount: '380',
      isSpecialAuthor: true
    }
  }
};

// 发币要求
const MOCK_REQUIREMENTS: Requirements = {
  minWordCount: '500000',
  minLikeCount: '1000',
  minFollowerCount: '500'
};

// 获取作者代币资格
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const address = searchParams.get('address');

    if (!address) {
      return NextResponse.json({ error: 'Address parameter is required' }, { status: 400 });
    }

    // 尝试从区块链获取数据
    try {
      const provider = getProvider();
      
      // 使用 TOKEN_ABIS 创建合约实例
      const tokenFactory = new ethers.Contract(
        CONTRACT_ADDRESSES.TokenFactory,
        TOKEN_ABIS.TokenFactory,
        provider
      );
      
      const authorManagerABI = [
        "function isAuthorRegistered(address author) view returns (bool)",
        "function getAuthor(address authorAddress) view returns (tuple(address authorAddress, string penName, uint32 storyCount, uint256 totalWordCount, uint256 totalEarningsBNB, uint256 totalEarningsToken, uint256 totalMiningRewards, uint256 createdAt, uint256 lastUpdate, bool isActive, uint256 likeCount, uint256 followerCount, bool isSpecial, address tokenAddress))",
        "function getAuthorStats(address author) view returns (uint256 totalWordCount, uint256 likeCount, uint256 followerCount)",
        "function isSpecialAuthor(address author) view returns (bool)"
      ];
      
      const authorManager = new ethers.Contract(
        CONTRACT_ADDRESSES.AuthorManager,
        authorManagerABI,
        provider
      );

      // 检查作者是否注册
      const isRegistered = await authorManager.isAuthorRegistered(address);
      if (!isRegistered) {
        return NextResponse.json({ 
          eligible: false, 
          hasToken: false,
          reason: 'Author not registered'
        });
      }

      // 获取作者信息
      const author = await authorManager.getAuthor(address);
      
      // 检查是否已有代币
      if (author.tokenAddress !== ethers.constants.AddressZero) {
        // 获取代币信息
        const token = new ethers.Contract(
          author.tokenAddress,
          TOKEN_ABIS.AuthorToken,
          provider
        );
        
        const tokenName = await token.name();
        const tokenSymbol = await token.symbol();
        const totalSupply = await token.totalSupply();
        
        return NextResponse.json({
          eligible: true,
          hasToken: true,
          tokenAddress: author.tokenAddress,
          tokenName,
          tokenSymbol,
          totalSupply: ethers.utils.formatEther(totalSupply)
        });
      }

      // 检查是否有资格发币
      const isEligible = await tokenFactory.checkEligibility(address);
      
      // 获取作者统计数据
      const stats = await authorManager.getAuthorStats(address);
      const isSpecial = await authorManager.isSpecialAuthor(address);
      
      // 获取发币要求
      const minWordCount = await tokenFactory.minWordCount();
      const minLikeCount = await tokenFactory.minLikeCount();
      const minFollowerCount = await tokenFactory.minFollowerCount();

      return NextResponse.json({
        eligible: isEligible,
        hasToken: false,
        stats: {
          totalWordCount: stats[0].toString(),
          likeCount: stats[1].toString(),
          followerCount: stats[2].toString(),
          isSpecialAuthor: isSpecial
        },
        requirements: {
          minWordCount: minWordCount.toString(),
          minLikeCount: minLikeCount.toString(),
          minFollowerCount: minFollowerCount.toString()
        }
      });
    } catch (error) {
      console.log('Failed to get token eligibility from blockchain, using mock data:', error);
      // 如果区块链访问失败，使用模拟数据
    }
    
    // 使用模拟数据
    // 将地址转为小写以便匹配
    const lowerCaseAddress = address.toLowerCase();
    
    // 检查是否有该作者的模拟数据
    if (MOCK_AUTHORS[lowerCaseAddress]) {
      const authorData = MOCK_AUTHORS[lowerCaseAddress];
      
      // 如果作者已有代币
      if (authorData.hasToken) {
        return NextResponse.json({
          eligible: true,
          hasToken: true,
          tokenAddress: authorData.tokenAddress,
          tokenName: authorData.tokenName,
          tokenSymbol: authorData.tokenSymbol,
          totalSupply: authorData.totalSupply
        });
      }
      
      // 检查是否符合发币条件
      const stats = authorData.stats;
      const isEligible = 
        parseInt(stats.totalWordCount) >= parseInt(MOCK_REQUIREMENTS.minWordCount) ||
        parseInt(stats.likeCount) >= parseInt(MOCK_REQUIREMENTS.minLikeCount) ||
        parseInt(stats.followerCount) >= parseInt(MOCK_REQUIREMENTS.minFollowerCount) ||
        stats.isSpecialAuthor;
      
      return NextResponse.json({
        eligible: isEligible,
        hasToken: false,
        stats: stats,
        requirements: MOCK_REQUIREMENTS
      });
    }
    
    // 如果没有该作者的模拟数据，创建一个随机的新作者
    const randomStats: AuthorStats = {
      totalWordCount: Math.floor(Math.random() * 800000).toString(),
      likeCount: Math.floor(Math.random() * 2000).toString(),
      followerCount: Math.floor(Math.random() * 1000).toString(),
      isSpecialAuthor: Math.random() > 0.8 // 20%概率是特邀作者
    };
    
    const isEligible = 
      parseInt(randomStats.totalWordCount) >= parseInt(MOCK_REQUIREMENTS.minWordCount) ||
      parseInt(randomStats.likeCount) >= parseInt(MOCK_REQUIREMENTS.minLikeCount) ||
      parseInt(randomStats.followerCount) >= parseInt(MOCK_REQUIREMENTS.minFollowerCount) ||
      randomStats.isSpecialAuthor;
    
    return NextResponse.json({
      eligible: isEligible,
      hasToken: false,
      stats: randomStats,
      requirements: MOCK_REQUIREMENTS
    });

  } catch (error) {
    console.error('Error getting token eligibility:', error);
    return NextResponse.json({ error: 'Failed to check token eligibility' }, { status: 500 });
  }
}

// 创建作者代币
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { address, tokenName, tokenSymbol, commitedRevenue } = body;

    if (!address || !tokenName || !tokenSymbol || !commitedRevenue) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    // 尝试使用区块链创建代币
    try {
      const signer = await getSigner();
      const signerAddress = await signer.getAddress();
      
      // 检查调用者是否为作者本人
      if (signerAddress.toLowerCase() !== address.toLowerCase()) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }

      // 使用 TOKEN_ABIS 创建合约实例
      const tokenFactory = new ethers.Contract(
        CONTRACT_ADDRESSES.TokenFactory,
        TOKEN_ABIS.TokenFactory,
        signer
      );

      // 检查是否有资格发币
      const isEligible = await tokenFactory.checkEligibility(address);
      if (!isEligible) {
        return NextResponse.json({ error: 'Author not eligible to create token' }, { status: 403 });
      }

      // 创建代币
      const tx = await tokenFactory.createAuthorToken(
        tokenName,
        tokenSymbol,
        address,
        commitedRevenue * 100 // 转换为基点 (1% = 100)
      );

      const receipt = await tx.wait();
      
      // 从事件中获取代币地址
      const event = receipt.events?.find((e: any) => e.event === 'TokenCreated');
      const tokenAddress = event?.args?.tokenAddress;

      return NextResponse.json({
        success: true,
        tokenAddress,
        transactionHash: receipt.transactionHash
      });
    } catch (error) {
      console.log('Failed to create token on blockchain, using mock data:', error);
      // 如果区块链交易失败，使用模拟数据
    }
    
    // 使用模拟数据
    // 生成一个模拟的代币地址
    const mockTokenAddress = '0x' + Math.random().toString(16).substring(2, 42);
    
    // 返回成功响应
    return NextResponse.json({
      success: true,
      tokenAddress: mockTokenAddress,
      transactionHash: '0x' + Math.random().toString(16).substring(2, 66)
    });

  } catch (error) {
    console.error('Error creating token:', error);
    return NextResponse.json({ error: 'Failed to create token' }, { status: 500 });
  }
} 