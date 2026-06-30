import Link from 'next/link';
import { Logo } from '@/components/Logo';

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4 text-center">
      <Logo />
      <h1 className="mt-8 text-6xl font-bold gradient-text">404</h1>
      <p className="mt-3 text-slate-400">This page drifted off the chart.</p>
      <Link href="/" className="btn-primary mt-8">
        Back to home
      </Link>
    </main>
  );
}
