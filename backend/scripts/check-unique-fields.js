// 检查唯一约束字段的脚本
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkUniqueFields() {
  try {
    // 检查address字段
    const duplicateAddresses = await prisma.$queryRaw`
      SELECT address, COUNT(*) as count 
      FROM "User" 
      WHERE address IS NOT NULL 
      GROUP BY address 
      HAVING COUNT(*) > 1
    `;
    
    // 检查authorName字段
    const duplicateAuthorNames = await prisma.$queryRaw`
      SELECT "authorName", COUNT(*) as count 
      FROM "User" 
      WHERE "authorName" IS NOT NULL 
      GROUP BY "authorName" 
      HAVING COUNT(*) > 1
    `;
    
    // 检查email字段
    const duplicateEmails = await prisma.$queryRaw`
      SELECT email, COUNT(*) as count 
      FROM "User" 
      WHERE email IS NOT NULL 
      GROUP BY email 
      HAVING COUNT(*) > 1
    `;
    
    console.log('重复的钱包地址:');
    console.log(duplicateAddresses);
    
    console.log('重复的作者笔名:');
    console.log(duplicateAuthorNames);
    
    console.log('重复的邮箱:');
    console.log(duplicateEmails);
    
    // 直接计算NULL值的数量
    const nullAddresses = await prisma.user.count({ where: { address: null } });
    const nullAuthorNames = await prisma.user.count({ where: { authorName: null } });
    const nullEmails = await prisma.user.count({ where: { email: null } });
    
    console.log('NULL值统计:');
    console.log(`address 为 NULL 的记录数: ${nullAddresses}`);
    console.log(`authorName 为 NULL 的记录数: ${nullAuthorNames}`);
    console.log(`email 为 NULL 的记录数: ${nullEmails}`);
    
    // 获取所有用户数据进行检查
    const allUsers = await prisma.user.findMany({
      select: {
        id: true,
        address: true,
        authorName: true,
        email: true
      }
    });
    
    console.log('总用户数:', allUsers.length);
    console.log('用户数据样本:', allUsers);
    
  } catch (error) {
    console.error('查询时出错:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkUniqueFields(); 