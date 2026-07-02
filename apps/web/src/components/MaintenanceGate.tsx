'use client';

import { usePathname } from 'next/navigation';
import { Wrench } from 'lucide-react';
import { Logo } from './Logo';
import { useFlags } from '@/lib/useFlags';
import { useAuth } from '@/lib/store';

// When maintenance mode is on, everyone sees a maintenance screen — except
// admins, and the login/admin routes so operators can still get in.
export function MaintenanceGate({ children }: { children: React.ReactNode }) {
  const { flags, loaded } = useFlags();
  const { user } = useAuth();
  const pathname = usePathname();

  const bypass = pathname?.startsWith('/login') || pathname?.startsWith('/admin') || user?.isAdmin;

  if (loaded && flags.maintenance_mode && !bypass) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center px-4 text-center">
        <Logo />
        <div className="mt-10 inline-flex rounded-2xl bg-brand-gradient p-4 text-white">
          <Wrench size={32} />
        </div>
        <h1 className="mt-6 text-3xl font-bold text-white">We’ll be right back</h1>
        <p className="mt-3 max-w-md text-slate-400">
          NexTradePro is undergoing scheduled maintenance to improve your trading experience.
          Please check back shortly.
        </p>
        <a href="/login" className="btn-ghost mt-8">
          Admin login
        </a>
      </main>
    );
  }

  return <>{children}</>;
}
