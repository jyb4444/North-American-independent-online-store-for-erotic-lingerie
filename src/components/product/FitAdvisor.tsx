'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronRight, ChevronLeft, Sparkles, Check, AlertCircle, Loader } from 'lucide-react';
import Image from 'next/image';
import {
  calculateSize,
  cmToInches,
  BODY_SHAPE_LABELS,
  SKIN_TONE_LABELS,
  type FitInput,
  type CupSize,
  type BodyShape,
  type SkinTone,
} from '@/lib/fit-calculator';
import { useFitProfile } from '@/hooks/useFitProfile';
import { markAiPreviewTried, useOnboardingTasks } from '@/hooks/useOnboardingTasks';
import PrivacyTrustBar from '@/components/ui/PrivacyTrustBar';
import LocalLookbookPanel from '@/components/ai/LocalLookbookPanel';
import SaveLookCTA from '@/components/ai/SaveLookCTA';
import { track } from '@/lib/analytics';
import type { Product } from '@/types';

type Props = { open: boolean; onClose: () => void; product: Product; onSelectSize: (size: string) => void };

const STEPS = ['Measurements', 'Your Body', 'Results'] as const;

const DEFAULT_INPUT: FitInput = {
  height: 165, bust: 88, waist: 68, hip: 93,
  cupSize: 'B', bodyShape: 'hourglass', skinTone: 'medium',
};

function NumberInput({ label, unit, value, onChange, min, max }: {
  label: string; unit: string; value: number;
  onChange: (v: number) => void; min: number; max: number;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium uppercase tracking-widest text-ivory-muted">
        {label}
      </label>
      <div className="flex items-center border border-wine-700 bg-wine-800 focus-within:border-gold-400 transition">
        <input
          type="number"
          value={value}
          min={min} max={max}
          onChange={(e) => onChange(Number(e.target.value))}
          className="flex-1 bg-transparent px-3 py-2.5 text-sm text-ivory focus:outline-none"
        />
        <span className="border-l border-wine-700 px-3 py-2.5 text-xs text-ivory-dim">{unit}</span>
      </div>
      <p className="mt-1 text-xs text-ivory-dim">{cmToInches(value)}</p>
    </div>
  );
}

