import express, { Request } from 'express'
import { AuthService } from '../services/auth.service'

const router = express.Router()
const authService = new AuthService()

/**
 * 
 主要是处理用户登录、注册、关联钱包和邮箱等操作。单独的认证路由，不与用户路由混合。
 */

// 自定义Request类型，包含user属性但不再使用
interface AuthRequest extends Request {
  user?: {
    userId: string;
    address?: string;
    email?: string;
  };
}

// 钱包认证
router.post('/wallet', async (req, res) => {
  try {
    const { address } = req.body
    
    if (!address) {
      return res.status(400).json({ error: '缺少钱包地址' })
    }
    
    const result = await authService.walletAuth(address)
    
    // 确保只返回实际存在的属性
    res.json({
      success: true,
      token: result.token,
      user: {
        id: result.user.id,
        address: result.user.address,
        nickname: result.user.nickname,
        avatar: result.user.avatar,
        isAuthor: result.user.isAuthor,
        type: result.user.type,
        email: result.user.email
      }
    })
  } catch (error: any) {
    res.status(500).json({ error: error.message || '服务器错误' })
  }
})

// 邮箱注册
router.post('/register', async (req, res) => {
  try {
    const { email, password, nickname } = req.body
    
    if (!email || !password) {
      return res.status(400).json({ error: '缺少必要参数' })
    }
    
    const user = await authService.registerWithEmail(email, password, nickname)
    
    res.json({
      success: true,
      message: '注册成功',
      user: {
        id: user.id,
        email: user.email,
        nickname: user.nickname
      }
    })
  } catch (error: any) {
    if (error.message === '该邮箱已被注册') {
      return res.status(400).json({ error: error.message })
    }
    res.status(500).json({ error: error.message || '服务器错误' })
  }
})

// 邮箱登录
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body
    
    if (!email || !password) {
      return res.status(400).json({ error: '缺少必要参数' })
    }
    
    const result = await authService.emailAuth(email, password)
    
    // 确保只返回实际存在的属性
    res.json({
      success: true,
      token: result.token,
      user: {
        id: result.user.id,
        email: result.user.email,
        nickname: result.user.nickname,
        avatar: result.user.avatar,
        isAuthor: result.user.isAuthor,
        type: result.user.type,
        address: result.user.address
      }
    })
  } catch (error: any) {
    res.status(401).json({ error: error.message || '登录失败' })
  }
})

// 关联钱包到邮箱账号
router.post('/link/wallet', async (req, res) => {
  try {
    const { address } = req.body
    
    // 使用统一认证方法
    try {
      const { user, userId } = await authService.authenticateUser({
        address: req.body.address,
        userId: req.body.userId,
        token: req.headers.authorization?.replace('Bearer ', '')
      });
      
      if (!address) {
        return res.status(400).json({ error: '缺少钱包地址' })
      }
      
      // 关联钱包
      const updatedUser = await authService.linkWalletToEmail(userId, address)
      
      // 确保只返回实际存在的属性
      res.json({
        success: true,
        message: '关联成功',
        user: {
          id: updatedUser.id,
          email: updatedUser.email,
          address: updatedUser.address
        }
      })
    } catch (authError) {
      console.error('关联钱包认证失败:', authError);
      res.status(401).json({ error: (authError as Error).message || '认证失败' });
    }
  } catch (error: any) {
    res.status(400).json({ error: error.message || '关联失败' })
  }
})

// 关联邮箱到钱包账号
router.post('/link/email', async (req, res) => {
  try {
    const { email, password } = req.body
    
    // 使用统一认证方法
    try {
      const { user, userId } = await authService.authenticateUser({
        address: req.body.address,
        userId: req.body.userId,
        token: req.headers.authorization?.replace('Bearer ', '')
      });
      
      if (!email || !password) {
        return res.status(400).json({ error: '缺少必要参数' })
      }
      
      // 关联邮箱
      const updatedUser = await authService.linkEmailToWallet(userId, email, password)
      
      // 确保只返回实际存在的属性
      res.json({
        success: true,
        message: '关联成功',
        user: {
          id: updatedUser.id,
          email: updatedUser.email,
          address: updatedUser.address
        }
      })
    } catch (authError) {
      console.error('关联邮箱认证失败:', authError);
      res.status(401).json({ error: (authError as Error).message || '认证失败' });
    }
  } catch (error: any) {
    res.status(400).json({ error: error.message || '关联失败' })
  }
})

export default router 