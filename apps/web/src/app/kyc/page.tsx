'use client';

import { useEffect, useState } from 'react';
import { BadgeCheck, Clock, ShieldX, UploadCloud, FileText } from 'lucide-react';
import { Navbar } from '@/components/Navbar';
import { AuthGuard } from '@/components/AuthGuard';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/store';
import { cn } from '@/lib/utils';

interface KycState {
  status: string;
  submission: { fullName: string; country: string; idType: string; createdAt: string } | null;
}

const ID_TYPES = [
  { key: 'PASSPORT', label: 'Passport' },
  { key: 'NATIONAL_ID', label: 'National ID' },
  { key: 'DRIVERS_LICENSE', label: "Driver's License" },
];

function KycInner() {
  const { user, loadMe } = useAuth();
  const [state, setState] = useState<KycState | null>(null);
  const [form, setForm] = useState({ fullName: '', country: '', idType: 'PASSPORT', idNumber: '', dob: '' });
  const [doc, setDoc] = useState<{ name: string; type: string; data: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const onFile = (file: File | undefined) => {
    setError(null);
    if (!file) return;
    const okType = file.type.startsWith('image/') || file.type === 'application/pdf';
    if (!okType) return setError('Please upload an image (PNG, JPG…) or a PDF.');
    if (file.size > 4 * 1024 * 1024) return setError('File is too large — max 4MB.');
    const reader = new FileReader();
    reader.onload = () => setDoc({ name: file.name, type: file.type, data: reader.result as string });
    reader.readAsDataURL(file);
  };

  const load = () => api.get<KycState>('/api/account/kyc').then(setState).catch(() => {});
  useEffect(() => {
    load();
    setForm((f) => ({ ...f, fullName: user?.fullName ?? '' }));
  }, [user]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!doc) return setError('Please upload a photo or PDF of your ID document.');
    setSubmitting(true);
    try {
      await api.post('/api/account/kyc', {
        ...form,
        documentName: doc.name,
        documentType: doc.type,
        documentData: doc.data,
      });
      await load();
      await loadMe();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Submission failed');
    } finally {
      setSubmitting(false);
    }
  };

  const status = state?.status ?? 'NONE';

  const StatusBanner = () => {
    if (status === 'APPROVED')
      return (
        <div className="card flex items-center gap-3 border-brand-emerald/30 bg-brand-emerald/10">
          <BadgeCheck className="text-brand-emerald" />
          <div>
            <div className="font-semibold text-white">Verified</div>
            <div className="text-sm text-slate-400">Your identity has been approved. You have full account access.</div>
          </div>
        </div>
      );
    if (status === 'PENDING')
      return (
        <div className="card flex items-center gap-3 border-brand-gold/30 bg-brand-gold/10">
          <Clock className="text-brand-gold" />
          <div>
            <div className="font-semibold text-white">Under review</div>
            <div className="text-sm text-slate-400">A KYC admin is reviewing your submission. This is usually quick.</div>
          </div>
        </div>
      );
    if (status === 'REJECTED')
      return (
        <div className="card flex items-center gap-3 border-red-500/30 bg-red-500/10">
          <ShieldX className="text-red-400" />
          <div>
            <div className="font-semibold text-white">Rejected</div>
            <div className="text-sm text-slate-400">Your submission was rejected. Please resubmit with valid details.</div>
          </div>
        </div>
      );
    return null;
  };

  const showForm = status === 'NONE' || status === 'REJECTED';

  return (
    <section className="mx-auto max-w-2xl px-4 pt-24 sm:px-6 lg:px-8">
      <h1 className="text-2xl font-bold text-white">Identity Verification (KYC)</h1>
      <p className="mt-1 text-slate-400">Verify your identity to unlock withdrawals and higher limits.</p>

      <div className="mt-6 space-y-6">
        <StatusBanner />

        {showForm ? (
          <form onSubmit={submit} className="card space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="label">Full legal name</span>
                <input value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} className="input" required />
              </label>
              <label className="block">
                <span className="label">Country</span>
                <input value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} className="input" placeholder="e.g. United Kingdom" required />
              </label>
              <label className="block">
                <span className="label">Date of birth</span>
                <input type="date" value={form.dob} onChange={(e) => setForm({ ...form, dob: e.target.value })} className="input" required />
              </label>
              <label className="block">
                <span className="label">ID number</span>
                <input value={form.idNumber} onChange={(e) => setForm({ ...form, idNumber: e.target.value })} className="input" required />
              </label>
            </div>

            <div>
              <span className="label">Document type</span>
              <div className="grid grid-cols-3 gap-2">
                {ID_TYPES.map((t) => (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => setForm({ ...form, idType: t.key })}
                    className={cn('rounded-xl py-2 text-xs font-semibold transition', form.idType === t.key ? 'bg-brand-gradient text-white' : 'bg-white/5 text-slate-400')}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Document upload */}
            <div>
              <span className="label">ID document</span>
              <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-white/15 bg-white/5 px-4 py-8 text-center transition hover:border-brand-blue/50 hover:bg-white/[0.07]">
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  className="hidden"
                  onChange={(e) => onFile(e.target.files?.[0])}
                />
                {doc ? (
                  <div className="w-full">
                    {doc.type.startsWith('image/') ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={doc.data} alt="ID preview" className="mx-auto max-h-40 rounded-lg" />
                    ) : (
                      <FileText className="mx-auto mb-2 text-brand-blue" size={32} />
                    )}
                    <div className="mt-2 truncate text-sm font-medium text-white">{doc.name}</div>
                    <div className="text-xs text-brand-emerald">Ready to submit · click to replace</div>
                  </div>
                ) : (
                  <>
                    <UploadCloud className="mb-2 text-slate-500" />
                    <div className="text-sm text-slate-300">Click to upload a photo or PDF of your ID</div>
                    <div className="text-xs text-slate-500">PNG, JPG or PDF · max 4MB</div>
                  </>
                )}
              </label>
            </div>

            {error && <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">{error}</p>}
            <button disabled={submitting} className="btn-primary w-full">
              {submitting ? 'Submitting…' : 'Submit for verification'}
            </button>
          </form>
        ) : status === 'PENDING' && state?.submission ? (
          <div className="card">
            <h2 className="mb-3 font-semibold text-white">Submitted details</h2>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between"><dt className="text-slate-400">Name</dt><dd className="text-white">{state.submission.fullName}</dd></div>
              <div className="flex justify-between"><dt className="text-slate-400">Country</dt><dd className="text-white">{state.submission.country}</dd></div>
              <div className="flex justify-between"><dt className="text-slate-400">Document</dt><dd className="text-white">{state.submission.idType.replace('_', ' ')}</dd></div>
              <div className="flex justify-between"><dt className="text-slate-400">Submitted</dt><dd className="text-white">{new Date(state.submission.createdAt).toLocaleString()}</dd></div>
            </dl>
          </div>
        ) : null}
      </div>
      <div className="h-16" />
    </section>
  );
}

export default function KycPage() {
  return (
    <main>
      <Navbar />
      <AuthGuard>
        <KycInner />
      </AuthGuard>
    </main>
  );
}
