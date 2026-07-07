# 11 — Database Schema

PostgreSQL via Prisma (`apps/api/prisma/schema.prisma`). Neon in production (use
the **UNPOOLED** URL for `prisma db push`/migrations).

## 1. Current models (implemented)

**Identity & access**
- `User` — profile, credentials, status, KYC status, `liveTradingEnabled`,
  `tradingStatus`, `tradingPermission`, `tokenVersion`, `googleId`, `hasPassword`,
  `poaStatus`, 2FA fields.
- `Role`, `Permission`, `RolePermission`, `UserRole` — RBAC.

**Accounts & money (mode-scoped by `AccountMode`)**
- `Wallet` — per-user, per-mode balance(s).
- `Order` — positions/orders (`OrderSide`, `OrderType`, `OrderStatus`,
  `CloseReason`), SL/TP, leverage, entry/close.
- `Transaction` — deposits/withdrawals/adjustments (`TxType`, `TxStatus`).
- `WalletAddress` — deposit addresses.

**Engagement**
- `WatchlistItem` — watchlist entries (single implicit list today).
- `PriceAlert` (`AlertCondition`) — price alerts.
- `Notification` (`NotificationType`).

**Compliance**
- `KycSubmission` — identity docs + address lines.
- `AddressProof` — Proof-of-Address docs.

**Platform**
- `FeatureFlag`, `PlatformSetting`, `Announcement` (`AnnouncementCategory`),
  `ApiKey`, `AuditLog`.

**Enums:** `UserStatus`, `KycStatus`, `TradingStatus`, `TradingPermission`,
`AccountMode`, `OrderSide`, `OrderType`, `OrderStatus`, `CloseReason`, `TxType`,
`TxStatus`, `NotificationType`, `AlertCondition`, `AnnouncementCategory`.

## 2. Planned models (this spec)

### `Coin` (Market Data Service — `docs/07`)
```
Coin {
  id            String  @id @default(cuid())
  symbol        String  @unique      // e.g. BTC
  pair          String?              // e.g. BTCUSDT (trading pair)
  name          String
  logoUrl       String?
  price         Float?
  change24h     Float?
  change7d      Float?
  marketCap     Float?
  volume24h     Float?
  rank          Int?
  circulating   Float?
  maxSupply     Float?
  website       String?
  explorer      String?
  whitepaper    String?
  tradingEnabled Boolean @default(true)
  demoEnabled   Boolean @default(true)
  visible       Boolean @default(true)
  categories    CoinCategory[]       // tags
  updatedAt     DateTime @updatedAt
}
CoinCategory { id; coinId; category (enum) }   // Layer1, DeFi, Meme, AI, …
```
Coins are seeded/synced — **never hardcoded** in the app.

### `Watchlist` (named lists — replaces implicit single list)
```
Watchlist { id; userId; name; emoji?; createdAt }
WatchlistItem { id; watchlistId (→ Watchlist); symbol; addedAt }
```
Each list is unique to the authenticated user. Migrate existing `WatchlistItem`
rows into a default "Favorites" list per user.

### `BankAccount` (withdrawal method)
```
BankAccount {
  id; userId; accountHolderName; bankName; accountNumber; iban; swiftBic;
  branchName; branchAddress; country; currency; isDefault; createdAt
}
```

### `PayoutWallet` (saved crypto withdrawal address)
```
PayoutWallet {
  id; userId; label; asset (BTC/ETH/USDT/USDC/BNB/SOL/XRP/DOGE/ADA/LTC);
  network; address; memoTag?; isDefault; createdAt
}
```

### `SupportTicket` (Support role — `docs/08`/`09`)
```
SupportTicket { id; userId; subject; status; priority; createdAt }
SupportMessage { id; ticketId; authorId; body; createdAt }
```

### P&L / stats overrides (P&L Manager — `docs/08`)
Either extend `User`/a `PortfolioStat` model with override fields
(realized/unrealized/daily/weekly/monthly/lifetime P&L, ROI, volume, win/loss %)
or store admin overrides in a dedicated `StatOverride` table, mode-scoped.

## 3. Isolation & indexing rules

- Every user-owned model has `userId` and is **always** queried with it
  (`docs/05` §6). Add composite indexes `(userId, mode)` and `(userId, createdAt)`
  where lists are paginated.
- Mode-scoped models carry `AccountMode`; index `(userId, mode)`.
- `Coin` indexes: `symbol` (unique), `rank`, `marketCap`, category join.
- `BankAccount`/`PayoutWallet`: partial-unique so only one `isDefault=true` per
  user (enforce in code within a transaction).

## 4. Migration workflow

1. Edit `schema.prisma`.
2. `prisma generate`.
3. `prisma db push` (against **UNPOOLED** Neon URL) for the shared dev DB, or a
   proper migration for production.
4. Backfill/seed as needed (e.g. default Watchlist, Coin seed).
5. Never destructive-drop columns with live data without a documented backfill.

## 5. Money precision (note)

Existing balances use `Float`. New financial fields should prefer integer minor
units or `Decimal`; do not expand `Float` usage into new settlement paths.
