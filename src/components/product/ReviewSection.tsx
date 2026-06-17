'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Star, LogIn, Camera, X as XIcon } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

type Review = {
  id: string;
  product_id: string;
  rating: number;
  body: string;
  nickname: string;
  verified_purchase: boolean;
  created_at: string;
  photo_urls?: string[];
};

type AuthUser = { id: string; email: string; displayName: string };

type Props = { productId: string; productHandle: string; seedRating?: number; seedCount?: number };

function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!domain) return email;
  return `${local.slice(0, 3)}***@${domain}`;
}

function StarRow({ rating, size = 13, interactive = false, onChange }: {
  rating: number; size?: number; interactive?: boolean; onChange?: (r: number) => void;
}) {
  const [hover, setHover] = useState(0);
  return (
    <div className="flex">
      {[1, 2, 3, 4, 5].map((i) => (
        <button
          key={i}
          type={interactive ? 'button' : undefined}
          onClick={interactive ? () => onChange?.(i) : undefined}
          onMouseEnter={interactive ? () => setHover(i) : undefined}
          onMouseLeave={interactive ? () => setHover(0) : undefined}
          className={interactive ? 'cursor-pointer' : 'cursor-default'}
          aria-label={interactive ? `Rate ${i} stars` : undefined}
        >
          <Star
            size={size}
            className={i <= (hover || rating) ? 'fill-gold-400 text-gold-400' : 'text-wine-700'}
          />
        </button>
      ))}
    </div>
  );
}

function RatingBar({ label, count, total }: { label: string; count: number; total: number }) {
  const pct = total > 0 ? (count / total) * 100 : 0;
  return (
    <div className="flex items-center gap-2">
      <span className="w-4 text-right text-xs text-ivory-dim">{label}</span>
      <div className="h-1.5 flex-1 bg-wine-800">
        <div className="h-full bg-gold-400/70 transition-all" style={{ width: `${pct}%` }} />
      </div>
      <span className="w-4 text-xs text-ivory-dim">{count}</span>
    </div>
  );
}

