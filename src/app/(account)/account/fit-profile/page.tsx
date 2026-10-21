'use client';

import Link from 'next/link';
import { Check, Ruler, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import {
  BODY_SHAPE_LABELS,
  SKIN_TONE_LABELS,
  cmToInches,
  type BodyShape,
  type CupSize,
  type FitInput,
  type SkinTone,
} from '@/lib/fit-calculator';
import { useFitProfile } from '@/hooks/useFitProfile';
import SuccessNotice from '@/components/ui/SuccessNotice';

const DEFAULT_INPUT: FitInput = {
  height: 165,
  bust: 88,
  waist: 68,
  hip: 93,
  cupSize: 'B',
  bodyShape: 'hourglass',
  skinTone: 'medium',
};

function Measurement({ label, value, min, max, onChange }: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}) {
  const id = `profile-${label.toLowerCase()}`;
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-xs font-medium uppercase tracking-widest text-ivory-muted">{label}</label>
      <div className="flex border border-wine-700 bg-wine-800 focus-within:border-gold-400">
        <input id={id} type="number" min={min} max={max} value={value} onChange={(event) => onChange(Number(event.target.value))}
          className="min-w-0 flex-1 bg-transparent px-3 py-2.5 text-sm text-ivory focus:outline-none" />
        <span className="border-l border-wine-700 px-3 py-2.5 text-xs text-ivory-dim">cm</span>
      </div>
      <p className="mt-1 text-xs text-ivory-dim">{cmToInches(value)}</p>
    </div>
  );
}

