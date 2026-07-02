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

  // 5. Sample announcements for the public news page
  const annCount = await prisma.announcement.count();
  if (annCount === 0) {
    await prisma.announcement.createMany({
      data: [
        {
          title: 'NexTradePro launches advanced order book & limit orders',
          body: 'The trading terminal now features a live order book, market and limit order types, and an open-orders panel with instant cancellation.',
          category: 'UPDATE',
        },
        {
          title: 'Bitcoin reclaims key level as market sentiment turns bullish',
          body: 'BTC pushed higher this week amid rising volumes across major pairs. The Fear & Greed index moved back into Greed territory.',
          category: 'MARKET',
        },
        {
          title: 'Enable two-factor authentication for extra account security',
          body: 'We strongly recommend enabling 2FA in Settings → Security to protect your account with an additional verification layer.',
          category: 'SECURITY',
        },
        {
          title: 'Pro plan free trial — unlock AI insights & copy trading',
          body: 'For a limited time, new users can trial the Pro plan free and access AI trade insights, futures tools and copy trading.',
          category: 'PROMOTION',
        },
      ],
    });
  }

  // 6. Referral codes + demo notifications for existing users
  const allUsers = await prisma.user.findMany({ select: { id: true, referralCode: true } });
  for (const u of allUsers) {
    if (!u.referralCode) {
      await prisma.user.update({
        where: { id: u.id },
        data: { referralCode: `NXP${u.id.slice(-6).toUpperCase()}` },
      });
    }
  }
  if (trader) {
    const notifCount = await prisma.notification.count({ where: { userId: trader.id } });
    if (notifCount === 0) {
      await prisma.notification.createMany({
        data: [
          { userId: trader.id, title: 'Welcome to NexTradePro 🎉', body: 'Your demo account is ready.', type: 'SUCCESS' },
          { userId: trader.id, title: 'BTC up 3.2% today', body: 'Bitcoin is leading the market higher.', type: 'TRADE' },
          { userId: trader.id, title: 'Secure your account', body: 'Enable 2FA in Settings → Security.', type: 'WARNING' },
        ],
      });
    }
  }

  // 7. Feature flags
  const flags = [
    { key: 'copy_trading', label: 'Copy Trading', description: 'Enable the copy-trading module.', enabled: true },
    { key: 'ai_assistant', label: 'AI Assistant', description: 'Enable the AI trading assistant.', enabled: true },
    { key: 'futures', label: 'Futures Trading', description: 'Allow leveraged futures trading.', enabled: true },
    { key: 'maintenance_mode', label: 'Maintenance Mode', description: 'Put the platform into maintenance.', enabled: false },
    { key: 'new_signups', label: 'New Signups', description: 'Allow new user registrations.', enabled: true },
  ];
  for (const f of flags) {
    await prisma.featureFlag.upsert({ where: { key: f.key }, create: f, update: { label: f.label, description: f.description } });
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
