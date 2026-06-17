'use client';

import { useEffect, useRef, useState } from 'react';
import { BookmarkCheck, ImagePlus, Info } from 'lucide-react';
import { useAiLookbook } from '@/hooks/useAiLookbook';
import { useOnboardingTasks } from '@/hooks/useOnboardingTasks';
import { track } from '@/lib/analytics';

type Props = {
  imageUrl: string;
  productId: string;
  productHandle: string;
  recommendedSize?: string;
  source?: string;
};

export default function SaveLookCTA({
  imageUrl,
  productId,
  productHandle,
  recommendedSize,
  source = 'fit_advisor',
}: Props) {
  const { saveLook, isSaved, maxLooks, looks } = useAiLookbook();
  const { markTaskCompleted } = useOnboardingTasks();
  const [message, setMessage] = useState('');
  const viewedImageRef = useRef<string | null>(null);
  const saved = isSaved(imageUrl);

  useEffect(() => {
    if (viewedImageRef.current === imageUrl) return;
    viewedImageRef.current = imageUrl;
    track.aiPreviewSavePromptViewed({
      product_id: productId,
      product_handle: productHandle,
      has_recommended_size: !!recommendedSize,
      source,
      saved_count: looks.length,
    });
  }, [imageUrl, looks.length, productHandle, productId, recommendedSize, source]);

  function handleSave() {
    const result = saveLook({ imageUrl, productId, productHandle, recommendedSize }, source);
    if (!result.ok) {
      setMessage('Could not save this look on this device. Your preview is still available above.');
      return;
    }
    markTaskCompleted('ai_look_saved', source);
    setMessage(result.replacedOldest
      ? `Saved on this device. Your oldest saved look was replaced because the limit is ${maxLooks}.`
      : 'Saved on this device. Private to this browser.');
  }

  return (
    <div className="mt-3 border border-gold-600/20 bg-wine-900/70 px-3 py-3">
      <div className="flex items-start gap-2 text-xs text-ivory-dim">
        <Info size={13} className="mt-0.5 flex-shrink-0 text-gold-400" />
        <p>AI previews are not saved unless you choose. Saved looks stay private to this browser.</p>
      </div>
      <button
        onClick={handleSave}
        disabled={saved}
        className={`mt-3 flex w-full items-center justify-center gap-2 border py-2.5 text-[10px] font-medium uppercase tracking-widest transition ${
          saved
            ? 'border-green-600/40 text-green-400'
            : 'border-gold-400 text-gold-400 hover:bg-gold-400 hover:text-wine-950'
        }`}
      >
        {saved ? <BookmarkCheck size={13} /> : <ImagePlus size={13} />}
        {saved ? 'Saved on this device' : 'Save this look'}
      </button>
      {message && <p className="mt-2 text-xs text-green-400">{message}</p>}
    </div>
  );
}
