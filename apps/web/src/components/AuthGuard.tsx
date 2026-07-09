'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/store';
import { SessionSentinel } from './SessionSentinel';

export function AuthGuard({
  children,
  adminOnly = false,
  brokerOnly = false,
}: {
  children: React.ReactNode;
  adminOnly?: boolean;
  brokerOnly?: boolean;
}) {
  const { user, loading, loadMe } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!user && loading) loadMe();
  }, [user, loading, loadMe]);

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
    if (!loading && user && adminOnly && !user.isAdmin) router.replace('/dashboard');
    if (!loading && user && brokerOnly && !user.isBroker) router.replace('/dashboard');
  }, [loading, user, adminOnly, brokerOnly, router]);

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center text-slate-500">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-blue border-t-transparent" />
      </div>
    );
  }

  if (adminOnly && !user.isAdmin) return null;
  if (brokerOnly && !user.isBroker) return null;

  return (
    <>
      <SessionSentinel />
      {/* The global MobileAppNav (root layout) pads <body> for its own height. */}
      {children}
    </>
  );
}
