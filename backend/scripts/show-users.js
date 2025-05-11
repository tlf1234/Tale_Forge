// 显示用户表信息
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function showUsers() {
  try {
    // 获取所有用户
    const users = await prisma.user.findMany();
    
    console.log(`总用户数: ${users.length}`);
    
    // 为了避免输出过多，只打印前10个用户
    const usersToShow = users.slice(0, 10);
    
    // 打印用户信息，不包含密码等敏感信息
    usersToShow.forEach((user, index) => {
      console.log(`--- 用户 ${index + 1} ---`);
      console.log(`ID: ${user.id}`);
      console.log(`地址: ${user.address}`);
      console.log(`邮箱: ${user.email}`);
      console.log(`笔名: ${user.authorName}`);
      console.log(`昵称: ${user.nickname}`);
      console.log(`类型: ${user.type}`);
      console.log(`认证类型: ${user.authType}`);
      console.log('------------------------');
    });
    
  } catch (error) {
    console.error('查询时出错:', error);
  } finally {
    await prisma.$disconnect();
  }
}

showUsers(); 