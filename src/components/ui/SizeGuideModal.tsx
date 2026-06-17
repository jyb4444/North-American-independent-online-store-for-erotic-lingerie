'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import SizeGuideContent from './SizeGuideContent';

type Props = { open: boolean; onClose: () => void };

export default function SizeGuideModal({ open, onClose }: Props) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose} className="fixed inset-0 z-50 bg-wine-950/80 backdrop-blur-sm" />
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }} transition={{ duration: 0.2 }}
            className="fixed left-1/2 top-1/2 z-50 w-full max-w-2xl -translate-x-1/2 -translate-y-1/2 border border-gold-600/25 bg-wine-900 shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-gold-600/20 px-6 py-4">
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.3em] text-gold-400">Velour</p>
                <h2 className="font-serif text-xl font-light text-ivory">Size Guide</h2>
              </div>
              <button onClick={onClose} className="text-ivory-dim hover:text-gold-400 transition">
                <X size={18} />
              </button>
            </div>
            <div className="overflow-auto p-6">
              <SizeGuideContent />
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
