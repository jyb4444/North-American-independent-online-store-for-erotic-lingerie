'use client';

import { Component, type ReactNode } from 'react';
import Link from 'next/link';

type Props = { children: ReactNode; fallback?: ReactNode };
type State = { hasError: boolean; message: string };

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message };
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? (
        <div className="flex min-h-[50vh] flex-col items-center justify-center px-4 text-center">
          <span className="mb-4 font-serif text-4xl text-gold-600/40 select-none">✦</span>
          <h2 className="font-serif text-2xl font-light italic text-ivory">Something went wrong</h2>
          <p className="mt-2 text-sm text-ivory-muted">We encountered an unexpected error.</p>
          <div className="mt-6 flex gap-3">
            <button onClick={() => this.setState({ hasError: false, message: '' })}
              className="border border-gold-400 px-5 py-2.5 text-xs uppercase tracking-widest text-gold-400 transition hover:bg-gold-400 hover:text-wine-950">
              Try Again
            </button>
            <Link href="/"
              className="border border-wine-700 px-5 py-2.5 text-xs uppercase tracking-widest text-ivory-muted transition hover:border-gold-600/50 hover:text-gold-400">
              Go Home
            </Link>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
