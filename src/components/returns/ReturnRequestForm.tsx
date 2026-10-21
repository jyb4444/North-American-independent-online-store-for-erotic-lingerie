'use client';

import { FormEvent, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, Camera, Check, PackageCheck, RotateCcw, Upload } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import type { DesiredResolution, ItemCondition, ReturnReason } from '@/lib/returns';
import type { OrderItem } from '@/lib/logistics';

const RESOLUTIONS: Array<{ value: DesiredResolution; label: string }> = [
  { value: 'return_refund', label: 'Return for refund' },
  { value: 'exchange', label: 'Exchange' },
  { value: 'reship', label: 'Replace a wrong or missing item' },
];

const REASONS: Array<{ value: ReturnReason; label: string }> = [
  { value: 'quality_issue', label: 'Quality issue' },
  { value: 'wrong_item', label: 'Wrong item received' },
  { value: 'missing_item', label: 'Missing item' },
  { value: 'damaged_in_transit', label: 'Damaged in transit' },
  { value: 'privacy_packaging', label: 'Privacy packaging issue' },
  { value: 'size_fit', label: 'Size or fit' },
  { value: 'not_as_expected', label: 'Not as expected' },
  { value: 'changed_mind', label: 'Changed mind' },
  { value: 'other', label: 'Other' },
];

const CONDITIONS: Array<{ value: ItemCondition; label: string }> = [
  { value: 'unopened_tags_attached', label: 'Unopened, tags attached' },
  { value: 'opened_unused', label: 'Opened, unused' },
  { value: 'used', label: 'Used or tried on' },
  { value: 'damaged', label: 'Damaged' },
  { value: 'defective', label: 'Defective on arrival' },
];

type SelectedItem = {
  selected: boolean;
  quantity: number;
  itemCondition: ItemCondition;
};

function initialSelectedState(items: OrderItem[]) {
  return Object.fromEntries(items.map((item) => [item.id, {
    selected: false,
    quantity: 1,
    itemCondition: 'unopened_tags_attached' as ItemCondition,
  }]));
}

function categoryLabel(category: string) {
  if (category === 'underwear') return 'Final sale hygiene item';
  if (category === 'hosiery') return 'Hosiery policy applies';
  return 'Standard policy';
}

