'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { XCircle } from 'lucide-react';

type CancelReturnRequestButtonProps = {
  requestId: string;
};

export default function CancelReturnRequestButton({ requestId }: CancelReturnRequestButtonProps) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCancel() {
    if (!window.confirm('Cancel this return request?')) return;

    setBusy(true);
    setError(null);

    try {
      const response = await fetch(`/api/returns/${requestId}/cancel`, {
        method: 'POST',
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? 'Could not cancel return request');
      }

      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not cancel return request');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <button
        type="button"
        onClick={handleCancel}
        disabled={busy}
        className="inline-flex items-center justify-center gap-2 border border-crimson-400/35 px-4 py-3 text-xs uppercase tracking-widest text-crimson-300 transition hover:border-crimson-300 hover:text-crimson-200 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <XCircle size={14} />
        {busy ? 'Cancelling' : 'Cancel Request'}
      </button>
      {error && <p className="max-w-64 text-right text-xs text-crimson-300">{error}</p>}
    </div>
  );
}
