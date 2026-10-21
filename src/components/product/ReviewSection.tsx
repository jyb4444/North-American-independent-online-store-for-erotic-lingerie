'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Star, LogIn, Upload, X as XIcon, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

const MAX_PHOTOS = 3;
const MAX_PHOTO_MB = 5;
const MAX_VIDEOS = 1;
const MAX_VIDEO_MB = 50;
const MAX_VIDEO_SECONDS = 20;
const MAX_REVIEW_CHARS = 300;
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime'];
const MEDIA_ACCEPT = [...ALLOWED_IMAGE_TYPES, ...ALLOWED_VIDEO_TYPES].join(',');

type Review = {
  id: string;
  product_id: string;
  rating: number;
  body: string;
  nickname: string;
  verified_purchase: boolean;
  created_at: string;
  photo_urls?: string[];
  video_urls?: string[];
  is_anonymous?: boolean;
  pending?: boolean;
};

type AuthUser = { id: string; email: string; phone: string; displayName: string };

type Props = { productId: string; productHandle: string; seedRating?: number; seedCount?: number };

function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!domain) return email;
  return `${local.slice(0, 3)}***@${domain}`;
}

function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 7) return phone;
  return `${digits.slice(0, 3)}***${digits.slice(-4)}`;
}

function metadataPhone(metadata: Record<string, unknown> | null | undefined): string {
  const value = metadata?.phone ?? metadata?.phone_number;
  return typeof value === 'string' ? value : '';
}

function getVideoDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      resolve(video.duration);
    };
    video.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not read video duration.'));
    };
    video.src = url;
  });
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
  const [pendingReviews, setPendingReviews] = useState<Review[]>([]);
  const [reviewsLoading, setReviewsLoading] = useState(true);
  const [refetchKey, setRefetchKey] = useState(0);
  const [authUser, setAuthUser] = useState<AuthUser | null | 'loading'>('loading');

  const [showForm, setShowForm] = useState(false);
  const [submitState, setSubmitState] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');
  const [submitError, setSubmitError] = useState('');
  const [mediaError, setMediaError] = useState('');

  const [formRating, setFormRating] = useState(0);
  const [formBody, setFormBody] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [formPhotos, setFormPhotos] = useState<File[]>([]);
  const [photoPreviewUrls, setPhotoPreviewUrls] = useState<string[]>([]);
  const [formVideos, setFormVideos] = useState<File[]>([]);
  const [videoPreviewUrls, setVideoPreviewUrls] = useState<string[]>([]);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);

  // Load auth user
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { setAuthUser(null); return; }
      const phone = user.phone ?? metadataPhone(user.user_metadata);
      const displayName = phone ? maskPhone(phone) : user.email ? maskEmail(user.email) : 'Verified shopper';
      setAuthUser({ id: user.id, email: user.email ?? '', phone, displayName });
    }).catch(() => setAuthUser(null));
  }, [supabase]);

  useEffect(() => () => {
    photoPreviewUrls.forEach((url) => URL.revokeObjectURL(url));
    videoPreviewUrls.forEach((url) => URL.revokeObjectURL(url));
  }, [photoPreviewUrls, videoPreviewUrls]);

  // Open the review form and clear stale validation messages.
  function openForm() {
    setShowForm((v) => !v);
    setSubmitState('idle');
    setSubmitError('');
    setMediaError('');
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
  const pendingIds = new Set(pendingReviews.map((review) => review.id));
  const visibleReviews = [
    ...pendingReviews,
    ...reviews.filter((review) => !pendingIds.has(review.id)),
  ];
  const avgRating = reviews.length > 0
    ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length
    : seedRating;
  const dist = [5, 4, 3, 2, 1].map((star) => ({
    star,
    count: reviews.filter((r) => r.rating === star).length,
  }));

  function replacePreviewUrls(setter: React.Dispatch<React.SetStateAction<string[]>>, urls: string[]) {
    setter((current) => {
      current.forEach((url) => URL.revokeObjectURL(url));
      return urls;
    });
  }

  async function handleMediaChange(e: React.ChangeEvent<HTMLInputElement>) {
    setSubmitError('');
    setMediaError('');
    const candidates = Array.from(e.target.files ?? []);
    const nextPhotos = [...formPhotos];
    const nextVideos = [...formVideos];
    const errors: string[] = [];

    for (const file of candidates) {
      if (ALLOWED_IMAGE_TYPES.includes(file.type)) {
        if (nextPhotos.length >= MAX_PHOTOS) {
          errors.push(`You can upload up to ${MAX_PHOTOS} photos.`);
          continue;
        }
        if (file.size > MAX_PHOTO_MB * 1024 * 1024) {
          errors.push(`Each photo must be ${MAX_PHOTO_MB}MB or smaller.`);
          continue;
        }
        nextPhotos.push(file);
        continue;
      }

      if (ALLOWED_VIDEO_TYPES.includes(file.type)) {
        if (nextVideos.length >= MAX_VIDEOS) {
          errors.push(`You can upload up to ${MAX_VIDEOS} video.`);
          continue;
        }
        if (file.size > MAX_VIDEO_MB * 1024 * 1024) {
          errors.push(`Video must be ${MAX_VIDEO_MB}MB or smaller.`);
          continue;
        }
        try {
          const duration = await getVideoDuration(file);
          if (duration > MAX_VIDEO_SECONDS) {
            errors.push(`Video must be ${MAX_VIDEO_SECONDS} seconds or shorter.`);
            continue;
          }
        } catch {
          errors.push('Could not read the selected video. Please try another file.');
          continue;
        }
        nextVideos.push(file);
        continue;
      }

      errors.push('Unsupported file type. Use JPG, PNG, WebP, MP4, WebM, or MOV.');
    }

    setFormPhotos(nextPhotos);
    replacePreviewUrls(setPhotoPreviewUrls, nextPhotos.map((f) => URL.createObjectURL(f)));
    setFormVideos(nextVideos);
    replacePreviewUrls(setVideoPreviewUrls, nextVideos.map((f) => URL.createObjectURL(f)));
    setMediaError([...new Set(errors)].join(' '));
    e.target.value = '';
  }

  function removePhoto(index: number) {
    const updated = formPhotos.filter((_, i) => i !== index);
    setFormPhotos(updated);
    replacePreviewUrls(setPhotoPreviewUrls, updated.map((f) => URL.createObjectURL(f)));
  }

  function removeVideo() {
    setFormVideos([]);
    replacePreviewUrls(setVideoPreviewUrls, []);
  }

  async function uploadMedia(files: File[], folder: 'photos' | 'videos'): Promise<string[]> {
    const supabase = createClient();
    const urls: string[] = [];
    for (const file of files) {
      const ext = file.name.split('.').pop() ?? (folder === 'photos' ? 'jpg' : 'mp4');
      const path = `reviews/${folder}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { data, error } = await supabase.storage.from('ugc').upload(path, file, { upsert: false });
      if (error) {
        throw new Error(`Could not upload ${folder === 'photos' ? 'photo' : 'video'}: ${error.message}`);
      }
      if (!data) {
        throw new Error(`Could not upload ${folder === 'photos' ? 'photo' : 'video'}.`);
      }
      const { data: publicData } = supabase.storage.from('ugc').getPublicUrl(path);
      if (!publicData.publicUrl) {
        throw new Error(`Could not create ${folder === 'photos' ? 'photo' : 'video'} URL.`);
      }
      urls.push(publicData.publicUrl);
    }
    return urls;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!authUser || authUser === 'loading') return;
    if (formRating === 0) { setSubmitError('Please select a star rating.'); return; }
    if (formBody.length > MAX_REVIEW_CHARS) { setSubmitError(`Review must be under ${MAX_REVIEW_CHARS} characters.`); return; }
    setSubmitState('sending');
    setSubmitError('');
    try {
      let photoUrls: string[] = [];
      let videoUrls: string[] = [];
      if (formPhotos.length > 0) {
        photoUrls = await uploadMedia(formPhotos, 'photos');
      }
      if (formVideos.length > 0) {
        videoUrls = await uploadMedia(formVideos, 'videos');
      }
      const res = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product_id: productId,
          product_handle: productHandle,
          rating: formRating,
          body_text: formBody,
          photo_urls: photoUrls,
          video_urls: videoUrls,
          is_anonymous: isAnonymous,
        }),
      });
      if (!res.ok) {
        const d = await res.json() as { error?: string };
        throw new Error(d.error ?? 'Failed to submit review');
      }
      const data = await res.json() as { review?: Review };
      if (data.review) {
        setPendingReviews((current) => [
          data.review as Review,
          ...current.filter((review) => review.id !== data.review?.id),
        ]);
      }
      setSubmitState('success');
      setShowForm(false);
      setFormRating(0);
      setFormBody('');
      setIsAnonymous(false);
      setFormPhotos([]);
      replacePreviewUrls(setPhotoPreviewUrls, []);
      setFormVideos([]);
      replacePreviewUrls(setVideoPreviewUrls, []);
      setMediaError('');
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
      <div className="mb-10 grid gap-8 lg:grid-cols-[300px_1fr]">
        <aside className="border border-gold-600/20 bg-wine-900/70 p-5">
          <p className="mb-3 text-xs font-medium uppercase tracking-[0.3em] text-gold-400">Customer reviews</p>
          <div className="flex items-center gap-3">
            <span className="font-serif text-5xl font-light text-ivory">{avgRating.toFixed(1)}</span>
            <div>
              <StarRow rating={Math.round(avgRating)} size={17} />
              <p className="mt-1 text-sm text-ivory-muted">{totalCount} global rating{totalCount !== 1 ? 's' : ''}</p>
            </div>
          </div>
          <div className="mt-5 space-y-2">
            {dist.map(({ star, count }) => (
              <RatingBar key={star} label={`${star}`} count={count} total={reviews.length || totalCount} />
            ))}
          </div>
          <p className="mt-4 border-t border-gold-600/15 pt-4 text-xs leading-5 text-ivory-dim">
            Reviews can include photos and one short video. We moderate submissions before publishing.
          </p>
        </aside>

        <div className="flex flex-col justify-between gap-5 border border-gold-600/20 bg-wine-950/30 p-5 sm:flex-row sm:items-center">
          <div>
            <h2 className="font-serif text-3xl font-light text-ivory">Review this item</h2>
            <p className="mt-2 max-w-xl text-sm leading-6 text-ivory-muted">
              Share fit, feel, quality, sizing, and delivery notes. Other shoppers rely on details more than perfect photos.
            </p>
            <div className="mt-4 flex flex-wrap gap-2 text-[11px] uppercase tracking-widest text-ivory-dim">
              <span className="border border-wine-700 px-2.5 py-1">3 photos max</span>
              <span className="border border-wine-700 px-2.5 py-1">20s video max</span>
              <span className="border border-wine-700 px-2.5 py-1">Anonymous allowed</span>
            </div>
          </div>

          {!isLoadingAuth && (
            isLoggedIn ? (
              <button
                onClick={openForm}
                className="flex-shrink-0 border border-gold-400 px-5 py-3 text-xs font-medium uppercase tracking-widest text-gold-400 transition hover:bg-gold-400 hover:text-wine-950"
              >
                {showForm ? 'Cancel' : 'Write a Review'}
              </button>
            ) : (
              <Link
                href="/login"
                className="flex flex-shrink-0 items-center justify-center gap-1.5 border border-wine-700 px-5 py-3 text-xs font-medium uppercase tracking-widest text-ivory-muted transition hover:border-gold-400/50 hover:text-gold-400"
              >
                <LogIn size={12} />
                Sign in to review
              </Link>
            )
          )}
        </div>
      </div>

      {/* Review form (logged-in only) */}
      {showForm && isLoggedIn && (
        <form onSubmit={handleSubmit} className="mb-10 border border-gold-600/20 bg-wine-900 p-5 sm:p-6">
          <div className="flex flex-col gap-2 border-b border-gold-600/15 pb-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.2em] text-gold-400">Create customer review</p>
              <p className="mt-1 text-sm text-ivory-dim">
                Posting as <span className="text-ivory">{(authUser as AuthUser).displayName}</span>. Your contact information stays private.
              </p>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-ivory-dim">
              <ShieldCheck size={14} className="text-gold-400" />
              Moderated before publishing
            </div>
          </div>

          <div className="mt-5 space-y-5">
            <div>
              <p className="mb-2 text-sm font-medium text-ivory-muted">Overall rating <span className="text-crimson-400">*</span></p>
              <StarRow rating={formRating} size={28} interactive onChange={setFormRating} />
            </div>

            <div>
              <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
                <label className="text-sm font-medium text-ivory-muted">
                  Written review <span className="text-crimson-400">*</span>
                </label>
                <div className="flex items-center gap-4">
                  <label className="flex cursor-pointer items-center gap-2 text-sm text-ivory-muted">
                    <input
                      type="checkbox"
                      checked={isAnonymous}
                      onChange={(e) => setIsAnonymous(e.target.checked)}
                      className="h-4 w-4 accent-gold-400"
                    />
                    <span>Post anonymously</span>
                  </label>
                  <span className="text-xs text-ivory-dim">{formBody.length}/{MAX_REVIEW_CHARS}</span>
                </div>
              </div>
              <textarea
                value={formBody}
                onChange={(e) => setFormBody(e.target.value)}
                required
                minLength={10}
                maxLength={MAX_REVIEW_CHARS}
                rows={5}
                placeholder="What should other shoppers know about fit, fabric, comfort, quality, or sizing?"
                className="w-full resize-none border border-wine-700 bg-wine-800 px-4 py-3 text-[15px] leading-6 text-ivory placeholder-ivory-dim transition focus:border-gold-400 focus:outline-none"
              />
              {isAnonymous && (
                <p className="mt-1.5 text-xs text-ivory-dim">Your review will show as Anonymous shopper.</p>
              )}
            </div>
          </div>

          <div className="mt-6 border-t border-gold-600/15 pt-5">
            <div>
              <p className="mb-2 text-sm font-medium text-ivory-muted">
                Upload media <span className="text-xs font-normal text-ivory-dim">(optional)</span>
              </p>
              <div className="flex flex-wrap items-center gap-3">
                {photoPreviewUrls.map((url, i) => (
                  <div key={url} className="relative h-24 w-24 overflow-hidden border border-wine-700">
                    <Image src={url} alt={`Preview ${i + 1}`} fill sizes="96px" className="object-cover" />
                    <button
                      type="button"
                      onClick={() => removePhoto(i)}
                      className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center bg-wine-950/85 text-ivory-dim transition hover:text-crimson-400"
                      aria-label="Remove photo"
                    >
                      <XIcon size={13} />
                    </button>
                  </div>
                ))}
                {videoPreviewUrls.map((url) => (
                  <div key={url} className="relative h-24 w-36 overflow-hidden border border-wine-700 bg-wine-950">
                    <video src={url} className="h-full w-full object-cover" controls />
                    <button
                      type="button"
                      onClick={removeVideo}
                      className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center bg-wine-950/85 text-ivory-dim transition hover:text-crimson-400"
                      aria-label="Remove video"
                    >
                      <XIcon size={13} />
                    </button>
                  </div>
                ))}
                {(formPhotos.length < MAX_PHOTOS || formVideos.length < MAX_VIDEOS) && (
                  <label className="flex h-24 w-36 cursor-pointer flex-col items-center justify-center gap-1 border border-dashed border-wine-700 text-ivory-dim transition hover:border-gold-400 hover:text-gold-400">
                    <Upload size={19} />
                    <span className="text-[10px] uppercase tracking-wider">Upload file</span>
                    <input
                      type="file"
                      accept={MEDIA_ACCEPT}
                      multiple
                      className="hidden"
                      onChange={handleMediaChange}
                    />
                  </label>
                )}
              </div>
              <p className="mt-2 text-xs text-ivory-dim">
                JPG, PNG, WebP up to {MAX_PHOTOS} photos ({MAX_PHOTO_MB}MB each). MP4, WebM, or MOV up to {MAX_VIDEO_SECONDS}s and {MAX_VIDEO_MB}MB.
              </p>
              {mediaError && (
                <p className="mt-2 text-sm text-crimson-400">{mediaError}</p>
              )}
            </div>
          </div>

          {submitError && (
            <p className="mt-5 border border-crimson-400/30 bg-crimson-700/10 px-3 py-2 text-sm text-crimson-400">{submitError}</p>
          )}

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={submitState === 'sending'}
              className="border border-gold-400 px-7 py-3 text-xs font-medium uppercase tracking-widest text-gold-400 transition hover:bg-gold-400 hover:text-wine-950 disabled:cursor-wait disabled:opacity-50"
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
      ) : visibleReviews.length === 0 ? (
        <div className="border border-gold-600/15 bg-wine-900/40 py-10 text-center">
          <p className="font-serif text-2xl font-light text-ivory">No customer reviews yet</p>
          <p className="mt-2 text-sm text-ivory-muted">Be the first to share fit, quality, and comfort notes for this item.</p>
          {!isLoggedIn && !isLoadingAuth && (
            <Link href="/login" className="mt-3 inline-block text-xs text-gold-400 hover:underline">
              Sign in to write the first review →
            </Link>
          )}
        </div>
      ) : (
        <>
        <div className="space-y-0 border-t border-gold-600/15">
          {visibleReviews.map((review) => (
            <article key={review.id} className="border-b border-gold-600/15 py-6">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <span className="text-sm font-medium text-ivory">
                  {review.is_anonymous ? 'Anonymous shopper' : review.nickname}
                </span>
                {review.pending && (
                  <span className="border border-wine-700 px-2 py-0.5 text-[10px] font-medium uppercase tracking-widest text-ivory-dim">
                    Pending approval
                  </span>
                )}
                {review.verified_purchase && (
                  <span className="inline-flex items-center gap-1 border border-gold-600/30 px-2 py-0.5 text-[10px] font-medium uppercase tracking-widest text-gold-400">
                    <CheckCircle2 size={11} />
                    Verified purchase
                  </span>
                )}
                <span className="text-xs text-ivory-dim">
                  Reviewed on {new Date(review.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                </span>
              </div>

              <div className="mt-2 flex items-center gap-2">
                <StarRow rating={review.rating} size={15} />
                <span className="text-sm font-medium text-ivory-muted">{review.rating}.0 out of 5 stars</span>
              </div>

              <p className="mt-3 max-w-3xl text-[15px] font-light leading-7 text-ivory">{review.body}</p>

              {review.photo_urls && review.photo_urls.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-3">
                  {review.photo_urls.map((url, i) => (
                    <button
                      key={i}
                      onClick={() => setLightboxSrc(url)}
                      className="relative h-24 w-24 overflow-hidden border border-wine-700 transition hover:border-gold-400/50 hover:opacity-90"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={url} alt={`Review photo ${i + 1}`} className="h-full w-full object-cover" />
                    </button>
                  ))}
                </div>
              )}

              {review.video_urls && review.video_urls.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-3">
                  {review.video_urls.map((url, i) => (
                    <video
                      key={url}
                      src={url}
                      controls
                      className="h-36 w-56 border border-wine-700 bg-wine-950 object-cover"
                      aria-label={`Review video ${i + 1}`}
                    />
                  ))}
                </div>
              )}
            </article>
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
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={lightboxSrc}
                alt="Review photo"
                className="max-h-[85vh] w-full object-contain"
              />
            </div>
          </div>
        )}
        </>
      )}
    </section>
  );
}
