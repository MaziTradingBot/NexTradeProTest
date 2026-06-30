import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { PERMISSIONS, ROLES } from '../src/lib/rbac';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding NexTradePro...');

  // 1. Permissions
  for (const [key, def] of Object.entries(PERMISSIONS)) {
    await prisma.permission.upsert({
      where: { key },
      create: { key, name: def.name, group: def.group },
      update: { name: def.name, group: def.group },
    });
  }
  const allPerms = await prisma.permission.findMany();
  const permByKey = new Map(allPerms.map((p) => [p.key, p]));

  // 2. Roles + their permissions
  for (const role of ROLES) {
    const created = await prisma.role.upsert({
      where: { key: role.key },
      create: {
        key: role.key,
        name: role.name,
        description: role.description,
        isAdmin: role.isAdmin,
        isSystem: role.isSystem,
      },
      update: { name: role.name, description: role.description, isAdmin: role.isAdmin },
    });

    const keys = role.permissions === '*' ? allPerms.map((p) => p.key) : role.permissions;
    await prisma.rolePermission.deleteMany({ where: { roleId: created.id } });
    for (const k of keys) {
      const perm = permByKey.get(k);
      if (perm) {
        await prisma.rolePermission.create({ data: { roleId: created.id, permissionId: perm.id } });
      }
    }
  }

  const roleByKey = new Map((await prisma.role.findMany()).map((r) => [r.key, r]));
  const pw = await bcrypt.hash('Password123!', 12);

  // 3. Demo users with assorted admin roles
  const demoUsers: { email: string; fullName: string; roleKeys: string[]; kyc?: boolean }[] = [
    { email: 'super@nextradepro.com', fullName: 'Sofia Reyes', roleKeys: ['SUPER_ADMIN'] },
    { email: 'general@nextradepro.com', fullName: 'Marcus Bell', roleKeys: ['GENERAL_ADMIN'] },
    { email: 'withdrawals@nextradepro.com', fullName: 'Aisha Khan', roleKeys: ['WITHDRAWAL_ADMIN'] },
    { email: 'kyc@nextradepro.com', fullName: 'Diego Santos', roleKeys: ['KYC_ADMIN'] },
    { email: 'support@nextradepro.com', fullName: 'Lena Wagner', roleKeys: ['SUPPORT_ADMIN'] },
    { email: 'trader@nextradepro.com', fullName: 'Jordan Price', roleKeys: ['USER'], kyc: true },
  ];

  for (const du of demoUsers) {
    const user = await prisma.user.upsert({
      where: { email: du.email },
      create: {
        email: du.email,
        passwordHash: pw,
        fullName: du.fullName,
        kycStatus: du.kyc ? 'APPROVED' : 'NONE',
        wallets: {
          create: [
            { asset: 'USDT', balance: 50000 },
            { asset: 'BTC', balance: 0.75 },
            { asset: 'ETH', balance: 8 },
          ],
        },
      },
      update: { fullName: du.fullName },
    });

    for (const rk of du.roleKeys) {
      const role = roleByKey.get(rk);
      if (role) {
        await prisma.userRole.upsert({
          where: { userId_roleId: { userId: user.id, roleId: role.id } },
          create: { userId: user.id, roleId: role.id },
          update: {},
        });
      }
    }
  }

  // 4. Some pending withdrawals + KYC for the admin queues
  const trader = await prisma.user.findUnique({ where: { email: 'trader@nextradepro.com' } });
  if (trader) {
    const count = await prisma.transaction.count({ where: { userId: trader.id, type: 'WITHDRAWAL' } });
    if (count === 0) {
      await prisma.transaction.createMany({
        data: [
          { userId: trader.id, type: 'WITHDRAWAL', asset: 'USDT', amount: 1200, status: 'PENDING', reference: 'WD-1001' },
          { userId: trader.id, type: 'WITHDRAWAL', asset: 'BTC', amount: 0.05, status: 'PENDING', reference: 'WD-1002' },
          { userId: trader.id, type: 'DEPOSIT', asset: 'USDT', amount: 5000, status: 'COMPLETED', reference: 'DP-2001' },
        ],
      });
    }
    await prisma.user.update({ where: { id: trader.id }, data: { kycStatus: 'PENDING' } });
  }

  console.log('✅ Seed complete.');
  console.log('   Super Admin login: super@nextradepro.com / Password123!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
