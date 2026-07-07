'use client';

import { forwardRef, useId, useState } from 'react';
import { Eye, EyeOff, Check, X, AlertTriangle } from 'lucide-react';
import { evaluatePassword, PASSWORD_REQUIREMENTS } from '@/lib/password';
import { cn } from '@/lib/utils';

type BaseProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'>;

interface PasswordInputProps extends BaseProps {
  /** Show the live strength meter + requirement checklist (for new passwords). */
  showStrength?: boolean;
  /** Extra classes for the <input>. */
  inputClassName?: string;
}

/**
 * Reusable password field used everywhere in NexTradePro (client, broker and
 * admin portals). Provides a show/hide toggle, a Caps Lock warning, an optional
 * strength meter, and full keyboard/screen-reader accessibility. Visibility is a
 * purely local display change — the value is never logged or persisted.
 */
export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(function PasswordInput(
  { showStrength = false, inputClassName, className, value, onKeyDown, onKeyUp, id, ...rest },
  ref,
) {
  const [visible, setVisible] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const autoId = useId();
  const fieldId = id ?? autoId;
  const capsId = `${fieldId}-caps`;
  const strengthId = `${fieldId}-strength`;

  const detectCaps = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (typeof e.getModifierState === 'function') setCapsLock(e.getModifierState('CapsLock'));
  };

  const strength = evaluatePassword(typeof value === 'string' ? value : '');
  const hasValue = typeof value === 'string' && value.length > 0;

  const barTone = ['bg-red-500', 'bg-brand-gold', 'bg-yellow-400', 'bg-brand-emerald'][strength.score];
  const textTone = ['text-red-400', 'text-brand-gold', 'text-yellow-400', 'text-brand-emerald'][strength.score];

  return (
    <div className={className}>
      <div className="relative">
        <input
          {...rest}
          ref={ref}
          id={fieldId}
          type={visible ? 'text' : 'password'}
          value={value}
          aria-describedby={cn(capsLock && capsId, showStrength && hasValue && strengthId) || undefined}
          onKeyDown={(e) => { detectCaps(e); onKeyDown?.(e); }}
          onKeyUp={(e) => { detectCaps(e); onKeyUp?.(e); }}
          className={cn('input pr-11', inputClassName)}
        />
        <button
          type="button"
          // Keep focus (and caret position) in the input when toggling.
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? 'Hide password' : 'Show password'}
          aria-pressed={visible}
          title={visible ? 'Hide password' : 'Show password'}
          className="absolute right-1 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-slate-400 transition hover:bg-white/5 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue"
        >
          {visible ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </div>

      {capsLock && (
        <p id={capsId} role="alert" className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-brand-gold">
          <AlertTriangle size={13} /> Caps Lock is on
        </p>
      )}

      {showStrength && hasValue && (
        <div id={strengthId} className="mt-2.5">
          <div className="flex items-center gap-2">
            <div className="flex h-1.5 flex-1 gap-1" aria-hidden>
              {[0, 1, 2, 3].map((i) => (
                <span key={i} className={cn('h-full flex-1 rounded-full transition-colors', i <= strength.score ? barTone : 'bg-white/10')} />
              ))}
            </div>
            <span className={cn('text-xs font-semibold', textTone)}>{strength.label}</span>
          </div>
          <ul className="mt-2 grid grid-cols-1 gap-x-4 gap-y-1 sm:grid-cols-2">
            {PASSWORD_REQUIREMENTS.map((r) => {
              const met = strength.checks[r.key];
              return (
                <li key={r.key} className={cn('flex items-center gap-1.5 text-xs', met ? 'text-brand-emerald' : 'text-slate-500')}>
                  {met ? <Check size={12} /> : <X size={12} />} {r.label}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
});
