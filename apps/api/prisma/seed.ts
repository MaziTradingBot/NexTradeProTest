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

  // 3. Only the Super Admin is seeded. All other accounts (traders, brokers,
  //    role-admins) are created by real registration and assigned roles by the
  //    Super Admin — no fake/demo people are auto-generated.
  const demoUsers: { email: string; fullName: string; roleKeys: string[]; kyc?: boolean }[] = [
    { email: 'super@nextradepro.com', fullName: 'Super Admin', roleKeys: ['SUPER_ADMIN'] },
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

  // (No fake transactions/KYC are seeded — the admin queues start empty and
  //  fill from real user activity.)

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

  // 6. Ensure the super admin has a referral code
  const allUsers = await prisma.user.findMany({ select: { id: true, referralCode: true } });
  for (const u of allUsers) {
    if (!u.referralCode) {
      await prisma.user.update({
        where: { id: u.id },
        data: { referralCode: `NXP${u.id.slice(-6).toUpperCase()}` },
      });
    }
  }

  // 7. Feature flags
  const flags = [
    { key: 'copy_trading', label: 'Copy Trading', description: 'Enable the copy-trading module.', enabled: true },
    { key: 'ai_assistant', label: 'AI Assistant', description: 'Enable the AI trading assistant.', enabled: true },
    { key: 'futures', label: 'Futures Trading', description: 'Allow leveraged futures trading.', enabled: true },
    { key: 'live_trading', label: 'Live Trading (activation)', description: 'Activate order placement in Live mode for funded live accounts.', enabled: false },
    { key: 'maintenance_mode', label: 'Maintenance Mode', description: 'Put the platform into maintenance.', enabled: false },
    { key: 'new_signups', label: 'New Signups', description: 'Allow new user registrations.', enabled: true },
  ];
  for (const f of flags) {
    await prisma.featureFlag.upsert({ where: { key: f.key }, create: f, update: { label: f.label, description: f.description } });
  }

  // 8. Demo deposit wallet addresses (per asset/network)
  const addresses = [
    { asset: 'BTC', network: 'Bitcoin', address: 'bc1qdemo9x7k2p4nxtradepro8sq5m3vz6h0demoaddr', minDeposit: '0.0005', confirmations: 2, isDefault: true },
    { asset: 'ETH', network: 'ERC20', address: '0xDEMoNexTradePro1234567890AbCdEf1234567890', minDeposit: '0.01', confirmations: 12, isDefault: true },
    { asset: 'USDT', network: 'ERC20', address: '0xDEMoUSDTeRc20NexTradePro0987654321FeDcBa00', minDeposit: '10', confirmations: 12, isDefault: true },
    { asset: 'USDT', network: 'TRC20', address: 'TDemoUSDTtrc20NexTradePro9f8e7d6c5b4a3210xy', minDeposit: '10', confirmations: 20 },
    { asset: 'USDT', network: 'BEP20', address: '0xDEMoUSDTbep20NexTradePro5566778899aabbccddee', minDeposit: '10', confirmations: 15 },
    { asset: 'USDC', network: 'ERC20', address: '0xDEMoUSDCeRc20NexTradePro1122334455667788990a', minDeposit: '10', confirmations: 12, isDefault: true },
    { asset: 'BNB', network: 'BEP20', address: '0xDEMoBNBbep20NexTradeProaabbccdd11223344556677', minDeposit: '0.05', confirmations: 15, isDefault: true },
    { asset: 'SOL', network: 'Solana', address: 'DemoSoLNexTradePro1111222233334444555566667777', minDeposit: '0.1', confirmations: 32, isDefault: true },
    { asset: 'XRP', network: 'XRP Ledger', address: 'rDemoXRPnexTradePro1234567890abcdef', minDeposit: '10', confirmations: 4, isDefault: true },
    { asset: 'ADA', network: 'Cardano', address: 'addr1demoNexTradeProadacardano9f8e7d6c5b4a3210', minDeposit: '10', confirmations: 15, isDefault: true },
    { asset: 'DOGE', network: 'Dogecoin', address: 'DDemoDOGEnexTradePro1234567890abcdefghij', minDeposit: '20', confirmations: 20, isDefault: true },
    { asset: 'LTC', network: 'Litecoin', address: 'ltc1qdemoNexTradeProltc9x7k2p4sq5m3vz6h0addr', minDeposit: '0.05', confirmations: 6, isDefault: true },
    { asset: 'AVAX', network: 'C-Chain', address: '0xDEMoAVAXcchainNexTradePro778899aabbccddeeff00', minDeposit: '0.1', confirmations: 12, isDefault: true },
    { asset: 'MATIC', network: 'Polygon', address: '0xDEMoMATICpolygonNexTradePro33445566778899aabb', minDeposit: '1', confirmations: 30, isDefault: true },
  ];
  for (const a of addresses) {
    await prisma.walletAddress.upsert({
      where: { asset_network: { asset: a.asset, network: a.network } },
      create: { ...a, instructions: `Send only ${a.asset} via ${a.network} to this address. Demo address — do not send real funds.` },
      update: { address: a.address, minDeposit: a.minDeposit, confirmations: a.confirmations },
    });
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
