'use client';

import { useEffect } from 'react';
import { Ruler, Sparkles } from 'lucide-react';
import { useFitProfile } from '@/hooks/useFitProfile';
import { track } from '@/lib/analytics';
import type { Product } from '@/types';

type Variant = 'card' | 'pdp' | 'cart';

type Props = {
  product: Product;
  variant?: Variant;
  showPromptWithoutProfile?: boolean;
  onOpenFitAdvisor?: () => void;
  className?: string;
};

function confidenceCopy(confidence: string) {
  if (confidence === 'perfect') return 'Best match based on your saved measurements';
  if (confidence === 'good') return 'Comfort fit recommended';
  return 'Size guidance available';
}

export default function FitConfidenceBadge({
  product,
  variant = 'card',
  showPromptWithoutProfile = false,
  onOpenFitAdvisor,
  className = '',
}: Props) {
  const { hasProfile, getFitResult } = useFitProfile();
  const result = getFitResult(product);
  const confidenceLevel = result?.confidence;
  const recommendedSize = result?.recommendedSize;

  useEffect(() => {
    if (!hasProfile || !confidenceLevel || !recommendedSize) return;
    track.fitConfidenceBadgeViewed({
      product_id: product.id,
      product_handle: product.handle,
      confidence_level: confidenceLevel,
      recommended_size: recommendedSize,
      placement: variant,
    });
  }, [confidenceLevel, hasProfile, product.handle, product.id, recommendedSize, variant]);

  if (!hasProfile || !result) {
    if (!showPromptWithoutProfile) return null;

    const content = (
      <>
        <Sparkles size={variant === 'cart' ? 12 : 14} className="flex-shrink-0 text-gold-400" />
        <span>{variant === 'pdp' ? 'Save fit profile for size guidance' : 'Try Fit Advisor'}</span>
      </>
    );

    if (onOpenFitAdvisor) {
      return (
        <button
          type="button"
          onClick={() => {
            track.fitConfidenceBadgeClicked({
              product_id: product.id,
              product_handle: product.handle,
              confidence_level: 'none',
              recommended_size: null,
              placement: variant,
            });
            onOpenFitAdvisor();
          }}
          className={`inline-flex items-center gap-1.5 border border-dashed border-gold-600/40 px-3 py-2 text-xs uppercase tracking-widest text-ivory-muted transition hover:border-gold-400 hover:text-gold-400 ${className}`}
        >
          {content}
        </button>
      );
    }

    return (
      <div className={`inline-flex items-center gap-1.5 text-xs text-ivory-dim ${className}`}>
        {content}
      </div>
    );
  }

  const text = confidenceCopy(result.confidence);

  if (variant === 'card') {
    return (
      <div className={`inline-flex items-center gap-1.5 border border-gold-600/25 bg-wine-900/70 px-2 py-1 text-[10px] uppercase tracking-widest text-gold-400 ${className}`}>
        <Ruler size={11} />
        <span>{result.recommendedSize} fit guide</span>
      </div>
    );
  }

  if (variant === 'cart') {
    return (
      <div className={`mt-1 flex items-center gap-1.5 text-[11px] text-gold-400/90 ${className}`}>
        <Ruler size={11} />
        <span>Fit guide: {result.recommendedSize}</span>
      </div>
    );
  }

  return (
    <div className={`border border-gold-600/25 bg-gold-400/5 px-4 py-3 ${className}`}>
      <div className="flex items-start gap-3">
        <Ruler size={15} className="mt-0.5 flex-shrink-0 text-gold-400" />
        <div>
          <p className="text-xs font-medium uppercase tracking-widest text-gold-400">
            Size guidance: {result.recommendedSize}
          </p>
          <p className="mt-1 text-xs leading-relaxed text-ivory-muted">{text}</p>
          {result.confidence === 'approximate' && (
            <p className="mt-1 text-xs text-ivory-dim">Between sizes? Choose the more comfortable fit.</p>
          )}
        </div>
      </div>
    </div>
  );
}
