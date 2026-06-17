import SizeGuideContent from '@/components/ui/SizeGuideContent';

export default function SizeGuidePage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
      <p className="mb-2 text-xs font-medium uppercase tracking-[0.3em] text-gold-400">Help</p>
      <h1 className="font-serif text-4xl font-light text-ivory">Size Guide</h1>
      <div className="mx-auto mt-4 mb-10 h-px w-12 bg-gold-400/40" />
      <SizeGuideContent />
    </div>
  );
}
