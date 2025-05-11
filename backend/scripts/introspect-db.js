// 查看现有数据库的结构
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function introspectDb() {
  try {
    // 查询数据库中的表
    const tables = await prisma.$queryRaw`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `;
    
    console.log('数据库中的表:');
    console.log(tables);
    
    // 查询User表的列
    const userColumns = await prisma.$queryRaw`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'User'
    `;
    
    console.log('\nUser表的列:');
    console.log(userColumns);
    
  } catch (error) {
    console.error('查询时出错:', error);
  } finally {
    await prisma.$disconnect();
  }
}

introspectDb(); 