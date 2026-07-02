'use client';

import { QRCodeSVG } from 'qrcode.react';

export function QrCode({ text, size = 168 }: { text: string; size?: number }) {
  return (
    <div className="shrink-0 rounded-xl bg-white p-3">
      <QRCodeSVG value={text} size={size} level="M" marginSize={0} />
    </div>
  );
}
