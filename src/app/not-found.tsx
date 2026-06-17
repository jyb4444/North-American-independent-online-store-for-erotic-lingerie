import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center px-4 text-center">
      <span className="mb-4 font-serif text-6xl font-light text-gold-600/30 select-none">404</span>
      <h1 className="font-serif text-3xl font-light italic text-ivory">Page Not Found</h1>
      <div className="mx-auto my-5 h-px w-12 bg-gold-400/40" />
      <p className="max-w-sm text-sm text-ivory-muted">
        The page you&apos;re looking for doesn&apos;t exist or has been moved.
      </p>
      <div className="mt-8 flex gap-4">
        <Link href="/"
          className="border border-gold-400 px-6 py-3 text-xs font-medium uppercase tracking-[0.2em] text-gold-400 transition hover:bg-gold-400 hover:text-wine-950">
          Go Home
        </Link>
        <Link href="/collections/new-arrivals"
          className="border border-wine-700 px-6 py-3 text-xs uppercase tracking-widest text-ivory-muted transition hover:border-gold-600/50 hover:text-gold-400">
          Shop New Arrivals
        </Link>
      </div>
    </div>
  );
}
