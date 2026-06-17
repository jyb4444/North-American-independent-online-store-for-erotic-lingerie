'use client';

import useEmblaCarousel from 'embla-carousel-react';
import { useCallback } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import ProductCard from '@/components/product/ProductCard';
import type { Product } from '@/types';

type Props = { products: Product[] };

export default function ProductCarousel({ products }: Props) {
  const [emblaRef, emblaApi] = useEmblaCarousel({
    align: 'start',
    containScroll: 'trimSnaps',
    dragFree: true,
  });

  const prev = useCallback(() => emblaApi?.scrollPrev(), [emblaApi]);
  const next = useCallback(() => emblaApi?.scrollNext(), [emblaApi]);

  return (
    <div className="relative">
      {/* Nav buttons */}
      <button
        onClick={prev}
        className="absolute -left-4 top-[30%] z-10 hidden border border-gold-600/30 p-2 text-gold-400/70 backdrop-blur-sm transition hover:border-gold-400 hover:text-gold-400 md:block"
      >
        <ChevronLeft size={16} />
      </button>
      <button
        onClick={next}
        className="absolute -right-4 top-[30%] z-10 hidden border border-gold-600/30 p-2 text-gold-400/70 backdrop-blur-sm transition hover:border-gold-400 hover:text-gold-400 md:block"
      >
        <ChevronRight size={16} />
      </button>

      {/* Carousel */}
      <div ref={emblaRef} className="overflow-hidden">
        <div className="flex gap-4">
          {products.map((product) => (
            <div
              key={product.id}
              className="min-w-[calc(50%-8px)] flex-shrink-0 sm:min-w-[calc(33.333%-11px)] lg:min-w-[calc(25%-12px)]"
            >
              <ProductCard product={product} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
