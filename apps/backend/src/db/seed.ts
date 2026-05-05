import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcrypt'

const prisma = new PrismaClient()

async function main() {
  const passwordHash = await bcrypt.hash('password123', 12)

  const ward = await prisma.ward.upsert({
    where: { code: 'WARD-A' },
    update: {},
    create: { name: 'Ward A — General Medicine', code: 'WARD-A', totalBeds: 30 },
  })

  const admin = await prisma.user.upsert({
    where: { email: 'admin@medlog.local' },
    update: {},
    create: {
      email: 'admin@medlog.local',
      name: 'System Admin',
      role: 'ADMIN',
      passwordHash,
    },
  })

  const consultant = await prisma.user.upsert({
    where: { email: 'consultant@medlog.local' },
    update: {},
    create: {
      email: 'consultant@medlog.local',
      name: 'Dr. Sarah Ahmed',
      role: 'CONSULTANT',
      passwordHash: '$2b$10$placeholder',
    },
  })

  const team = await prisma.team.upsert({
    where: { id: 'seed-team-01' },
    update: {},
    create: {
      id: 'seed-team-01',
      name: 'General Medicine Team A',
      members: { connect: [{ id: consultant.id }] },
    },
  })

  console.warn('Seed complete:', { ward: ward.code, admin: admin.email, consultant: consultant.email, team: team.name })
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
