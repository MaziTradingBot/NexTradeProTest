'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Clock } from 'lucide-react';
import { useAuth } from '@/lib/store';

// Auto sign-out after inactivity. Shows a warning modal a minute before, with a
// live countdown and a "Stay signed in" action. Any activity outside the
// warning window silently resets the timer.
const IDLE_LIMIT_MS = 30 * 60 * 1000; // 30 minutes
const WARN_BEFORE_MS = 60 * 1000; // warn 60s before logout
const ACTIVITY = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart', 'wheel'] as const;

export function SessionSentinel() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [warning, setWarning] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(60);

  const warnTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const logoutTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdown = useRef<ReturnType<typeof setInterval> | null>(null);
  const warningRef = useRef(false);
  const lastReset = useRef(0);

  const clearAll = () => {
    if (warnTimer.current) clearTimeout(warnTimer.current);
    if (logoutTimer.current) clearTimeout(logoutTimer.current);
    if (countdown.current) clearInterval(countdown.current);
  };

  const doLogout = useCallback(async () => {
    clearAll();
    warningRef.current = false;
    setWarning(false);
    await logout();
    router.replace('/login?timeout=1');
  }, [logout, router]);

  const arm = useCallback(() => {
    clearAll();
    warningRef.current = false;
    setWarning(false);
    warnTimer.current = setTimeout(() => {
      warningRef.current = true;
      setWarning(true);
      setSecondsLeft(Math.round(WARN_BEFORE_MS / 1000));
      countdown.current = setInterval(() => setSecondsLeft((s) => Math.max(0, s - 1)), 1000);
    }, IDLE_LIMIT_MS - WARN_BEFORE_MS);
    logoutTimer.current = setTimeout(doLogout, IDLE_LIMIT_MS);
  }, [doLogout]);

  useEffect(() => {
    if (!user) return;
    const onActivity = () => {
      // Ignore passive activity while the warning is up — the user must click
      // "Stay signed in". Throttle resets to once per second.
      if (warningRef.current) return;
      const now = Date.now();
      if (now - lastReset.current < 1000) return;
      lastReset.current = now;
      arm();
    };
    ACTIVITY.forEach((e) => window.addEventListener(e, onActivity, { passive: true }));
    arm();
    return () => {
      ACTIVITY.forEach((e) => window.removeEventListener(e, onActivity));
      clearAll();
    };
  }, [user, arm]);

  if (!user || !warning) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-bg-surface p-6 text-center shadow-card">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand-gold/15 text-brand-gold"><Clock size={24} /></div>
        <h2 className="mt-4 text-lg font-bold text-white">Still there?</h2>
        <p className="mt-1 text-sm text-slate-400">You’ll be signed out in <span className="font-mono font-semibold text-white">{secondsLeft}s</span> due to inactivity.</p>
        <div className="mt-5 flex gap-2">
          <button onClick={doLogout} className="btn-ghost flex-1">Sign out</button>
          <button onClick={arm} className="btn-primary flex-1">Stay signed in</button>
        </div>
      </div>
    </div>
  );
}
