// Dependency-free transaction receipt. Renders a branded, print-optimized
// document into a hidden iframe and invokes the browser's print dialog, so the
// user can save it as a PDF (or print it) without any external library.

export interface ReceiptTxn {
  id: string;
  type: string;
  asset: string;
  amount: string | number;
  fee?: string | number | null;
  network?: string | null;
  address?: string | null;
  status: string;
  reference?: string | null;
  mode?: string;
  createdAt: string;
}

const esc = (s: unknown) =>
  String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));

export function downloadReceipt(txn: ReceiptTxn, userName: string) {
  const rows: [string, string][] = [
    ['Transaction ID', txn.id],
    ['Reference', txn.reference || '—'],
    ['Account holder', userName],
    ['Type', txn.type.replace(/_/g, ' ')],
    ['Account', txn.mode ? `${txn.mode} account` : '—'],
    ['Asset', txn.asset],
    ['Amount', `${Number(txn.amount).toLocaleString(undefined, { maximumFractionDigits: 8 })} ${txn.asset}`],
    ['Network fee', txn.fee != null ? `${Number(txn.fee).toLocaleString(undefined, { maximumFractionDigits: 8 })} ${txn.asset}` : '—'],
    ['Network', txn.network || '—'],
    ['Wallet address', txn.address || '—'],
    ['Status', txn.status],
    ['Date & time', new Date(txn.createdAt).toLocaleString()],
  ];

  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Receipt ${esc(txn.reference || txn.id)}</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif}
    body{color:#0a1633;padding:40px}
    .head{display:flex;align-items:center;justify-content:space-between;border-bottom:3px solid #0EA5E9;padding-bottom:16px}
    .brand{display:flex;align-items:center;gap:10px}
    .logo{width:38px;height:38px;border-radius:10px;background:linear-gradient(135deg,#0EA5E9,#22D3EE);color:#fff;font-weight:800;display:flex;align-items:center;justify-content:center;font-size:20px}
    .name{font-size:20px;font-weight:800;letter-spacing:.5px}
    .name span{color:#0EA5E9}
    h1{font-size:15px;text-transform:uppercase;letter-spacing:2px;color:#5b6b8c;margin-top:28px}
    table{width:100%;border-collapse:collapse;margin-top:12px}
    td{padding:10px 4px;border-bottom:1px solid #eef1f7;font-size:13px;vertical-align:top}
    td.k{color:#5b6b8c;width:38%}
    td.v{text-align:right;font-weight:600;word-break:break-all}
    .status{display:inline-block;padding:2px 10px;border-radius:999px;font-size:12px;font-weight:700;background:#e7f8ef;color:#0e9f6e}
    .foot{margin-top:28px;font-size:11px;color:#8593ad;line-height:1.6;border-top:1px solid #eef1f7;padding-top:14px}
  </style></head><body>
    <div class="head">
      <div class="brand"><div class="logo">N</div><div class="name">NexTrade<span>Pro</span></div></div>
      <div style="text-align:right"><div style="font-size:13px;font-weight:700">Transaction receipt</div><div style="font-size:11px;color:#8593ad">Generated ${esc(new Date().toLocaleString())}</div></div>
    </div>
    <h1>Receipt details</h1>
    <table>${rows
      .map(([k, v]) => `<tr><td class="k">${esc(k)}</td><td class="v">${k === 'Status' ? `<span class="status">${esc(v)}</span>` : esc(v)}</td></tr>`)
      .join('')}</table>
    <div class="foot">This receipt is issued by NexTradePro for the transaction referenced above. NexTradePro is a demonstration trading platform; balances and execution are simulated for educational purposes. This document is not a financial statement or tax advice.</div>
  </body></html>`;

  const iframe = document.createElement('iframe');
  iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;';
  document.body.appendChild(iframe);
  const doc = iframe.contentWindow?.document;
  if (!doc) return;
  doc.open();
  doc.write(html);
  doc.close();
  iframe.contentWindow?.focus();
  setTimeout(() => {
    iframe.contentWindow?.print();
    setTimeout(() => iframe.remove(), 1500);
  }, 350);
}
