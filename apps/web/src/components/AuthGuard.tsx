'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/store';

export function AuthGuard({
  children,
  adminOnly = false,
}: {
  children: React.ReactNode;
  adminOnly?: boolean;
}) {
  const { user, loading, loadMe } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!user && loading) loadMe();
  }, [user, loading, loadMe]);

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
    if (!loading && user && adminOnly && !user.isAdmin) router.replace('/dashboard');
  }, [loading, user, adminOnly, router]);

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center text-slate-500">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-blue border-t-transparent" />
      </div>
    );
  }

  if (adminOnly && !user.isAdmin) return null;

  return <>{children}</>;
}