export default function FitAdvisor({ open, onClose, product, onSelectSize }: Props) {
  const [step, setStep] = useState(0);
  const [input, setInput] = useState<FitInput>(DEFAULT_INPUT);
  const [aiPreview, setAiPreview] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');
  const [profileMessage, setProfileMessage] = useState('');
  const [profileError, setProfileError] = useState('');
  const [profileDirty, setProfileDirty] = useState(false);
  const { fitInput, hasProfile, saveProfile, clearProfile } = useFitProfile();
  const { markTaskCompleted } = useOnboardingTasks();

  const activeInput = !profileDirty && fitInput ? fitInput : input;
  const result = step === 2 ? calculateSize(activeInput) : null;

  function set<K extends keyof FitInput>(key: K, val: FitInput[K]) {
    setInput((prev) => ({ ...(!profileDirty && fitInput ? fitInput : prev), [key]: val }));
    setProfileDirty(true);
    setProfileMessage('');
    setProfileError('');
  }

  function handleSaveProfile() {
    const saved = saveProfile(activeInput);
    if (!saved.ok) {
      const firstError = Object.values(saved.validation.errors)[0];
      setProfileError(firstError ?? 'Please review your fit details before saving.');
      setProfileMessage('');
      return;
    }
    setProfileError('');
    setProfileDirty(false);
    markTaskCompleted('fit_profile_saved', 'fit_advisor');
    setProfileMessage('Your private fit profile has been saved on this device.');
  }

  function handleClearProfile() {
    clearProfile();
    setInput(DEFAULT_INPUT);
    setProfileDirty(false);
    setProfileError('');
    setProfileMessage('Your saved fit profile has been cleared.');
  }

  async function generateAiPreview() {
    if (!result) return;
    setAiLoading(true);
    setAiError('');
    try {
      const res = await fetch('/api/ai-preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productTitle: product.title,
          productDescription: product.description,
          bodyDescription: result.aiPromptDescription,
          productImage: product.images[0],
        }),
      });
      const contentType = res.headers.get('content-type') ?? '';
      const data = contentType.includes('application/json')
        ? await res.json()
        : { error: await res.text() };
      if (data.imageUrl) {
        setAiPreview(data.imageUrl);
        markAiPreviewTried();
        markTaskCompleted('ai_preview_tried', 'fit_advisor');
        track.aiPreviewTried({ product_id: product.id, product_handle: product.handle, source: 'fit_advisor' });
      } else setAiError(data.error ?? 'Preview generation failed. Please try again.');
    } catch {
      setAiError('Network error. Please try again.');
    }
    setAiLoading(false);
  }

  const confidenceConfig = result ? {
    perfect: { label: 'Perfect Match', color: 'text-green-400', border: 'border-green-600/40', bg: 'bg-green-900/20' },
    good: { label: 'Good Fit', color: 'text-gold-400', border: 'border-gold-400/40', bg: 'bg-gold-400/10' },
    approximate: { label: 'Approximate Fit', color: 'text-ivory-muted', border: 'border-wine-700', bg: 'bg-wine-800' },
  }[result.confidence] : null;

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose} className="fixed inset-0 z-50 bg-wine-950/80 backdrop-blur-sm" />

          <motion.div
            initial={{ opacity: 0, x: '100%' }} animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: '100%' }}
            transition={{ type: 'spring', stiffness: 300, damping: 35 }}
            className="fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col border-l border-gold-600/20 bg-wine-900 shadow-2xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-gold-600/20 px-5 py-4">
              <div className="flex items-center gap-2">
                <Sparkles size={15} className="text-gold-400" />
                <span className="font-serif text-lg font-light italic text-ivory">Fit Advisor</span>
              </div>
              <button onClick={onClose} className="text-ivory-dim hover:text-gold-400 transition">
                <X size={18} />
              </button>
            </div>

            {/* Step indicator */}
            <div className="flex border-b border-gold-600/10">
              {STEPS.map((s, i) => (
                <div key={s} className={`flex-1 py-2.5 text-center text-[10px] font-medium uppercase tracking-widest transition ${
                  i === step ? 'border-b-2 border-gold-400 text-gold-400' :
                  i < step ? 'text-ivory-dim' : 'text-wine-700'
                }`}>{s}</div>
              ))}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-5 py-5">

              {/* Step 0: Measurements */}
              {step === 0 && (
                <div className="space-y-5">
                  <p className="text-xs text-ivory-muted leading-relaxed">
                    Measure around the <span className="text-gold-400">fullest point</span> for bust and hip, and the <span className="text-gold-400">narrowest point</span> for waist. Use a soft tape measure and breathe normally.
                  </p>
                  <div className="grid grid-cols-2 gap-4">
                    <NumberInput label="Height" unit="cm" value={activeInput.height} onChange={(v) => set('height', v)} min={140} max={200} />
                    <NumberInput label="Bust" unit="cm" value={activeInput.bust} onChange={(v) => set('bust', v)} min={70} max={130} />
                    <NumberInput label="Waist" unit="cm" value={activeInput.waist} onChange={(v) => set('waist', v)} min={55} max={110} />
                    <NumberInput label="Hip" unit="cm" value={activeInput.hip} onChange={(v) => set('hip', v)} min={75} max={135} />
                  </div>

                  {/* Cup size */}
                  <div>
                    <label className="mb-2 block text-xs font-medium uppercase tracking-widest text-ivory-muted">
                      Bra Cup Size
                    </label>
                    <div className="flex gap-2">
                      {(['A', 'B', 'C', 'D', 'DD+'] as CupSize[]).map((c) => (
                        <button key={c} onClick={() => set('cupSize', c)}
                          className={`flex-1 border py-2 text-xs font-medium transition ${
                            activeInput.cupSize === c
                              ? 'border-gold-400 bg-gold-400 text-wine-950'
                              : 'border-wine-700 text-ivory-muted hover:border-gold-400/50'
                          }`}>
                          {c}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Step 1: Body details */}
              {step === 1 && (
                <div className="space-y-6">
                  {/* Body shape */}
                  <div>
                    <p className="mb-3 text-xs font-medium uppercase tracking-widest text-ivory-muted">Body Shape</p>
                    <div className="space-y-2">
                      {(Object.keys(BODY_SHAPE_LABELS) as BodyShape[]).map((shape) => {
                        const info = BODY_SHAPE_LABELS[shape];
                        return (
                          <button key={shape} onClick={() => set('bodyShape', shape)}
                            className={`flex w-full items-center gap-3 border px-4 py-3 text-left transition ${
                              activeInput.bodyShape === shape
                                ? 'border-gold-400 bg-gold-400/10'
                                : 'border-wine-700 hover:border-gold-400/30'
                            }`}>
                            <span className="text-lg">{info.emoji}</span>
                            <div>
                              <p className="text-xs font-medium text-ivory">{info.label}</p>
                              <p className="text-xs text-ivory-dim">{info.description}</p>
                            </div>
                            {activeInput.bodyShape === shape && <Check size={13} className="ml-auto text-gold-400" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Skin tone */}
                  <div>
                    <p className="mb-3 text-xs font-medium uppercase tracking-widest text-ivory-muted">
                      Skin Tone <span className="text-ivory-dim normal-case tracking-normal">(for preview accuracy)</span>
                    </p>
                    <div className="flex gap-3">
                      {(Object.keys(SKIN_TONE_LABELS) as SkinTone[]).map((tone) => {
                        const info = SKIN_TONE_LABELS[tone];
                        return (
                          <button key={tone} onClick={() => set('skinTone', tone)} title={info.label}
                            className={`flex flex-col items-center gap-1.5`}>
                            <span className={`h-8 w-8 rounded-full border-2 transition ${
                              activeInput.skinTone === tone ? 'border-gold-400 ring-1 ring-gold-400/30' : 'border-transparent'
                            }`} style={{ backgroundColor: info.hex }} />
                            <span className={`text-[10px] ${activeInput.skinTone === tone ? 'text-gold-400' : 'text-ivory-dim'}`}>
                              {info.label}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* Step 2: Results */}
              {step === 2 && result && confidenceConfig && (
                <div className="space-y-5">
                  {/* Size recommendation */}
                  <div className={`border ${confidenceConfig.border} ${confidenceConfig.bg} p-5`}>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs font-medium uppercase tracking-widest text-ivory-muted">Recommended Size</p>
                        <p className="font-serif text-4xl font-light text-ivory mt-1">{result.recommendedSize}</p>
                      </div>
                      <div className={`border ${confidenceConfig.border} px-3 py-1`}>
                        <p className={`text-[10px] font-medium uppercase tracking-widest ${confidenceConfig.color}`}>
                          {confidenceConfig.label}
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
                      {[
                        { label: 'Bust', value: activeInput.bust },
                        { label: 'Waist', value: activeInput.waist },
                        { label: 'Hip', value: activeInput.hip },
                      ].map(({ label, value }) => (
                        <div key={label} className="text-center">
                          <p className="text-ivory-dim">{label}</p>
                          <p className="text-ivory font-medium">{value}cm</p>
                          <p className="text-ivory-dim">{cmToInches(value)}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Fit profile save */}
                  <div className="border border-gold-600/20 bg-wine-800 px-4 py-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-medium uppercase tracking-widest text-gold-400">
                          Save your private fit profile
                        </p>
                        <p className="mt-1 text-xs leading-relaxed text-ivory-dim">
                          Used only to personalize your size guidance. You can clear this anytime.
                        </p>
                      </div>
                      {hasProfile && (
                        <span className="border border-green-600/40 px-2 py-0.5 text-[10px] uppercase tracking-widest text-green-400">
                          Saved
                        </span>
                      )}
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        onClick={handleSaveProfile}
                        className="border border-gold-400 px-4 py-2 text-[10px] font-medium uppercase tracking-widest text-gold-400 transition hover:bg-gold-400 hover:text-wine-950"
                      >
                        {hasProfile ? 'Update profile' : 'Save fit profile'}
                      </button>
                      {hasProfile && (
                        <button
                          onClick={handleClearProfile}
                          className="px-3 py-2 text-[10px] uppercase tracking-widest text-ivory-dim transition hover:text-crimson-400"
                        >
                          Clear profile
                        </button>
                      )}
                    </div>
                    {profileMessage && <p className="mt-2 text-xs text-green-400">{profileMessage}</p>}
                    {profileError && <p className="mt-2 text-xs text-crimson-400">{profileError}</p>}
                  </div>

                  {/* Hemline note */}
                  <div className="border border-gold-600/15 bg-wine-800 px-4 py-3">
                    <p className="text-xs font-medium uppercase tracking-widest text-gold-400 mb-1">Length Preview</p>
                    <p className="text-xs text-ivory-muted leading-relaxed">{result.hemlineNote}</p>
                  </div>

                  {/* Fit notes */}
                  {result.fitNotes.length > 0 && (
                    <div>
                      <p className="mb-2 text-xs font-medium uppercase tracking-widest text-ivory-muted">Fit Notes</p>
                      <ul className="space-y-2">
                        {result.fitNotes.map((note, i) => (
                          <li key={i} className="flex items-start gap-2 text-xs text-ivory-muted">
                            <span className="mt-0.5 flex-shrink-0 text-gold-400">✦</span>{note}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Style notes */}
                  {result.styleNotes.length > 0 && (
                    <div>
                      <p className="mb-2 text-xs font-medium uppercase tracking-widest text-ivory-muted">Style Tips</p>
                      <ul className="space-y-2">
                        {result.styleNotes.map((note, i) => (
                          <li key={i} className="flex items-start gap-2 text-xs text-ivory-muted">
                            <span className="mt-0.5 flex-shrink-0 text-gold-400">→</span>{note}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* AI Preview */}
                  <div className="border border-gold-600/20 bg-wine-800">
                    <div className="px-4 pt-4">
                      <p className="text-xs font-medium uppercase tracking-widest text-gold-400">AI Style Preview</p>
                      <p className="mt-1 text-xs text-ivory-dim">
                        See how this style looks on a figure similar to yours. AI-generated for reference only.
                      </p>
                    </div>
                    <div className="px-4 pt-3">
                      <PrivacyTrustBar context="ai" compact />
                    </div>

                    {!aiPreview && !aiLoading && (
                      <button onClick={generateAiPreview}
                        className="mx-4 my-4 flex w-[calc(100%-2rem)] items-center justify-center gap-2 border border-gold-400 py-3 text-xs font-medium uppercase tracking-widest text-gold-400 transition hover:bg-gold-400 hover:text-wine-950">
                        <Sparkles size={13} /> Generate Preview
                      </button>
                    )}

                    {aiLoading && (
                      <div className="flex items-center justify-center gap-2 py-8 text-xs text-ivory-muted">
                        <Loader size={14} className="animate-spin" />
                        Generating preview (~15 seconds)…
                      </div>
                    )}

                    {aiError && (
                      <div className="mx-4 my-3 flex items-start gap-2 text-xs text-crimson-400">
                        <AlertCircle size={13} className="flex-shrink-0 mt-0.5" />
                        {aiError}
                      </div>
                    )}

                    {aiPreview && (
                      <div className="p-4">
                        <div className="relative aspect-[3/4] overflow-hidden">
                          <Image src={aiPreview} alt="AI style preview" fill sizes="360px" className="object-cover" />
                        </div>
                        <p className="mt-2 text-[10px] text-ivory-dim text-center">
                          AI-generated preview. Colors and details may vary from actual product.
                        </p>
                        <SaveLookCTA
                          imageUrl={aiPreview}
                          productId={product.id}
                          productHandle={product.handle}
                          recommendedSize={result.recommendedSize}
                        />
                      </div>
                    )}
                  </div>

                  <LocalLookbookPanel source="fit_advisor" compact />

                  {/* CTA */}
                  <button
                    onClick={() => { onSelectSize(result.recommendedSize); onClose(); }}
                    className="w-full border border-gold-400 py-4 text-xs font-medium uppercase tracking-[0.2em] text-gold-400 transition hover:bg-gold-400 hover:text-wine-950"
                  >
                    Select Size {result.recommendedSize} & Add to Bag
                  </button>

                  <button onClick={() => setStep(0)} className="w-full text-xs uppercase tracking-widest text-ivory-dim hover:text-gold-400 transition">
                    Redo measurements
                  </button>
                </div>
              )}
            </div>

            {/* Navigation */}
            {step < 2 && (
              <div className="border-t border-gold-600/20 px-5 py-4 flex gap-3">
                {step > 0 && (
                  <button onClick={() => setStep((s) => s - 1)}
                    className="flex items-center gap-1.5 border border-wine-700 px-4 py-3 text-xs uppercase tracking-widest text-ivory-muted transition hover:border-gold-400/50 hover:text-gold-400">
                    <ChevronLeft size={13} /> Back
                  </button>
                )}
                <button onClick={() => setStep((s) => s + 1)}
                  className="flex flex-1 items-center justify-center gap-1.5 border border-gold-400 py-3 text-xs font-medium uppercase tracking-[0.2em] text-gold-400 transition hover:bg-gold-400 hover:text-wine-950">
                  {step === 1 ? 'See My Results' : 'Continue'} <ChevronRight size={13} />
                </button>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
