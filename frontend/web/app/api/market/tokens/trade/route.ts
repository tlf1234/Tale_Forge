import { NextResponse } from 'next/server';
import { ethers } from 'ethers';
import { getProvider, getSigner } from '@/lib/contract';
import { CONTRACT_ADDRESSES, TOKEN_ABIS } from '@/constants/contracts';

// 定义类型
interface TokenInfo {
  name: string;
  symbol: string;
  price: string;
}

interface UserTokenBalances {
  [tokenAddress: string]: string;
}

interface UserBalance {
  bnb: string;
  tokens: UserTokenBalances;
}

interface UserBalances {
  [userAddress: string]: UserBalance;
}

// 模拟代币数据
const MOCK_TOKENS: Record<string, TokenInfo> = {
  '0x1234567890123456789012345678901234567890': { name: '幻世录代币', symbol: 'HSL', price: '0.0082' },
  '0x2345678901234567890123456789012345678901': { name: '星辰大海代币', symbol: 'XCDH', price: '0.0156' },
  '0x3456789012345678901234567890123456789012': { name: '都市传说代币', symbol: 'DSCS', price: '0.0034' },
  '0x4567890123456789012345678901234567890123': { name: '玄幻世界代币', symbol: 'XHSJ', price: '0.0092' },
  '0x5678901234567890123456789012345678901234': { name: '仙侠传奇代币', symbol: 'XXCQ', price: '0.0215' },
  '0x6789012345678901234567890123456789012345': { name: '科幻未来代币', symbol: 'KHWL', price: '0.0068' },
  '0x7890123456789012345678901234567890123456': { name: '历史长河代币', symbol: 'LSCH', price: '0.0047' },
  '0x8901234567890123456789012345678901234567': { name: '奇幻世界代币', symbol: 'QHSJ', price: '0.0128' },
  '0x9012345678901234567890123456789012345678': { name: '青春校园代币', symbol: 'QCXY', price: '0.0052' },
  '0x0123456789012345678901234567890123456789': { name: '悬疑推理代币', symbol: 'XYTL', price: '0.0073' }
};

// 模拟用户余额数据
const MOCK_USER_BALANCES: UserBalances = {};

