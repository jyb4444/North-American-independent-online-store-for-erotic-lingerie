'use client';

import { useState } from 'react';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Ruler } from 'lucide-react';
import { track } from '@/lib/analytics';
import type { ModelMeasurements } from '@/types';

const VIDEO_SENTINEL = '__video__';

type Props = {
  images: string[];
  video?: string;
  productId: string;
  title: string;
  modelMeasurements?: ModelMeasurements;
};

export default function ProductGallery({ images, video, productId, title, modelMeasurements }: Props) {
  // Combine images + optional video slot
  const mediaItems: string[] = video ? [...images, VIDEO_SENTINEL] : images;
  const [activeIndex, setActiveIndex] = useState(0);
  const [zoom, setZoom] = useState({ active: false, x: 50, y: 50 });

  const isVideo = mediaItems[activeIndex] === VIDEO_SENTINEL;

  function selectMedia(index: number) {
    setActiveIndex(index);
    if (mediaItems[index] !== VIDEO_SENTINEL) {
      track.productImageViewed(productId, index);
    }
  }

  return (
    <div className="flex flex-col gap-3 md:flex-row-reverse">
      {/* Main viewer */}
      <div className="relative flex-1">
        <div
          className={`relative aspect-[3/4] overflow-hidden rounded-2xl bg-zinc-900 ${isVideo ? '' : 'cursor-zoom-in'}`}
          onMouseMove={(event) => {
            if (isVideo) return;
            const rect = event.currentTarget.getBoundingClientRect();
            setZoom({
              active: true,
              x: ((event.clientX - rect.left) / rect.width) * 100,
              y: ((event.clientY - rect.top) / rect.height) * 100,
            });
          }}
          onMouseLeave={() => setZoom((c) => ({ ...c, active: false }))}
        >
          <AnimatePresence mode="wait">
            {isVideo ? (
              <motion.div key="video" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0">
                <video
                  src={video}
                  controls
                  playsInline
                  autoPlay
                  muted
                  loop
                  className="h-full w-full object-cover"
                />
              </motion.div>
            ) : (
              <motion.div
                key={activeIndex}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.25 }}
                className="absolute inset-0"
              >
                <Image
                  src={mediaItems[activeIndex]}
                  alt={`${title} — image ${activeIndex + 1}`}
                  fill
                  priority={activeIndex === 0}
                  sizes="(max-width: 768px) 100vw, 55vw"
                  className="object-cover"
                />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Zoom overlay (images only) */}
          {!isVideo && zoom.active && (
            <div
              className="pointer-events-none absolute inset-0 hidden bg-cover bg-no-repeat md:block"
              style={{
                backgroundImage: `url(${mediaItems[activeIndex]})`,
                backgroundPosition: `${zoom.x}% ${zoom.y}%`,
                backgroundSize: '220%',
              }}
            >
              <div className="absolute inset-0 ring-1 ring-gold-400/40" />
            </div>
          )}
        </div>

        {/* Model measurements badge */}
        {modelMeasurements && (
          <div className="mt-2 flex items-center gap-1.5 text-[11px] text-ivory-dim">
            <Ruler size={11} className="text-gold-400/60" />
            <span>
              Model: {modelMeasurements.height}
              {modelMeasurements.bust ? `, ${modelMeasurements.bust}` : ''}
              {' '}— wearing size {modelMeasurements.size}
            </span>
          </div>
        )}
      </div>

      {/* Thumbnails */}
      {mediaItems.length > 1 && (
        <div className="flex gap-2 md:flex-col">
          {mediaItems.map((src, i) => {
            const isVid = src === VIDEO_SENTINEL;
            return (
              <button
                key={i}
                onClick={() => selectMedia(i)}
                className={`relative h-16 w-16 flex-shrink-0 overflow-hidden rounded-lg border-2 transition ${
                  i === activeIndex ? 'border-white' : 'border-transparent opacity-50 hover:opacity-80'
                }`}
              >
                {isVid ? (
                  <div className="flex h-full w-full items-center justify-center bg-wine-800">
                    <Play size={18} className="fill-gold-400 text-gold-400" />
                  </div>
                ) : (
                  <Image src={src} alt={`Thumbnail ${i + 1}`} fill sizes="64px" className="object-cover" />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
