import { NextResponse } from 'next/server';
import { ethers } from 'ethers';
import { getProvider } from '@/lib/contract';
import { CONTRACT_ADDRESSES, TOKEN_ABIS } from '@/constants/contracts';

// 模拟代币数据
const MOCK_TOKENS = [
  {
    address: '0x1234567890123456789012345678901234567890',
    name: '幻世录代币',
    symbol: 'HSL',
    authorName: '东方宇轩',
    authorAddress: '0xabcdef1234567890abcdef1234567890abcdef12',
    price: '0.0082',
    priceChange24h: 12.5,
    volume24h: '8750',
    marketCap: '8200',
    holders: 342
  },
  {
    address: '0x2345678901234567890123456789012345678901',
    name: '星辰大海代币',
    symbol: 'XCDH',
    authorName: '南山竹影',
    authorAddress: '0xbcdef1234567890abcdef1234567890abcdef123',
    price: '0.0156',
    priceChange24h: 8.3,
    volume24h: '12450',
    marketCap: '15600',
    holders: 578
  },
  {
    address: '0x3456789012345678901234567890123456789012',
    name: '都市传说代币',
    symbol: 'DSCS',
    authorName: '夜雨江南',
    authorAddress: '0xcdef1234567890abcdef1234567890abcdef1234',
    price: '0.0034',
    priceChange24h: -5.2,
    volume24h: '3200',
    marketCap: '3400',
    holders: 156
  },
  {
    address: '0x4567890123456789012345678901234567890123',
    name: '玄幻世界代币',
    symbol: 'XHSJ',
    authorName: '烟雨江湖',
    authorAddress: '0xdef1234567890abcdef1234567890abcdef12345',
    price: '0.0092',
    priceChange24h: 3.7,
    volume24h: '6800',
    marketCap: '9200',
    holders: 287
  },
  {
    address: '0x5678901234567890123456789012345678901234',
    name: '仙侠传奇代币',
    symbol: 'XXCQ',
    authorName: '云中仙',
    authorAddress: '0xef1234567890abcdef1234567890abcdef123456',
    price: '0.0215',
    priceChange24h: 15.8,
    volume24h: '18500',
    marketCap: '21500',
    holders: 632
  },
  {
    address: '0x6789012345678901234567890123456789012345',
    name: '科幻未来代币',
    symbol: 'KHWL',
    authorName: '星际漫游者',
    authorAddress: '0xf1234567890abcdef1234567890abcdef1234567',
    price: '0.0068',
    priceChange24h: -2.3,
    volume24h: '4300',
    marketCap: '6800',
    holders: 213
  },
  {
    address: '0x7890123456789012345678901234567890123456',
    name: '历史长河代币',
    symbol: 'LSCH',
    authorName: '秦汉风云',
    authorAddress: '0x1234567890abcdef1234567890abcdef12345678',
    price: '0.0047',
    priceChange24h: -8.5,
    volume24h: '2900',
    marketCap: '4700',
    holders: 189
  },
  {
    address: '0x8901234567890123456789012345678901234567',
    name: '奇幻世界代币',
    symbol: 'QHSJ',
    authorName: '魔法师',
    authorAddress: '0x234567890abcdef1234567890abcdef123456789',
    price: '0.0128',
    priceChange24h: 6.2,
    volume24h: '9500',
    marketCap: '12800',
    holders: 456
  },
  {
    address: '0x9012345678901234567890123456789012345678',
    name: '青春校园代币',
    symbol: 'QCXY',
    authorName: '青春无悔',
    authorAddress: '0x34567890abcdef1234567890abcdef1234567890',
    price: '0.0052',
    priceChange24h: 1.8,
    volume24h: '3800',
    marketCap: '5200',
    holders: 204
  },
  {
    address: '0x0123456789012345678901234567890123456789',
    name: '悬疑推理代币',
    symbol: 'XYTL',
    authorName: '福尔摩斯',
    authorAddress: '0x4567890abcdef1234567890abcdef12345678901',
    price: '0.0073',
    priceChange24h: 4.5,
    volume24h: '5600',
    marketCap: '7300',
    holders: 245
  }
];