export default function ReturnRequestForm({
  orderId,
  items,
}: {
  orderId: string;
  items: OrderItem[];
}) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [desiredResolution, setDesiredResolution] = useState<DesiredResolution>('return_refund');
  const [reason, setReason] = useState<ReturnReason>('quality_issue');
  const [customerNote, setCustomerNote] = useState('');
  const [files, setFiles] = useState<FileList | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [selected, setSelected] = useState<Record<string, SelectedItem>>(() => initialSelectedState(items));

  const selectedCount = useMemo(
    () => Object.values(selected).filter((item) => item.selected).length,
    [selected]
  );

  async function uploadMedia() {
    if (!files?.length) return [];
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Sign in again before uploading photos.');

    const uploaded: string[] = [];
    for (const file of Array.from(files).slice(0, 6)) {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '-');
      const path = `${user.id}/${Date.now()}-${crypto.randomUUID()}-${safeName}`;
      const { error: uploadError } = await supabase.storage
        .from('returns')
        .upload(path, file, { upsert: false });

      if (uploadError) throw new Error(uploadError.message);
      uploaded.push(path);
    }
    return uploaded;
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    const requestItems = Object.entries(selected)
      .filter(([, item]) => item.selected)
      .map(([orderItemId, item]) => ({
        orderItemId,
        quantity: item.quantity,
        itemCondition: item.itemCondition,
      }));

    if (requestItems.length === 0) {
      setError('Select at least one item.');
      return;
    }

    setSubmitting(true);
    try {
      const mediaUrls = await uploadMedia();
      const res = await fetch('/api/returns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId,
          desiredResolution,
          reason,
          customerNote,
          mediaUrls,
          items: requestItems,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Could not submit request.');

      setSuccess(`Request ${data.request.request_number} submitted.`);
      setDesiredResolution('return_refund');
      setReason('quality_issue');
      setCustomerNote('');
      setFiles(null);
      setSelected(initialSelectedState(items));
      if (fileInputRef.current) fileInputRef.current.value = '';
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not submit request.');
    } finally {
      setSubmitting(false);
    }
  }

  if (items.length === 0) {
    return (
      <div className="border border-gold-600/20 bg-wine-900 p-5 text-sm text-ivory-muted">
        Item details are still syncing from Shopify. Try again after the order webhook finishes processing.
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5 border border-gold-600/20 bg-wine-900 p-5">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center border border-gold-600/30 text-gold-400">
          <RotateCcw size={18} />
        </div>
        <div>
          <h2 className="font-serif text-xl font-light text-ivory">Request a Return</h2>
          <p className="text-xs text-ivory-dim">{selectedCount} item{selectedCount === 1 ? '' : 's'} selected</p>
        </div>
      </div>

      <div className="border border-gold-400/30 bg-gold-400/10 p-4 text-sm leading-relaxed text-ivory-muted">
        Submitting this form does not approve a return or issue a refund. Please wait for our email with return instructions before shipping anything.
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-xs uppercase tracking-widest text-ivory-dim">
          Resolution
          <select
            value={desiredResolution}
            onChange={(event) => setDesiredResolution(event.target.value as DesiredResolution)}
            className="mt-2 w-full border border-gold-600/20 bg-wine-950 px-3 py-3 text-sm normal-case tracking-normal text-ivory outline-none focus:border-gold-400"
          >
            {RESOLUTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>

        <label className="text-xs uppercase tracking-widest text-ivory-dim">
          Reason
          <select
            value={reason}
            onChange={(event) => setReason(event.target.value as ReturnReason)}
            className="mt-2 w-full border border-gold-600/20 bg-wine-950 px-3 py-3 text-sm normal-case tracking-normal text-ivory outline-none focus:border-gold-400"
          >
            {REASONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="space-y-3">
        {items.map((item) => {
          const state = selected[item.id];
          return (
            <div key={item.id} className="border border-gold-600/15 bg-wine-950/40 p-4">
              <div className="flex gap-3">
                <button
                  type="button"
                  aria-label={`Select ${item.title}`}
                  onClick={() => setSelected((current) => ({
                    ...current,
                    [item.id]: { ...current[item.id], selected: !current[item.id].selected },
                  }))}
                  className={`mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center border transition ${
                    state.selected ? 'border-gold-400 bg-gold-400 text-wine-950' : 'border-gold-600/40 text-transparent'
                  }`}
                >
                  <Check size={14} />
                </button>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-sm text-ivory">{item.title}</p>
                      <p className="mt-1 text-xs text-ivory-dim">
                        {item.variant_title ?? 'Default'} · Qty {item.quantity}
                      </p>
                    </div>
                    <span className="w-fit border border-gold-600/30 px-2 py-1 text-[10px] uppercase tracking-widest text-gold-400">
                      {categoryLabel(item.return_category)}
                    </span>
                  </div>

                  {state.selected && (
                    <div className="mt-4 grid gap-3 sm:grid-cols-[110px_1fr]">
                      <label className="text-xs uppercase tracking-widest text-ivory-dim">
                        Qty
                        <input
                          type="number"
                          min={1}
                          max={item.quantity}
                          value={state.quantity}
                          onChange={(event) => setSelected((current) => ({
                            ...current,
                            [item.id]: { ...current[item.id], quantity: Number(event.target.value) },
                          }))}
                          className="mt-2 w-full border border-gold-600/20 bg-wine-900 px-3 py-3 text-sm normal-case tracking-normal text-ivory outline-none focus:border-gold-400"
                        />
                      </label>
                      <label className="text-xs uppercase tracking-widest text-ivory-dim">
                        Condition
                        <select
                          value={state.itemCondition}
                          onChange={(event) => setSelected((current) => ({
                            ...current,
                            [item.id]: { ...current[item.id], itemCondition: event.target.value as ItemCondition },
                          }))}
                          className="mt-2 w-full border border-gold-600/20 bg-wine-900 px-3 py-3 text-sm normal-case tracking-normal text-ivory outline-none focus:border-gold-400"
                        >
                          {CONDITIONS.map((option) => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                          ))}
                        </select>
                      </label>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <label className="block text-xs uppercase tracking-widest text-ivory-dim">
        What happened?
        <textarea
          value={customerNote}
          onChange={(event) => setCustomerNote(event.target.value)}
          rows={4}
          className="mt-2 w-full resize-none border border-gold-600/20 bg-wine-950 px-3 py-3 text-sm normal-case tracking-normal text-ivory outline-none focus:border-gold-400"
          placeholder="Briefly describe the issue and what you would like us to review."
        />
      </label>

      <label className="flex cursor-pointer items-center justify-between gap-3 border border-dashed border-gold-600/30 bg-wine-950/40 px-4 py-4 text-sm text-ivory-muted">
        <span className="flex items-center gap-3">
          <Camera size={18} className="text-gold-400" />
          {files?.length ? `${Math.min(files.length, 6)} file(s) selected` : 'Add photos (recommended for damage or quality issues)'}
        </span>
        <Upload size={16} className="text-gold-400" />
        <input
          type="file"
          accept="image/*"
          multiple
          ref={fileInputRef}
          className="sr-only"
          onChange={(event) => setFiles(event.target.files)}
        />
      </label>

      {error && (
        <div className="flex gap-2 border border-crimson-400/30 bg-crimson-950/20 p-3 text-sm text-crimson-200">
          <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
          {error}
        </div>
      )}
      {success && (
        <div className="flex gap-2 border border-gold-400/30 bg-gold-400/10 p-3 text-sm text-gold-200">
          <PackageCheck size={16} className="mt-0.5 flex-shrink-0" />
          {success}
        </div>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="w-full border border-gold-400 px-5 py-3 text-xs font-medium uppercase tracking-widest text-gold-400 transition hover:bg-gold-400 hover:text-wine-950 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {submitting ? 'Submitting...' : 'Submit for Review'}
      </button>
      <p className="text-center text-xs leading-relaxed text-ivory-dim">
        Need help before submitting? <a href="/pages/contact" className="text-gold-400 hover:text-gold-300">Contact support</a> with your order number.
      </p>
    </form>
  );
}
