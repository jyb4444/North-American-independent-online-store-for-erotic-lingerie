'use client';

import Link from 'next/link';
import { ChevronRight } from 'lucide-react';

type Crumb = { label: string; href?: string };

export default function Breadcrumb({ crumbs }: { crumbs: Crumb[] }) {
  return (
    <nav aria-label="Breadcrumb" className="mb-6 flex items-center gap-1.5 text-[11px] text-ivory-dim">
      {crumbs.map((crumb, i) => (
        <span key={i} className="flex items-center gap-1.5">
          {i > 0 && <ChevronRight size={10} className="text-wine-700" />}
          {crumb.href ? (
            <Link href={crumb.href} className="uppercase tracking-widest transition hover:text-gold-400">
              {crumb.label}
            </Link>
          ) : (
            <span className="uppercase tracking-widest text-ivory-muted">{crumb.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}