/**
 * 获取代币市场列表
 * @route GET /api/market/tokens
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const sort = searchParams.get('sort') || 'marketCap';
    const order = searchParams.get('order') || 'desc';
    const search = searchParams.get('search') || '';
    const filter = searchParams.get('filter') || 'all';

    // 尝试从区块链获取数据
    try {
      const provider = getProvider();
      
      // 创建代币工厂合约实例
      const tokenFactory = new ethers.Contract(
        CONTRACT_ADDRESSES.TokenFactory,
        TOKEN_ABIS.TokenFactory,
        provider
      );
      
      // 获取代币总数
      const tokenCount = await tokenFactory.getAuthorTokenCount();
      
      // 如果有真实代币，则继续获取真实数据
      if (tokenCount.toNumber() > 0) {
        // 计算分页
        const startIndex = (page - 1) * limit;
        const endIndex = Math.min(startIndex + limit, tokenCount.toNumber());
        
        // 获取代币地址列表
        const tokenAddresses = await tokenFactory.getAuthorTokens(startIndex, limit);
        
        // 获取每个代币的详细信息
        const tokensPromises = tokenAddresses.map(async (address: string) => {
          const authorToken = new ethers.Contract(
            address,
            TOKEN_ABIS.AuthorToken,
            provider
          );
          
          // 获取代币基本信息
          const [name, symbol, totalSupply, author] = await Promise.all([
            authorToken.name(),
            authorToken.symbol(),
            authorToken.totalSupply(),
            authorToken.author()
          ]);
          
          // 获取作者信息
          const authorManagerABI = [
            "function getAuthor(address authorAddress) view returns (tuple(address authorAddress, string penName, uint32 storyCount, uint256 totalWordCount, uint256 totalEarningsBNB, uint256 totalEarningsToken, uint256 totalMiningRewards, uint256 createdAt, uint256 lastUpdate, bool isActive, uint256 likeCount, uint256 followerCount, bool isSpecial, address tokenAddress))"
          ];
          
          const authorManager = new ethers.Contract(
            CONTRACT_ADDRESSES.AuthorManager,
            authorManagerABI,
            provider
          );
          
          const authorData = await authorManager.getAuthor(author);
          const authorName = authorData.penName;
          
          // 模拟市场数据（实际应从DEX获取）
          const price = (Math.random() * 0.01).toFixed(4);
          const priceChange24h = (Math.random() * 20 - 10).toFixed(1);
          const volume24h = (Math.random() * 10000).toFixed(0);
          const marketCap = (parseFloat(price) * parseFloat(ethers.utils.formatEther(totalSupply))).toFixed(0);
          const holders = Math.floor(Math.random() * 500) + 10;
          
          return {
            address,
            name,
            symbol,
            authorName,
            authorAddress: author,
            price,
            priceChange24h: parseFloat(priceChange24h),
            volume24h,
            marketCap,
            holders
          };
        });
        
        let tokens = await Promise.all(tokensPromises);
        
        // 应用搜索过滤
        if (search) {
          const searchLower = search.toLowerCase();
          tokens = tokens.filter(token => 
            token.name.toLowerCase().includes(searchLower) ||
            token.symbol.toLowerCase().includes(searchLower) ||
            token.authorName.toLowerCase().includes(searchLower)
          );
        }
        
        // 应用标签过滤
        if (filter === 'trending') {
          tokens = tokens.filter(token => token.priceChange24h > 0);
        } else if (filter === 'new') {
          // 这里应该根据创建时间排序，但由于没有该数据，暂时按持有人数排序
          tokens = tokens.sort((a, b) => b.holders - a.holders);
        }
        
        // 应用排序
        tokens = tokens.sort((a, b) => {
          let comparison = 0;
          
          switch (sort) {
            case 'price':
              comparison = parseFloat(a.price) - parseFloat(b.price);
              break;
            case 'priceChange':
              comparison = a.priceChange24h - b.priceChange24h;
              break;
            case 'volume':
              comparison = parseFloat(a.volume24h) - parseFloat(b.volume24h);
              break;
            case 'marketCap':
              comparison = parseFloat(a.marketCap) - parseFloat(b.marketCap);
              break;
            case 'holders':
              comparison = a.holders - b.holders;
              break;
            default:
              comparison = 0;
          }
          
          return order === 'asc' ? comparison : -comparison;
        });
        
        // 构建分页元数据
        const totalPages = Math.ceil(tokenCount.toNumber() / limit);
        
        return NextResponse.json({
          tokens,
          pagination: {
            page,
            limit,
            totalTokens: tokenCount.toNumber(),
            totalPages
          }
        });
      }
    } catch (error) {
      console.log('Failed to get real tokens, using mock data instead:', error);
      // 如果区块链访问失败，继续使用模拟数据
    }
    
    // 使用模拟数据
    let tokens = [...MOCK_TOKENS];
    
    // 应用搜索过滤
    if (search) {
      const searchLower = search.toLowerCase();
      tokens = tokens.filter(token => 
        token.name.toLowerCase().includes(searchLower) ||
        token.symbol.toLowerCase().includes(searchLower) ||
        token.authorName.toLowerCase().includes(searchLower)
      );
    }
    
    // 应用标签过滤
    if (filter === 'trending') {
      tokens = tokens.filter(token => token.priceChange24h > 0);
    } else if (filter === 'new') {
      // 按持有人数排序作为"最新"的替代
      tokens = tokens.sort((a, b) => b.holders - a.holders);
    } else if (filter === 'following') {
      // 模拟"关注"标签，随机选择3个代币
      tokens = tokens.sort(() => 0.5 - Math.random()).slice(0, 3);
    }
    
    // 应用排序
    tokens = tokens.sort((a, b) => {
      let comparison = 0;
      
      switch (sort) {
        case 'price':
          comparison = parseFloat(a.price) - parseFloat(b.price);
          break;
        case 'priceChange':
          comparison = a.priceChange24h - b.priceChange24h;
          break;
        case 'volume':
          comparison = parseFloat(a.volume24h) - parseFloat(b.volume24h);
          break;
        case 'marketCap':
          comparison = parseFloat(a.marketCap) - parseFloat(b.marketCap);
          break;
        case 'holders':
          comparison = a.holders - b.holders;
          break;
        default:
          comparison = 0;
      }
      
      return order === 'asc' ? comparison : -comparison;
    });
    
    // 计算分页
    const startIndex = (page - 1) * limit;
    const endIndex = Math.min(startIndex + limit, tokens.length);
    const paginatedTokens = tokens.slice(startIndex, endIndex);
    
    // 构建分页元数据
    const totalPages = Math.ceil(tokens.length / limit);
    
    return NextResponse.json({
      tokens: paginatedTokens,
      pagination: {
        page,
        limit,
        totalTokens: tokens.length,
        totalPages
      }
    });

  } catch (error) {
    console.error('Error fetching token market:', error);
    return NextResponse.json({ error: 'Failed to fetch token market' }, { status: 500 });
  }
} 