'use client';

import { useEffect, useRef } from 'react';

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
let openDialogCount = 0;
let originalBodyOverflow = '';

export function useAccessibleDialog(open: boolean, onClose: () => void, initialFocusRef?: React.RefObject<HTMLElement | null>) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);

  useEffect(() => {
    if (!open) return;
    returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (openDialogCount === 0) originalBodyOverflow = document.body.style.overflow;
    openDialogCount += 1;
    document.body.style.overflow = 'hidden';
    const focusId = window.setTimeout(() => {
      const target = initialFocusRef?.current
        ?? dialogRef.current?.querySelector<HTMLElement>(FOCUSABLE)
        ?? dialogRef.current;
      target?.focus();
    }, 0);

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab' || !dialogRef.current) return;
      const focusable = [...dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)]
        .filter((element) => !element.hasAttribute('disabled') && element.offsetParent !== null);
      if (!focusable.length) {
        event.preventDefault();
        dialogRef.current.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', onKeyDown);
    return () => {
      window.clearTimeout(focusId);
      openDialogCount = Math.max(0, openDialogCount - 1);
      if (openDialogCount === 0) document.body.style.overflow = originalBodyOverflow;
      document.removeEventListener('keydown', onKeyDown);
      returnFocusRef.current?.focus();
    };
  }, [initialFocusRef, open]);

  return dialogRef;
}
