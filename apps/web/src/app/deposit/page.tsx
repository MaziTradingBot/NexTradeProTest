'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// Deposit is now consolidated into the Wallet page's Deposit tab. This route
// redirects for any existing bookmarks / deep links.
export default function DepositRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace('/wallet'); }, [router]);
  return (
    <main className="flex min-h-screen items-center justify-center text-slate-500">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-blue border-t-transparent" />
    </main>
  );
}
