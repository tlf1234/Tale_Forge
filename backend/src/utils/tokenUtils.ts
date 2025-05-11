import jwt from 'jsonwebtoken';

// JWT密钥，应从环境变量中获取
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// 验证令牌
export const verifyToken = async (token: string): Promise<{ userId: string, address?: string }> => {
  return new Promise((resolve, reject) => {
    jwt.verify(token, JWT_SECRET, (err, decoded) => {
      if (err) {
        reject(new Error('无效的令牌'));
      } else {
        resolve(decoded as { userId: string, address?: string });
      }
    });
  });
}; 