export default function FitProfilePage() {
  const { fitInput, hasProfile, saveProfile, clearProfile } = useFitProfile();
  const [input, setInput] = useState<FitInput>(DEFAULT_INPUT);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!fitInput) return;
    const id = window.setTimeout(() => setInput(fitInput), 0);
    return () => window.clearTimeout(id);
  }, [fitInput]);

  function set<K extends keyof FitInput>(key: K, value: FitInput[K]) {
    setInput((current) => ({ ...current, [key]: value }));
    setMessage('');
    setError('');
  }

  function save() {
    const saved = saveProfile(input);
    if (!saved.ok) {
      setError(Object.values(saved.validation.errors)[0] ?? 'Please review your measurements.');
      setMessage('');
      return;
    }
    setError('');
    setMessage('Your private fit profile has been saved on this device.');
  }

  function clear() {
    clearProfile();
    setInput(DEFAULT_INPUT);
    setError('');
    setMessage('Your saved fit profile has been cleared.');
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <p className="mb-1 text-xs font-medium uppercase tracking-[0.3em] text-gold-400">Private size guidance</p>
          <h1 className="font-serif text-3xl font-light text-ivory">Your Fit Profile</h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-ivory-dim">Your measurements stay in this browser and are used only to personalize size recommendations.</p>
        </div>
        <Link href="/account" className="shrink-0 text-xs uppercase tracking-widest text-ivory-dim transition hover:text-gold-400">← Account</Link>
      </div>

      <div className="mb-6 border border-gold-600/20 bg-wine-900 px-5 py-4">
        <h2 className="text-xs font-medium uppercase tracking-widest text-gold-400">What this does</h2>
        <p className="mt-2 text-sm leading-6 text-ivory-muted">
          We use your measurements to estimate a size for each product. The estimate appears on product cards, product pages, and in your bag. It does not decide whether a style suits your body shape, and it does not replace the product&rsquo;s size chart.
        </p>
      </div>

      <section className="border border-gold-600/20 bg-wine-900 p-6 sm:p-8">
        <div className="mb-6 flex items-center gap-2 border-b border-gold-600/15 pb-4">
          <Ruler size={17} className="text-gold-400" />
          <h2 className="font-serif text-xl font-light text-ivory">Measurements</h2>
          {hasProfile && <span className="ml-auto border border-green-600/40 px-2 py-0.5 text-[10px] uppercase tracking-widest text-green-400">Saved</span>}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Measurement label="Height" value={input.height} min={140} max={200} onChange={(value) => set('height', value)} />
          <Measurement label="Bust" value={input.bust} min={70} max={130} onChange={(value) => set('bust', value)} />
          <Measurement label="Waist" value={input.waist} min={55} max={110} onChange={(value) => set('waist', value)} />
          <Measurement label="Hip" value={input.hip} min={75} max={135} onChange={(value) => set('hip', value)} />
        </div>

        <div className="mt-6">
          <p className="mb-2 text-xs font-medium uppercase tracking-widest text-ivory-muted">Bra Cup Size</p>
          <div className="grid grid-cols-5 gap-2">
            {(['A', 'B', 'C', 'D', 'DD+'] as CupSize[]).map((cup) => (
              <button key={cup} type="button" onClick={() => set('cupSize', cup)}
                className={`border py-2 text-xs font-medium transition ${input.cupSize === cup ? 'border-gold-400 bg-gold-400 text-wine-950' : 'border-wine-700 text-ivory-muted hover:border-gold-400/50'}`}>{cup}</button>
            ))}
          </div>
        </div>

        <div className="mt-6">
          <p className="mb-2 text-xs font-medium uppercase tracking-widest text-ivory-muted">Body Shape</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {(Object.keys(BODY_SHAPE_LABELS) as BodyShape[]).map((shape) => (
              <button key={shape} type="button" onClick={() => set('bodyShape', shape)}
                className={`flex items-center gap-3 border px-3 py-3 text-left transition ${input.bodyShape === shape ? 'border-gold-400 bg-gold-400/10' : 'border-wine-700 hover:border-gold-400/40'}`}>
                <span aria-hidden="true">{BODY_SHAPE_LABELS[shape].emoji}</span>
                <span><span className="block text-xs font-medium text-ivory">{BODY_SHAPE_LABELS[shape].label}</span><span className="block text-xs text-ivory-dim">{BODY_SHAPE_LABELS[shape].description}</span></span>
              </button>
            ))}
          </div>
        </div>

        <div className="mt-6">
          <p className="mb-2 text-xs font-medium uppercase tracking-widest text-ivory-muted">Skin Tone <span className="normal-case tracking-normal text-ivory-dim">(for preview accuracy)</span></p>
          <div className="flex flex-wrap gap-4">
            {(Object.keys(SKIN_TONE_LABELS) as SkinTone[]).map((tone) => (
              <button key={tone} type="button" onClick={() => set('skinTone', tone)} className="flex flex-col items-center gap-1.5">
                <span className={`h-9 w-9 rounded-full border-2 ${input.skinTone === tone ? 'border-gold-400 ring-1 ring-gold-400/30' : 'border-transparent'}`} style={{ backgroundColor: SKIN_TONE_LABELS[tone].hex }} />
                <span className={`text-[10px] ${input.skinTone === tone ? 'text-gold-400' : 'text-ivory-dim'}`}>{SKIN_TONE_LABELS[tone].label}</span>
              </button>
            ))}
          </div>
        </div>

        {error && <p role="alert" className="mt-5 border border-crimson-400/30 bg-crimson-700/10 px-3 py-2 text-sm text-crimson-400">{error}</p>}
        {message && <SuccessNotice title={hasProfile ? 'Fit profile saved' : 'Fit profile updated'} className="mt-5">{message}</SuccessNotice>}

        <div className="mt-6 flex flex-wrap gap-3">
          <button type="button" onClick={save} className="flex items-center gap-2 border border-gold-400 px-5 py-3 text-xs font-medium uppercase tracking-widest text-gold-400 transition hover:bg-gold-400 hover:text-wine-950">
            <Check size={14} /> {hasProfile ? 'Update Fit Profile' : 'Save Fit Profile'}
          </button>
          {hasProfile && <button type="button" onClick={clear} className="flex items-center gap-2 px-4 py-3 text-xs uppercase tracking-widest text-ivory-dim transition hover:text-crimson-400"><Trash2 size={14} /> Clear Profile</button>}
        </div>
      </section>
    </div>
  );
}
