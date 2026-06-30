'use client';

import { useState } from 'react';
import { MessageCircle, X, Send } from 'lucide-react';

export function SupportButton() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<{ from: 'bot' | 'me'; text: string }[]>([
    { from: 'bot', text: 'Hi! I’m the NexTradePro assistant. Ask me anything about the platform.' },
  ]);
  const [input, setInput] = useState('');

  const send = () => {
    if (!input.trim()) return;
    const q = input.trim();
    setMessages((m) => [...m, { from: 'me', text: q }]);
    setInput('');
    setTimeout(() => {
      setMessages((m) => [
        ...m,
        {
          from: 'bot',
          text: 'Thanks! This is a demo assistant. A support agent would normally pick this up — try the Markets or Trading pages to explore live data.',
        },
      ]);
    }, 600);
  };

  return (
    <>
      <button
        onClick={() => setOpen((v) => !v)}
        className="fixed bottom-6 right-6 z-[60] flex h-14 w-14 items-center justify-center rounded-full bg-brand-gradient text-white shadow-glow transition hover:scale-105"
        aria-label="Open support chat"
      >
        {open ? <X size={22} /> : <MessageCircle size={24} />}
      </button>

      {open && (
        <div className="fixed bottom-24 right-6 z-[60] flex h-[420px] w-[340px] max-w-[calc(100vw-3rem)] flex-col overflow-hidden rounded-2xl border border-white/10 bg-bg-surface shadow-card">
          <div className="flex items-center gap-2 border-b border-white/10 bg-brand-gradient px-4 py-3 text-white">
            <MessageCircle size={18} />
            <div>
              <div className="text-sm font-semibold">NXP Support</div>
              <div className="text-xs opacity-80">Typically replies instantly</div>
            </div>
          </div>
          <div className="flex-1 space-y-3 overflow-y-auto p-4">
            {messages.map((m, i) => (
              <div key={i} className={m.from === 'me' ? 'text-right' : 'text-left'}>
                <span
                  className={
                    m.from === 'me'
                      ? 'inline-block max-w-[80%] rounded-2xl rounded-br-sm bg-brand-blue px-3 py-2 text-sm text-white'
                      : 'inline-block max-w-[80%] rounded-2xl rounded-bl-sm bg-white/5 px-3 py-2 text-sm text-slate-200'
                  }
                >
                  {m.text}
                </span>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2 border-t border-white/10 p-3">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && send()}
              placeholder="Type a message..."
              className="input py-2 text-sm"
            />
            <button onClick={send} className="rounded-xl bg-brand-gradient p-2.5 text-white" aria-label="Send">
              <Send size={16} />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
