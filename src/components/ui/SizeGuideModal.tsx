'use client';

import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { useRef } from 'react';
import { X } from 'lucide-react';
import SizeGuideContent from './SizeGuideContent';
import { useAccessibleDialog } from './useAccessibleDialog';

type Props = { open: boolean; onClose: () => void };

export default function SizeGuideModal({ open, onClose }: Props) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useAccessibleDialog(open, onClose, closeRef);
  const reduceMotion = useReducedMotion();
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: reduceMotion ? 0 : 0.2 }}
            onClick={onClose} className="fixed inset-0 z-50 bg-wine-950/80 backdrop-blur-sm" />
          <motion.div
            ref={dialogRef}
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.95 }} transition={{ duration: reduceMotion ? 0 : 0.2 }}
            className="fixed inset-x-0 bottom-0 z-50 flex max-h-[calc(100dvh-32px)] w-full flex-col border border-gold-600/25 bg-wine-900 shadow-2xl sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:max-w-2xl sm:-translate-x-1/2 sm:-translate-y-1/2"
            role="dialog" aria-modal="true" aria-labelledby="size-guide-title" tabIndex={-1}
          >
            <div className="flex items-center justify-between border-b border-gold-600/20 px-6 py-4">
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.3em] text-gold-400">Self Love</p>
                <h2 id="size-guide-title" className="font-serif text-xl font-light text-ivory">Size Guide</h2>
              </div>
              <button ref={closeRef} onClick={onClose} aria-label="Close size guide" className="flex h-11 w-11 items-center justify-center text-ivory-dim hover:text-gold-400 transition">
                <X size={18} />
              </button>
            </div>
            <div className="min-h-0 overflow-auto p-6">
              <SizeGuideContent />
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
