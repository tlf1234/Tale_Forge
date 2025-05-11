// 查找重复邮箱的脚本
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function findDuplicateEmails() {
  try {
    // 查询重复的邮箱
    const result = await prisma.$queryRaw`
      SELECT email, COUNT(*) as count 
      FROM "User" 
      WHERE email IS NOT NULL 
      GROUP BY email 
      HAVING COUNT(*) > 1
    `;
    
    console.log('查找到的重复邮箱:');
    console.log(result);
    
    if (result.length === 0) {
      console.log('没有找到重复的邮箱，但可能存在NULL值或空字符串');
      
      // 查询NULL和空邮箱的用户数量
      const nullEmails = await prisma.user.count({
        where: {
          email: null
        }
      });
      
      const emptyEmails = await prisma.user.count({
        where: {
          email: ''
        }
      });
      
      console.log(`邮箱为NULL的用户数: ${nullEmails}`);
      console.log(`邮箱为空字符串的用户数: ${emptyEmails}`);
    }
  } catch (error) {
    console.error('查询时出错:', error);
  } finally {
    await prisma.$disconnect();
  }
}

findDuplicateEmails(); 