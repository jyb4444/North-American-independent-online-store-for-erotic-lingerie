'use client';

import useEmblaCarousel from 'embla-carousel-react';
import Autoplay from 'embla-carousel-autoplay';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ChevronLeft, ChevronRight } from 'lucide-react';

type Slide = {
  id: string;
  image: string;
  tag: string;
  headline: string;
  sub: string;
  cta: string;
  href: string;
};

const SLIDES: Slide[] = [
  {
    id: 's1',
    image: 'https://images.unsplash.com/photo-1574539602047-548bf9557352?auto=format&fit=crop&w=1600&h=900&q=80',
    tag: 'AI Try-On Preview',
    headline: 'See It On\nYour Shape',
    sub: 'Preview lingerie styles on a figure matched to your body profile before you decide.',
    cta: 'Try AI Preview',
    href: '/products/lace-halter-babydoll-set',
  },
  {
    id: 's2',
    image: 'https://images.unsplash.com/photo-1642945680515-faada4c0ca7b?auto=format&fit=crop&w=1600&h=900&q=80',
    tag: 'Personalized Monthly Membership',
    headline: 'Lingerie Chosen\nFor You',
    sub: 'Gold, Platinum, and Diamond members receive monthly style picks matched to their body profile and preferences.',
    cta: 'Explore Membership',
    href: '/membership',
  },
  {
    id: 's3',
    image: 'https://images.unsplash.com/photo-1526404746352-668ded9b50ab?auto=format&fit=crop&w=1600&h=900&q=80',
    tag: 'Intimacy & Music Therapy',
    headline: 'Support Beyond\nThe Product',
    sub: 'Diamond members and qualifying customers can access 30-minute sessions for emotional, intimacy, and relationship support.',
    cta: 'Learn About Therapy',
    href: '/pages/about',
  },
];

export default function HeroCarousel() {
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true }, [
    Autoplay({ delay: 5000, stopOnInteraction: true }),
  ]);
  const [activeIndex, setActiveIndex] = useState(0);

  const prev = useCallback(() => emblaApi?.scrollPrev(), [emblaApi]);
  const next = useCallback(() => emblaApi?.scrollNext(), [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    emblaApi.on('select', () => setActiveIndex(emblaApi.selectedScrollSnap()));
  }, [emblaApi]);

  return (
    <div className="relative h-[88vh] min-h-[560px] overflow-hidden">
      <div ref={emblaRef} className="h-full overflow-hidden">
        <div className="flex h-full">
          {SLIDES.map((slide) => (
            <div key={slide.id} className="relative h-full min-w-full flex-shrink-0">
              <Image
                src={slide.image}
                alt={slide.headline}
                fill
                priority
                sizes="100vw"
                className="object-cover object-center"
              />
              {/* Gradient overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-wine-950 via-wine-950/50 to-wine-950/10" />
              <div className="absolute inset-0 bg-gradient-to-r from-wine-950/60 via-transparent to-transparent" />

              {/* Content */}
              <div className="absolute bottom-0 left-0 right-0 mx-auto max-w-7xl px-6 pb-20 sm:px-8">
                <p className="mb-4 text-xs font-medium uppercase tracking-[0.4em] text-gold-400">
                  {slide.tag}
                </p>
                <h1 className="font-serif max-w-xl whitespace-pre-line text-6xl font-light leading-tight tracking-tight text-ivory md:text-7xl">
                  {slide.headline.split('\n')[0]}
                  <br />
                  <span className="italic text-gold-400">{slide.headline.split('\n')[1]}</span>
                </h1>
                <p className="mt-5 max-w-xs text-sm font-light leading-relaxed text-ivory-muted">
                  {slide.sub}
                </p>
                <Link
                  href={slide.href}
                  className="mt-10 inline-block border border-gold-400 px-8 py-3.5 text-xs font-medium uppercase tracking-[0.2em] text-gold-400 transition hover:bg-gold-400 hover:text-wine-950"
                >
                  {slide.cta}
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Prev / Next */}
      <button
        onClick={prev}
        className="absolute left-5 top-1/2 -translate-y-1/2 border border-gold-600/30 p-2.5 text-gold-400/70 backdrop-blur-sm transition hover:border-gold-400 hover:text-gold-400"
      >
        <ChevronLeft size={18} />
      </button>
      <button
        onClick={next}
        className="absolute right-5 top-1/2 -translate-y-1/2 border border-gold-600/30 p-2.5 text-gold-400/70 backdrop-blur-sm transition hover:border-gold-400 hover:text-gold-400"
      >
        <ChevronRight size={18} />
      </button>

      {/* Dots */}
      <div className="absolute bottom-8 left-1/2 flex -translate-x-1/2 gap-2">
        {SLIDES.map((_, i) => (
          <button
            key={i}
            onClick={() => emblaApi?.scrollTo(i)}
            className={`h-px transition-all ${i === activeIndex ? 'w-8 bg-gold-400' : 'w-4 bg-gold-600/40'}`}
          />
        ))}
      </div>
    </div>
  );
}
