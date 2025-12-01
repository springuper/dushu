import bcrypt from 'bcrypt'
import { prisma } from '../src/lib/prisma'

async function createAdmin() {
  const username = process.argv[2] || 'admin'
  const password = process.argv[3] || 'admin123'

  // 检查是否已存在
  const existing = await prisma.admin.findUnique({
    where: { username },
  })

  if (existing) {
    console.log(`管理员 ${username} 已存在`)
    process.exit(0)
  }

  // 加密密码
  const passwordHash = await bcrypt.hash(password, 10)

  // 创建管理员
  const admin = await prisma.admin.create({
    data: {
      username,
      passwordHash,
    },
  })

  console.log(`✅ 管理员创建成功:`)
  console.log(`   用户名: ${admin.username}`)
  console.log(`   ID: ${admin.id}`)
  console.log(`\n⚠️  请在生产环境中修改默认密码！`)

  await prisma.$disconnect()
}

createAdmin().catch((error) => {
  console.error('创建管理员失败:', error)
  process.exit(1)
})

