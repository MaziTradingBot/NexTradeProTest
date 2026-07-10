'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Download, X, Share, Plus, Smartphone } from 'lucide-react';

// Re-prompt cadence: surface the install popup every 10 minutes on phones.
const INTERVAL_MS = 10 * 60 * 1000;
// Delay before the very first prompt so it doesn't slam the user on load.
const FIRST_DELAY_MS = 8 * 1000;
const LAST_SHOWN_KEY = 'nxp-install-last-shown';

// The `beforeinstallprompt` event isn't in the DOM lib types.
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

function isStandalone() {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    // iOS Safari exposes navigator.standalone when launched from the home screen.
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

function isMobileViewport() {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(max-width: 1023px)').matches;
}

function isIOS() {
  if (typeof navigator === 'undefined') return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

/**
 * Mobile-only "Install the NexTradePro app" popup. Uses the native
 * `beforeinstallprompt` flow on Android/Chrome and falls back to Add-to-Home-
 * Screen instructions on iOS Safari. Hides permanently once the app is
 * installed / running standalone, and re-surfaces every 10 minutes otherwise.
 */
export function MobileInstallPrompt() {
  const pathname = usePathname();
  const onLanding = pathname === '/';
  const [open, setOpen] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [showIosHelp, setShowIosHelp] = useState(false);
  const deferredRef = useRef<BeforeInstallPromptEvent | null>(null);

  // Capture the native install prompt and react to a completed install.
  useEffect(() => {
    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      deferredRef.current = e as BeforeInstallPromptEvent;
    };
    const onInstalled = () => {
      setInstalled(true);
      setOpen(false);
      deferredRef.current = null;
    };
    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  // Schedule the first prompt, then re-prompt on a 10-minute cadence.
  // Only the public landing page ('/') surfaces this popup.
  useEffect(() => {
    if (!onLanding) {
      setOpen(false);
      return;
    }
    if (installed || !isMobileViewport() || isStandalone()) return;

    const showNow = () => {
      // Never nag a user who has since installed / opened the standalone app.
      if (isStandalone()) return;
      setShowIosHelp(false);
      setOpen(true);
      try {
        localStorage.setItem(LAST_SHOWN_KEY, String(Date.now()));
      } catch {
        /* ignore storage failures (private mode, etc.) */
      }
    };

    // Space the first prompt from the last one seen in a previous visit so a
    // reload doesn't immediately re-pop within the 10-minute window.
    let firstDelay = FIRST_DELAY_MS;
    try {
      const last = Number(localStorage.getItem(LAST_SHOWN_KEY) || 0);
      if (last) firstDelay = Math.max(INTERVAL_MS - (Date.now() - last), 5000);
    } catch {
      /* ignore */
    }

    let interval: ReturnType<typeof setInterval> | undefined;
    const first = setTimeout(() => {
      showNow();
      interval = setInterval(showNow, INTERVAL_MS);
    }, firstDelay);

    return () => {
      clearTimeout(first);
      if (interval) clearInterval(interval);
    };
  }, [installed, onLanding]);

  const dismiss = () => {
    setOpen(false);
    // Reset the clock so the next auto-prompt is a full interval away.
    try {
      localStorage.setItem(LAST_SHOWN_KEY, String(Date.now()));
    } catch {
      /* ignore */
    }
  };

  const install = async () => {
    const deferred = deferredRef.current;
    if (deferred) {
      await deferred.prompt();
      const choice = await deferred.userChoice.catch(() => ({ outcome: 'dismissed' as const }));
      deferredRef.current = null;
      if (choice.outcome === 'accepted') setInstalled(true);
      setOpen(false);
      return;
    }
    // No native prompt available (typically iOS Safari) — show manual steps.
    if (isIOS()) {
      setShowIosHelp(true);
      return;
    }
    dismiss();
  };

  if (!open || installed) return null;

  return (
    <div className="fixed inset-0 z-[85] lg:hidden" role="dialog" aria-modal="true" aria-label="Install the NexTradePro app">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={dismiss} aria-hidden />
      <div
        className="absolute inset-x-0 bottom-0 animate-slide-up rounded-t-3xl border-t border-white/10 bg-bg-surface p-5 shadow-card"
        style={{ paddingBottom: 'calc(1.25rem + var(--safe-bottom))' }}
      >
        <button
          onClick={dismiss}
          className="absolute right-4 top-4 rounded-lg p-1.5 text-slate-400 transition hover:bg-white/5 hover:text-white"
          aria-label="Dismiss"
        >
          <X size={18} />
        </button>

        <div className="flex items-start gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-brand-gradient shadow-glow">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icon.svg" alt="NexTradePro" className="h-9 w-9" />
          </div>
          <div className="min-w-0 pr-6">
            <h2 className="text-lg font-bold text-white">Get the NexTradePro app</h2>
            <p className="mt-1 text-sm text-slate-400">
              Install it on your phone for faster access, a full-screen experience and instant market alerts.
            </p>
          </div>
        </div>

        {showIosHelp ? (
          <div className="mt-4 space-y-2 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-300">
            <p className="font-semibold text-white">Add to Home Screen</p>
            <p className="flex items-center gap-2">
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-white/10 text-brand-blue"><Share size={14} /></span>
              Tap the <span className="font-medium text-white">Share</span> icon in Safari.
            </p>
            <p className="flex items-center gap-2">
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-white/10 text-brand-blue"><Plus size={14} /></span>
              Choose <span className="font-medium text-white">“Add to Home Screen”</span>.
            </p>
            <button onClick={dismiss} className="btn-ghost mt-2 w-full py-2.5 text-sm">Got it</button>
          </div>
        ) : (
          <div className="mt-5 flex gap-3">
            <button onClick={dismiss} className="btn-ghost flex-1 py-3 text-sm">Not now</button>
            <button onClick={install} className="btn-primary flex-[1.4] py-3 text-sm">
              {isIOS() ? <Smartphone size={16} /> : <Download size={16} />} Install app
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
