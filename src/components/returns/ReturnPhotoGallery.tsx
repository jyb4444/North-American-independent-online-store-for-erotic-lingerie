'use client';

import Image from 'next/image';
import { useState } from 'react';
import { X, ZoomIn } from 'lucide-react';
import type { SignedReturnMedia } from '@/lib/returns';

type ReturnPhotoGalleryProps = {
  photos: SignedReturnMedia[];
};

export default function ReturnPhotoGallery({ photos }: ReturnPhotoGalleryProps) {
  const [active, setActive] = useState<SignedReturnMedia | null>(null);

  if (photos.length === 0) {
    return <p className="text-xs text-ivory-dim">No photos uploaded.</p>;
  }

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {photos.map((photo, index) => (
          <button
            key={photo.path}
            type="button"
            onClick={() => setActive(photo)}
            className="group relative h-16 w-16 overflow-hidden border border-gold-600/20 bg-wine-950 transition hover:border-gold-400"
            aria-label={`Open return photo ${index + 1}`}
          >
            <Image
              src={photo.signedUrl}
              alt={`Return photo ${index + 1}`}
              width={96}
              height={96}
              className="h-full w-full object-cover"
            />
            <span className="absolute inset-0 flex items-center justify-center bg-wine-950/0 text-ivory opacity-0 transition group-hover:bg-wine-950/45 group-hover:opacity-100">
              <ZoomIn size={16} />
            </span>
          </button>
        ))}
      </div>

      {active && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-wine-950/90 px-4 py-8"
          role="dialog"
          aria-modal="true"
          onClick={() => setActive(null)}
        >
          <button
            type="button"
            onClick={() => setActive(null)}
            className="absolute right-4 top-4 border border-gold-600/30 bg-wine-900 p-2 text-ivory-muted transition hover:border-gold-400 hover:text-gold-400"
            aria-label="Close photo preview"
          >
            <X size={18} />
          </button>
          <div className="relative max-h-[82vh] w-full max-w-4xl" onClick={(event) => event.stopPropagation()}>
            <Image
              src={active.signedUrl}
              alt="Return photo preview"
              width={1200}
              height={900}
              className="max-h-[82vh] w-full object-contain"
              priority
            />
          </div>
        </div>
      )}
    </>
  );
}
