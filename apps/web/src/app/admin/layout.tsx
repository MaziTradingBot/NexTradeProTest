'use client';

import { AuthGuard } from '@/components/AuthGuard';
import { AdminSidebar } from '@/components/AdminSidebar';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard adminOnly>
      <div className="flex min-h-screen">
        <AdminSidebar />
        <div className="min-w-0 flex-1 overflow-x-hidden">
          <div className="mx-auto max-w-6xl px-4 pb-8 pt-20 sm:px-6 lg:px-10 lg:py-8">{children}</div>
        </div>
      </div>
    </AuthGuard>
  );
}
