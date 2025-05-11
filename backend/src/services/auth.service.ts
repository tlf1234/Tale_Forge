import prisma from '../prisma'
import bcrypt from 'bcrypt'
import { v4 as uuidv4 } from 'uuid'
import { User } from '@prisma/client'
import jwt from 'jsonwebtoken'

// JWT配置
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key'
const JWT_EXPIRES_IN = '7d'

export class AuthService {
  /**
   * 创建JWT令牌
   */
  createToken(user: User): string {
    const payload = {
      userId: user.id,
      address: user.address,
      email: user.email
    }
    return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN })
  }

  /**
   * 钱包地址验证 - 仅检查地址
   * 无需复杂的签名验证，与现有系统保持一致
   */
  async walletAuth(address: string): Promise<{ user: User; token: string }> {
    // 规范化地址
    const normalizedAddress = address.toLowerCase()
    
    console.log('[认证服务] 开始通过钱包地址验证用户:', {
      originalAddress: address,
      normalizedAddress: normalizedAddress
    });
    
    // 查找或创建用户 - 使用不区分大小写的方式查询
    const existingUser = await prisma.user.findFirst({
      where: {
        address: {
          mode: 'insensitive',
          equals: normalizedAddress,
        }
      }
    });
    
    let user: User;
    
    if (existingUser) {
      console.log('[认证服务] 找到现有用户:', {
        userId: existingUser.id,
        storedAddress: existingUser.address,
        normalizedAddress
      });
      
      // 如果找到匹配的用户，确保地址格式统一
      if (existingUser.address !== normalizedAddress) {
        console.log('[认证服务] 更新用户钱包地址格式以保持一致');
        user = await prisma.user.update({
          where: { id: existingUser.id },
          data: { address: normalizedAddress }
        });
      } else {
        user = existingUser;
      }
    } else {
      // 创建新用户
      console.log('[认证服务] 未找到用户，创建新用户');
      user = await prisma.user.create({
        data: { address: normalizedAddress }
      });
      console.log('[认证服务] 新用户创建成功:', { userId: user.id, address: user.address });
    }
    
    // 创建访问令牌
    const token = this.createToken(user)
    
    console.log('[认证服务] 钱包验证完成, 返回用户信息和令牌');
    
    return { user, token }
  }

  /**
   * 邮箱注册
   */
  async registerWithEmail(email: string, password: string, nickname?: string): Promise<User> {
    // 检查邮箱是否已存在
    const existingUser = await prisma.user.findUnique({
      where: { email }
    })
    
    if (existingUser) {
      throw new Error('该邮箱已被注册')
    }
    
    // 哈希密码
    const hashedPassword = await bcrypt.hash(password, 10)
    
    // 创建用户
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        nickname
      }
    })
    
    return user
  }

  /**
   * 邮箱登录
   */
  async emailAuth(email: string, password: string): Promise<{ user: User; token: string }> {
    const user = await prisma.user.findUnique({
      where: { email }
    })
    
    if (!user || !user.password) {
      throw new Error('用户不存在或未设置密码')
    }
    
    // 验证密码
    const isPasswordValid = await bcrypt.compare(password, user.password)
    
    if (!isPasswordValid) {
      throw new Error('密码错误')
    }
    
    // 创建访问令牌
    const token = this.createToken(user)
    
    return { user, token }
  }

  /**
   * 将钱包地址与已有邮箱账号关联
   */
  async linkWalletToEmail(userId: string, address: string): Promise<User> {
    // 规范化地址
    const normalizedAddress = address.toLowerCase()
    
    // 检查地址是否已被其他账号使用
    const existingUser = await prisma.user.findUnique({
      where: { address: normalizedAddress }
    })
    
    if (existingUser && existingUser.id !== userId) {
      throw new Error('该钱包地址已与其他账号关联')
    }
    
    // 更新用户
    const user = await prisma.user.update({
      where: { id: userId },
      data: { 
        address: normalizedAddress
      }
    })
    
    return user
  }

  /**
   * 将邮箱与已有钱包账号关联
   */
  async linkEmailToWallet(userId: string, email: string, password: string): Promise<User> {
    // 检查邮箱是否已被其他账号使用
    const existingUser = await prisma.user.findUnique({
      where: { email }
    })
    
    if (existingUser && existingUser.id !== userId) {
      throw new Error('该邮箱已与其他账号关联')
    }
    
    // 哈希密码
    const hashedPassword = await bcrypt.hash(password, 10)
    
    // 更新用户
    const user = await prisma.user.update({
      where: { id: userId },
      data: { 
        email,
        password: hashedPassword
      }
    })
    
    return user
  }

  /**
   * 验证JWT令牌
   */
  verifyToken(token: string): any {
    try {
      return jwt.verify(token, JWT_SECRET)
    } catch (error) {
      throw new Error('无效的令牌')
    }
  }

  /**
   * 统一用户认证和数据获取函数
   * 可以通过钱包地址、用户ID或认证令牌三种方式获取用户信息
   * @param options 认证选项，可以提供address、userId或token中的一个或多个
   * @returns 认证成功返回用户信息，认证失败抛出错误
   */
  async authenticateUser(options: {
    address?: string;
    userId?: string;
    token?: string;
  }): Promise<{ user: User; userId: string }> {
    console.log('[认证服务] 开始认证用户:', {
      hasAddress: !!options.address,
      hasUserId: !!options.userId,
      hasToken: !!options.token
    });
    
    const { address, userId, token } = options;
    let authenticatedUser: User | null = null;
    let authenticatedUserId = userId;

    // 按照优先级依次验证: userId > token > address
    
    // 1. 通过用户ID验证
    if (authenticatedUserId) {
      console.log('[认证服务] 使用用户ID验证:', authenticatedUserId);
      authenticatedUser = await prisma.user.findUnique({
        where: { id: authenticatedUserId }
      });
      
      if (authenticatedUser) {
        console.log('[认证服务] 用户ID验证成功:', {
          userId: authenticatedUser.id,
          address: authenticatedUser.address,
          hasEmail: !!authenticatedUser.email
        });
        return { user: authenticatedUser, userId: authenticatedUser.id };
      } else {
        console.log('[认证服务] 用户ID验证失败: 用户不存在');
        throw new Error('用户不存在');
      }
    }
    
    // 2. 通过认证令牌验证
    if (token) {
      try {
        console.log('[认证服务] 开始令牌验证, token长度:', token.length);
        const decoded = this.verifyToken(token);
        if (decoded && decoded.userId) {
          authenticatedUserId = decoded.userId;
          console.log('[认证服务] 令牌解析成功, 获取到用户ID:', authenticatedUserId);
          
          authenticatedUser = await prisma.user.findUnique({
            where: { id: authenticatedUserId }
          });
          
          if (authenticatedUser) {
            console.log('[认证服务] 令牌验证成功, 找到用户:', {
              userId: authenticatedUser.id,
              address: authenticatedUser.address
            });
            return { user: authenticatedUser, userId: authenticatedUser.id };
          } else {
            console.log('[认证服务] 令牌验证失败: 令牌有效但用户不存在');
            throw new Error('令牌有效，但用户不存在');
          }
        } else {
          console.log('[认证服务] 令牌验证失败: 令牌无效或不包含用户ID');
          throw new Error('无效的令牌');
        }
      } catch (error) {
        console.error('[认证服务] 令牌验证错误:', {
          error: (error as Error).message,
          stack: (error as Error).stack
        });
        // 如果令牌验证失败但有钱包地址，继续使用钱包地址验证
        if (!address) throw error;
      }
    }
    
    // 3. 通过钱包地址验证
    if (address) {
      console.log('[认证服务] 开始钱包地址验证:', address);
      // 规范化地址
      const normalizedAddress = address.toLowerCase();
      
      authenticatedUser = await prisma.user.findFirst({
        where: {
          address: {
            mode: 'insensitive',
            equals: normalizedAddress
          }
        }
      });
      
      if (authenticatedUser) {
        // 更新地址格式以保持一致性
        if (authenticatedUser.address !== normalizedAddress) {
          authenticatedUser = await prisma.user.update({
            where: { id: authenticatedUser.id },
            data: { address: normalizedAddress }
          });
        }
        
        console.log('[认证服务] 钱包地址验证成功:', {
          userId: authenticatedUser.id,
          address: authenticatedUser.address
        });
        return { user: authenticatedUser, userId: authenticatedUser.id };
      } else {
        // 钱包地址不存在，创建新用户
        console.log('[认证服务] 钱包地址不存在，创建新用户');
        try {
          authenticatedUser = await prisma.user.create({
            data: { address: normalizedAddress }
          });
          console.log('[认证服务] 用户创建成功:', {
            userId: authenticatedUser.id,
            address: authenticatedUser.address
          });
          return { user: authenticatedUser, userId: authenticatedUser.id };
        } catch (error) {
          console.error('[认证服务] 创建用户失败:', error);
          throw error;
        }
      }
    }
    
    // 全部验证失败
    console.log('[认证服务] 全部验证失败: 缺少有效的身份信息');
    throw new Error('认证失败: 缺少有效的身份信息');
  }
} 