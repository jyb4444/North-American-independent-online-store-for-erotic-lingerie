'use client'; // Error boundaries must be Client Components

import { useEffect } from 'react';
import Link from 'next/link';

export default function Error({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-4 text-center">
      <p className="mb-2 text-xs font-medium uppercase tracking-[0.3em] text-gold-400">Something went wrong</p>
      <h1 className="font-serif text-3xl font-light text-ivory">We couldn&rsquo;t load this page</h1>
      <p className="mt-3 text-sm text-ivory-muted">
        Please try again. If it keeps happening, contact us and mention reference{' '}
        <span className="font-mono text-ivory">{error.digest ?? 'n/a'}</span>.
      </p>
      <div className="mt-8 flex gap-3">
        <button
          type="button"
          onClick={() => unstable_retry()}
          className="border border-gold-400 px-6 py-2.5 text-xs uppercase tracking-widest text-gold-400 transition hover:bg-gold-400 hover:text-wine-950"
        >
          Try again
        </button>
        <Link href="/" className="border border-wine-700 px-6 py-2.5 text-xs uppercase tracking-widest text-ivory-muted transition hover:border-gold-400/50 hover:text-gold-400">
          Home
        </Link>
      </div>
    </div>
  );
}
