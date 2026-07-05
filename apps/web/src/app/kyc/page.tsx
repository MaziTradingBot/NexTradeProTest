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
  poaStatus: string;
  poaSubmission: { docType: string; issuedDate: string | null; status: string; createdAt: string } | null;
  poaRequired: boolean;
  poaThreshold: number;
  depositsTotal: number;
}

const ID_TYPES = [
  { key: 'PASSPORT', label: 'Passport' },
  { key: 'NATIONAL_ID', label: 'National ID' },
  { key: 'DRIVERS_LICENSE', label: "Driver's License" },
];

const POA_TYPES = [
  { key: 'UTILITY_BILL', label: 'Utility Bill' },
  { key: 'BANK_STATEMENT', label: 'Bank Statement' },
  { key: 'GOVERNMENT_LETTER', label: 'Government Letter' },
  { key: 'TAX_DOCUMENT', label: 'Tax Document' },
];

function KycInner() {
  const { user, loadMe } = useAuth();
  const [state, setState] = useState<KycState | null>(null);
  const [form, setForm] = useState({ fullName: '', country: '', idType: 'PASSPORT', addressLine1: '', addressLine2: '', dob: '' });
  const [doc, setDoc] = useState<{ name: string; type: string; data: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [poaType, setPoaType] = useState('UTILITY_BILL');
  const [poaIssued, setPoaIssued] = useState('');
  const [poaDoc, setPoaDoc] = useState<{ name: string; type: string; data: string } | null>(null);
  const [poaError, setPoaError] = useState<string | null>(null);
  const [poaSubmitting, setPoaSubmitting] = useState(false);

  const readFile = (file: File | undefined, set: (d: { name: string; type: string; data: string }) => void, onErr: (m: string) => void) => {
    if (!file) return;
    if (!(file.type.startsWith('image/') || file.type === 'application/pdf')) return onErr('Please upload an image (PNG, JPG…) or a PDF.');
    if (file.size > 4 * 1024 * 1024) return onErr('File is too large — max 4MB.');
    const reader = new FileReader();
    reader.onload = () => set({ name: file.name, type: file.type, data: reader.result as string });
    reader.readAsDataURL(file);
  };

  const submitPoa = async () => {
    setPoaError(null);
    if (!poaDoc) return setPoaError('Please upload your proof-of-address document.');
    setPoaSubmitting(true);
    try {
      await api.post('/api/account/poa', { docType: poaType, issuedDate: poaIssued || undefined, documentName: poaDoc.name, documentType: poaDoc.type, documentData: poaDoc.data });
      await load();
      await loadMe();
    } catch (err) {
      setPoaError(err instanceof Error ? err.message : 'Submission failed');
    } finally {
      setPoaSubmitting(false);
    }
  };

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
                <span className="label">Address line 1</span>
                <input value={form.addressLine1} onChange={(e) => setForm({ ...form, addressLine1: e.target.value })} className="input" placeholder="Street address" required />
              </label>
              <label className="block sm:col-span-2">
                <span className="label">Address line 2 <span className="text-ink-muted">(optional)</span></span>
                <input value={form.addressLine2} onChange={(e) => setForm({ ...form, addressLine2: e.target.value })} className="input" placeholder="Apartment, suite, city, postcode" />
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

        {/* Proof of Address — second verification stage */}
        {(() => {
          const poaStatus = state?.poaStatus ?? 'NONE';
          const required = !!state?.poaRequired;
          const showPoaForm = poaStatus === 'NONE' || poaStatus === 'REJECTED';
          // Only surface POA once it's required (high-value deposits) or already started.
          if (!required && poaStatus === 'NONE') return null;
          return (
            <div className="card">
              <div className="mb-1 flex items-center justify-between">
                <h2 className="font-semibold text-white">Proof of Address</h2>
                <span
                  className={cn(
                    'badge',
                    poaStatus === 'APPROVED' ? 'bg-brand-emerald/15 text-brand-emerald' : poaStatus === 'PENDING' ? 'bg-brand-gold/15 text-brand-gold' : poaStatus === 'REJECTED' ? 'bg-red-500/15 text-red-400' : 'bg-white/5 text-slate-400',
                  )}
                >
                  {poaStatus === 'NONE' ? 'Required' : poaStatus.charAt(0) + poaStatus.slice(1).toLowerCase()}
                </span>
              </div>
              <p className="mb-4 text-sm text-slate-400">
                {required
                  ? `Your deposits have reached the $${(state?.poaThreshold ?? 5000).toLocaleString()} compliance threshold, so a proof of address is required. `
                  : ''}
                Upload a document issued in the last 3 months that shows your name and registered address.
              </p>

              {poaStatus === 'PENDING' ? (
                <div className="rounded-xl bg-white/5 px-4 py-3 text-sm text-slate-300">
                  Your {state?.poaSubmission?.docType.replace(/_/g, ' ').toLowerCase()} is under review by a compliance admin.
                </div>
              ) : poaStatus === 'APPROVED' ? (
                <div className="rounded-xl bg-brand-emerald/10 px-4 py-3 text-sm text-slate-300">Your address has been verified.</div>
              ) : showPoaForm ? (
                <div className="space-y-4">
                  <div>
                    <span className="label">Document type</span>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                      {POA_TYPES.map((t) => (
                        <button key={t.key} type="button" onClick={() => setPoaType(t.key)} className={cn('rounded-xl py-2 text-xs font-semibold transition', poaType === t.key ? 'bg-brand-gradient text-white' : 'bg-white/5 text-slate-400')}>
                          {t.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <label className="block">
                    <span className="label">Issue date <span className="text-ink-muted">(must be within 3 months)</span></span>
                    <input type="date" value={poaIssued} onChange={(e) => setPoaIssued(e.target.value)} className="input" />
                  </label>
                  <div>
                    <span className="label">Document</span>
                    <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-white/15 bg-white/5 px-4 py-8 text-center transition hover:border-brand-blue/50 hover:bg-white/[0.07]">
                      <input type="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => readFile(e.target.files?.[0], setPoaDoc, setPoaError)} />
                      {poaDoc ? (
                        <div className="w-full">
                          {poaDoc.type.startsWith('image/') ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={poaDoc.data} alt="Proof preview" className="mx-auto max-h-40 rounded-lg" />
                          ) : (
                            <FileText className="mx-auto mb-2 text-brand-blue" size={32} />
                          )}
                          <div className="mt-2 truncate text-sm font-medium text-white">{poaDoc.name}</div>
                          <div className="text-xs text-brand-emerald">Ready to submit · click to replace</div>
                        </div>
                      ) : (
                        <>
                          <UploadCloud className="mb-2 text-slate-500" />
                          <div className="text-sm text-slate-300">Click to upload a utility bill, bank statement, etc.</div>
                          <div className="text-xs text-slate-500">PNG, JPG or PDF · max 4MB</div>
                        </>
                      )}
                    </label>
                  </div>
                  {poaError && <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">{poaError}</p>}
                  <button onClick={submitPoa} disabled={poaSubmitting} className="btn-primary w-full">
                    {poaSubmitting ? 'Submitting…' : 'Submit proof of address'}
                  </button>
                </div>
              ) : null}
            </div>
          );
        })()}
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