/**
 * 处理代币交易请求
 * @route POST /api/market/tokens/trade
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { tokenAddress, tradeType, amount, userAddress } = body;

    if (!tokenAddress || !tradeType || !amount || !userAddress) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    if (tradeType !== 'buy' && tradeType !== 'sell') {
      return NextResponse.json({ error: 'Invalid trade type' }, { status: 400 });
    }

    if (parseFloat(amount) <= 0) {
      return NextResponse.json({ error: 'Amount must be greater than 0' }, { status: 400 });
    }

    // 尝试使用真实区块链数据
    try {
      const signer = await getSigner();
      const signerAddress = await signer.getAddress();
      
      // 检查调用者是否为用户本人
      if (signerAddress.toLowerCase() !== userAddress.toLowerCase()) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }

      // 获取代币合约实例
      const tokenContract = new ethers.Contract(
        tokenAddress,
        TOKEN_ABIS.AuthorToken,
        signer
      );

      // 获取代币信息
      const tokenName = await tokenContract.name();
      const tokenSymbol = await tokenContract.symbol();
      
      // 这里应该连接到DEX合约进行实际交易
      // 当前为模拟实现
      
      // 模拟交易延迟
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // 构建响应数据
      const responseData = {
        success: true,
        transactionHash: '0x' + Math.random().toString(16).substring(2, 66),
        tokenName,
        tokenSymbol,
        amount,
        tradeType,
        timestamp: new Date().toISOString()
      };
      
      return NextResponse.json(responseData);
    } catch (error) {
      console.log('Failed to process trade with real blockchain, using mock data:', error);
      // 如果区块链交易失败，使用模拟数据
    }
    
    // 使用模拟数据
    // 检查代币是否存在
    if (!MOCK_TOKENS[tokenAddress]) {
      return NextResponse.json({ error: 'Token not found' }, { status: 404 });
    }
    
    const tokenInfo = MOCK_TOKENS[tokenAddress];
    
    // 初始化用户余额
    if (!MOCK_USER_BALANCES[userAddress]) {
      MOCK_USER_BALANCES[userAddress] = {
        bnb: '10.0', // 默认给用户10个BNB
        tokens: {}
      };
    }
    
    // 初始化用户代币余额
    if (!MOCK_USER_BALANCES[userAddress].tokens[tokenAddress]) {
      MOCK_USER_BALANCES[userAddress].tokens[tokenAddress] = '0';
    }
    
    // 处理交易
    const numAmount = parseFloat(amount);
    const tokenPrice = parseFloat(tokenInfo.price);
    const cost = numAmount * tokenPrice;
    
    if (tradeType === 'buy') {
      // 检查BNB余额
      const bnbBalance = parseFloat(MOCK_USER_BALANCES[userAddress].bnb);
      if (bnbBalance < cost) {
        return NextResponse.json({ error: 'Insufficient BNB balance' }, { status: 400 });
      }
      
      // 更新余额
      MOCK_USER_BALANCES[userAddress].bnb = (bnbBalance - cost).toFixed(4);
      const newTokenBalance = parseFloat(MOCK_USER_BALANCES[userAddress].tokens[tokenAddress]) + numAmount;
      MOCK_USER_BALANCES[userAddress].tokens[tokenAddress] = newTokenBalance.toString();
    } else { // sell
      // 检查代币余额
      const tokenBalance = parseFloat(MOCK_USER_BALANCES[userAddress].tokens[tokenAddress]);
      if (tokenBalance < numAmount) {
        return NextResponse.json({ error: 'Insufficient token balance' }, { status: 400 });
      }
      
      // 更新余额
      MOCK_USER_BALANCES[userAddress].tokens[tokenAddress] = (tokenBalance - numAmount).toString();
      const newBnbBalance = parseFloat(MOCK_USER_BALANCES[userAddress].bnb) + cost;
      MOCK_USER_BALANCES[userAddress].bnb = newBnbBalance.toFixed(4);
    }
    
    // 模拟交易延迟
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // 构建响应数据
    const responseData = {
      success: true,
      transactionHash: '0x' + Math.random().toString(16).substring(2, 66),
      tokenName: tokenInfo.name,
      tokenSymbol: tokenInfo.symbol,
      amount,
      tradeType,
      timestamp: new Date().toISOString()
    };
    
    return NextResponse.json(responseData);
  } catch (error) {
    console.error('Error processing trade:', error);
    return NextResponse.json({ error: 'Failed to process trade' }, { status: 500 });
  }
}

/**
 * 获取用户代币余额
 * @route GET /api/market/tokens/trade
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const tokenAddress = searchParams.get('tokenAddress');
    const userAddress = searchParams.get('userAddress');

    if (!tokenAddress || !userAddress) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    // 尝试使用真实区块链数据
    try {
      const provider = getProvider();
      
      // 获取代币合约实例
      const tokenContract = new ethers.Contract(
        tokenAddress,
        TOKEN_ABIS.AuthorToken,
        provider
      );

      // 获取用户代币余额
      const balance = await tokenContract.balanceOf(userAddress);
      
      // 获取BNB余额
      const bnbBalance = await provider.getBalance(userAddress);
      
      // 获取代币信息
      const tokenName = await tokenContract.name();
      const tokenSymbol = await tokenContract.symbol();
      
      // 构建响应数据
      const responseData = {
        tokenBalance: ethers.utils.formatEther(balance),
        bnbBalance: ethers.utils.formatEther(bnbBalance),
        tokenName,
        tokenSymbol
      };
      
      return NextResponse.json(responseData);
    } catch (error) {
      console.log('Failed to get balances from blockchain, using mock data:', error);
      // 如果区块链访问失败，使用模拟数据
    }
    
    // 使用模拟数据
    // 检查代币是否存在
    if (!MOCK_TOKENS[tokenAddress]) {
      return NextResponse.json({ error: 'Token not found' }, { status: 404 });
    }
    
    const tokenInfo = MOCK_TOKENS[tokenAddress];
    
    // 初始化用户余额
    if (!MOCK_USER_BALANCES[userAddress]) {
      MOCK_USER_BALANCES[userAddress] = {
        bnb: '10.0', // 默认给用户10个BNB
        tokens: {}
      };
    }
    
    // 初始化用户代币余额
    if (!MOCK_USER_BALANCES[userAddress].tokens[tokenAddress]) {
      MOCK_USER_BALANCES[userAddress].tokens[tokenAddress] = '0';
    }
    
    // 构建响应数据
    const responseData = {
      tokenBalance: MOCK_USER_BALANCES[userAddress].tokens[tokenAddress],
      bnbBalance: MOCK_USER_BALANCES[userAddress].bnb,
      tokenName: tokenInfo.name,
      tokenSymbol: tokenInfo.symbol
    };
    
    return NextResponse.json(responseData);
  } catch (error) {
    console.error('Error getting balance:', error);
    return NextResponse.json({ error: 'Failed to get balance' }, { status: 500 });
  }
} 