export default function ReviewSection({ productId, productHandle, seedRating = 0, seedCount = 0 }: Props) {
  const supabase = useMemo(() => createClient(), []);

  const [reviews, setReviews] = useState<Review[]>([]);
  const [reviewsLoading, setReviewsLoading] = useState(true);
  const [refetchKey, setRefetchKey] = useState(0);
  const [authUser, setAuthUser] = useState<AuthUser | null | 'loading'>('loading');

  const [showForm, setShowForm] = useState(false);
  const [submitState, setSubmitState] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');
  const [submitError, setSubmitError] = useState('');

  const [formRating, setFormRating] = useState(0);
  const [formNickname, setFormNickname] = useState('');
  const [formBody, setFormBody] = useState('');
  const [formPhotos, setFormPhotos] = useState<File[]>([]);
  const [photoPreviewUrls, setPhotoPreviewUrls] = useState<string[]>([]);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);

  // Load auth user
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { setAuthUser(null); return; }
      const firstName = user.user_metadata?.first_name as string | undefined;
      const displayName = firstName ? firstName : maskEmail(user.email ?? '');
      setAuthUser({ id: user.id, email: user.email ?? '', displayName });
    }).catch(() => setAuthUser(null));
  }, [supabase]);

  // Auto-fill nickname when form is opened (only if still empty)
  function openForm() {
    if (!showForm && authUser && authUser !== 'loading' && !formNickname) {
      setFormNickname(authUser.displayName);
    }
    setShowForm((v) => !v);
    setSubmitState('idle');
    setSubmitError('');
  }

  // Fetch reviews
  useEffect(() => {
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setReviewsLoading(true);
    fetch(`/api/reviews?product_id=${encodeURIComponent(productId)}`, { signal: ac.signal })
      .then((res) => res.json() as Promise<{ reviews?: Review[] }>)
      .then((data) => { if (!ac.signal.aborted) setReviews(data.reviews ?? []); })
      .catch(() => {})
      .finally(() => { if (!ac.signal.aborted) setReviewsLoading(false); });

    return () => ac.abort();
  }, [productId, refetchKey]);

  const totalCount = reviews.length > 0 ? reviews.length : seedCount;
  const avgRating = reviews.length > 0
    ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length
    : seedRating;
  const dist = [5, 4, 3, 2, 1].map((star) => ({
    star,
    count: reviews.filter((r) => r.rating === star).length,
  }));

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []).slice(0, 3);
    setFormPhotos(files);
    const urls = files.map((f) => URL.createObjectURL(f));
    setPhotoPreviewUrls(urls);
  }

  function removePhoto(index: number) {
    const updated = formPhotos.filter((_, i) => i !== index);
    setFormPhotos(updated);
    setPhotoPreviewUrls(updated.map((f) => URL.createObjectURL(f)));
  }

  async function uploadPhotos(files: File[]): Promise<string[]> {
    const supabase = createClient();
    const urls: string[] = [];
    for (const file of files) {
      const ext = file.name.split('.').pop() ?? 'jpg';
      const path = `reviews/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { data, error } = await supabase.storage.from('ugc').upload(path, file, { upsert: false });
      if (!error && data) {
        const { data: publicData } = supabase.storage.from('ugc').getPublicUrl(path);
        if (publicData.publicUrl) urls.push(publicData.publicUrl);
      }
    }
    return urls;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!authUser || authUser === 'loading') return;
    if (formRating === 0) { setSubmitError('Please select a star rating.'); return; }
    setSubmitState('sending');
    setSubmitError('');
    try {
      let photoUrls: string[] = [];
      if (formPhotos.length > 0) {
        photoUrls = await uploadPhotos(formPhotos);
      }
      const res = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product_id: productId,
          product_handle: productHandle,
          rating: formRating,
          body_text: formBody,
          nickname: formNickname || authUser.displayName,
          photo_urls: photoUrls,
        }),
      });
      if (!res.ok) {
        const d = await res.json() as { error?: string };
        throw new Error(d.error ?? 'Failed to submit review');
      }
      setSubmitState('success');
      setShowForm(false);
      setFormRating(0);
      setFormBody('');
      setFormPhotos([]);
      setPhotoPreviewUrls([]);
      setRefetchKey((k) => k + 1);
    } catch (err) {
      setSubmitState('error');
      setSubmitError(err instanceof Error ? err.message : 'Something went wrong.');
    }
  }

  const isLoadingAuth = authUser === 'loading';
  const isLoggedIn = authUser !== null && authUser !== 'loading';

  return (
    <section className="mt-16 border-t border-gold-600/20 pt-10">
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <p className="mb-1 text-xs font-medium uppercase tracking-[0.3em] text-gold-400">Reviews</p>
          <div className="flex items-baseline gap-3">
            <span className="font-serif text-4xl font-light text-ivory">{avgRating.toFixed(1)}</span>
            <div>
              <StarRow rating={Math.round(avgRating)} />
              <p className="mt-0.5 text-xs text-ivory-dim">{totalCount} review{totalCount !== 1 ? 's' : ''}</p>
            </div>
          </div>
          {reviews.length > 0 && (
            <div className="mt-4 w-48 space-y-1">
              {dist.map(({ star, count }) => (
                <RatingBar key={star} label={String(star)} count={count} total={reviews.length} />
              ))}
            </div>
          )}
        </div>

        {/* Write a review button — login required */}
        {!isLoadingAuth && (
          isLoggedIn ? (
            <button
              onClick={openForm}
              className="flex-shrink-0 border border-gold-400 px-4 py-2.5 text-xs font-medium uppercase tracking-widest text-gold-400 transition hover:bg-gold-400 hover:text-wine-950"
            >
              {showForm ? 'Cancel' : 'Write a Review'}
            </button>
          ) : (
            <Link
              href="/login"
              className="flex flex-shrink-0 items-center gap-1.5 border border-wine-700 px-4 py-2.5 text-xs font-medium uppercase tracking-widest text-ivory-muted transition hover:border-gold-400/50 hover:text-gold-400"
            >
              <LogIn size={12} />
              Sign in to review
            </Link>
          )
        )}
      </div>

      {/* Review form (logged-in only) */}
      {showForm && isLoggedIn && (
        <form onSubmit={handleSubmit} className="mb-8 border border-gold-600/20 bg-wine-900 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-ivory-muted">Your Review</p>
            <p className="text-[11px] text-ivory-dim">
              Reviewing as{' '}
              <span className="text-ivory">{(authUser as AuthUser).displayName}</span>
            </p>
          </div>

          <div>
            <p className="mb-2 text-xs text-ivory-dim">Rating <span className="text-crimson-400">*</span></p>
            <StarRow rating={formRating} size={22} interactive onChange={setFormRating} />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-widest text-ivory-muted">
              Display name
            </label>
            <input
              type="text"
              value={formNickname}
              onChange={(e) => setFormNickname(e.target.value)}
              required
              maxLength={40}
              placeholder={(authUser as AuthUser).displayName}
              className="w-full border border-wine-700 bg-wine-800 px-3 py-2.5 text-sm text-ivory placeholder-ivory-dim focus:border-gold-400 focus:outline-none transition"
            />
            <p className="mt-1 text-[11px] text-ivory-dim">This is what other shoppers will see. Your email is never shown.</p>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-widest text-ivory-muted">
              Review <span className="text-crimson-400">*</span>
            </label>
            <textarea
              value={formBody}
              onChange={(e) => setFormBody(e.target.value)}
              required
              minLength={10}
              rows={4}
              placeholder="Share your honest experience — fit, feel, quality..."
              className="w-full resize-none border border-wine-700 bg-wine-800 px-3 py-2.5 text-sm text-ivory placeholder-ivory-dim focus:border-gold-400 focus:outline-none transition"
            />
          </div>

          {/* Photo upload */}
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-widest text-ivory-muted">
              Photos (optional, up to 3)
            </p>
            <div className="flex flex-wrap items-center gap-2">
              {photoPreviewUrls.map((url, i) => (
                <div key={i} className="relative h-20 w-20">
                  <Image src={url} alt={`Preview ${i + 1}`} fill sizes="80px" className="object-cover" />
                  <button
                    type="button"
                    onClick={() => removePhoto(i)}
                    className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-wine-900 text-ivory-dim hover:text-crimson-400"
                  >
                    <XIcon size={10} />
                  </button>
                </div>
              ))}
              {formPhotos.length < 3 && (
                <label className="flex h-20 w-20 cursor-pointer flex-col items-center justify-center gap-1 border border-dashed border-wine-700 text-ivory-dim transition hover:border-gold-400 hover:text-gold-400">
                  <Camera size={16} />
                  <span className="text-[10px] uppercase tracking-wider">Add</span>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={handlePhotoChange}
                  />
                </label>
              )}
            </div>
            <p className="mt-1 text-[11px] text-ivory-dim">
              Real photos help other shoppers. Your face is never required.
            </p>
          </div>

          {submitError && (
            <p className="border border-crimson-400/30 bg-crimson-700/10 px-3 py-2 text-xs text-crimson-400">{submitError}</p>
          )}

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={submitState === 'sending'}
              className="border border-gold-400 px-6 py-2.5 text-xs font-medium uppercase tracking-widest text-gold-400 transition hover:bg-gold-400 hover:text-wine-950 disabled:cursor-wait disabled:opacity-50"
            >
              {submitState === 'sending' ? 'Submitting...' : 'Submit Review'}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="text-xs text-ivory-dim hover:text-gold-400 transition"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Review list */}
      {reviewsLoading ? (
        <div className="flex justify-center py-8">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-gold-400/30 border-t-gold-400" />
        </div>
      ) : reviews.length === 0 ? (
        <div className="py-8 text-center">
          <p className="text-sm text-ivory-muted">No reviews yet. Be the first to share your experience.</p>
          {!isLoggedIn && !isLoadingAuth && (
            <Link href="/login" className="mt-3 inline-block text-xs text-gold-400 hover:underline">
              Sign in to write the first review →
            </Link>
          )}
        </div>
      ) : (
        <>
        <div className="space-y-6">
          {reviews.map((review) => (
            <div key={review.id} className="border-b border-gold-600/10 pb-6">
              <StarRow rating={review.rating} size={12} />
              <p className="mt-1.5 text-sm font-light leading-relaxed text-ivory">{review.body}</p>
              {review.photo_urls && review.photo_urls.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {review.photo_urls.map((url, i) => (
                    <button
                      key={i}
                      onClick={() => setLightboxSrc(url)}
                      className="relative h-20 w-20 overflow-hidden transition hover:opacity-90"
                    >
                      <Image src={url} alt={`Review photo ${i + 1}`} fill sizes="80px" className="object-cover" />
                    </button>
                  ))}
                </div>
              )}
              <div className="mt-3 flex items-center gap-3">
                <span className="text-xs font-medium text-ivory-muted">{review.nickname}</span>
                {review.verified_purchase && (
                  <span className="border border-gold-600/30 px-2 py-0.5 text-[10px] font-medium uppercase tracking-widest text-gold-400">
                    Verified
                  </span>
                )}
                <span className="text-xs text-ivory-dim">
                  {new Date(review.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Photo lightbox */}
        {lightboxSrc && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-wine-950/90 backdrop-blur-sm"
            onClick={() => setLightboxSrc(null)}
          >
            <button
              className="absolute right-4 top-4 text-ivory-dim hover:text-gold-400"
              onClick={() => setLightboxSrc(null)}
            >
              <XIcon size={22} />
            </button>
            <div className="relative max-h-[85vh] max-w-xl w-full mx-4">
              <Image
                src={lightboxSrc}
                alt="Review photo"
                width={600}
                height={800}
                className="h-auto w-full object-contain"
              />
            </div>
          </div>
        )}
        </>
      )}
    </section>
  );
}
