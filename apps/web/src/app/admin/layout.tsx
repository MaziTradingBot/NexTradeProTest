'use client';

import { AuthGuard } from '@/components/AuthGuard';
import { AdminSidebar } from '@/components/AdminSidebar';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard adminOnly>
      <div className="flex min-h-screen">
        <AdminSidebar />
        <div className="flex-1 overflow-x-hidden">
          <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-10">{children}</div>
        </div>
      </div>
    </AuthGuard>
  );
}
