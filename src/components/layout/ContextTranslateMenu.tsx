'use client';

import { useEffect, useState } from 'react';
import { Languages, X } from 'lucide-react';

type MenuState = {
  open: boolean;
  x: number;
  y: number;
  text: string;
};

const TEXT_SELECTOR = 'p,h1,h2,h3,h4,h5,h6,span,a,button,label,li,td,th';

function getSelectedText() {
  if (typeof window === 'undefined') return '';
  return window.getSelection()?.toString().trim() ?? '';
}

function getTargetText(target: EventTarget | null) {
  if (!(target instanceof Element)) return '';
  if (target.closest('input,textarea,select,[contenteditable="true"]')) return '';

  const textElement = target.closest(TEXT_SELECTOR);
  return textElement?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
}

function openTextTranslation(text: string) {
  const url = new URL('https://translate.google.com/');
  url.searchParams.set('sl', 'auto');
  url.searchParams.set('tl', 'zh-CN');
  url.searchParams.set('text', text.slice(0, 4000));
  url.searchParams.set('op', 'translate');
  window.open(url.toString(), '_blank', 'noopener,noreferrer');
}

function openPageTranslation() {
  const url = new URL('https://translate.google.com/translate');
  url.searchParams.set('sl', 'auto');
  url.searchParams.set('tl', 'zh-CN');
  url.searchParams.set('u', window.location.href);
  window.open(url.toString(), '_blank', 'noopener,noreferrer');
}

export default function ContextTranslateMenu() {
  const [menu, setMenu] = useState<MenuState>({ open: false, x: 0, y: 0, text: '' });

  useEffect(() => {
    function closeMenu() {
      setMenu((current) => ({ ...current, open: false }));
    }

    function handleContextMenu(event: MouseEvent) {
      const text = getSelectedText() || getTargetText(event.target);
      if (!text) return;

      event.preventDefault();
      const menuWidth = 220;
      const menuHeight = 112;
      const x = Math.min(event.clientX, window.innerWidth - menuWidth - 12);
      const y = Math.min(event.clientY, window.innerHeight - menuHeight - 12);
      setMenu({ open: true, x: Math.max(12, x), y: Math.max(12, y), text });
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') closeMenu();
    }

    window.addEventListener('contextmenu', handleContextMenu);
    window.addEventListener('click', closeMenu);
    window.addEventListener('scroll', closeMenu, true);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('contextmenu', handleContextMenu);
      window.removeEventListener('click', closeMenu);
      window.removeEventListener('scroll', closeMenu, true);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  if (!menu.open) return null;

  return (
    <div
      className="fixed z-[80] w-56 border border-gold-600/25 bg-wine-900 p-1.5 shadow-2xl"
      style={{ left: menu.x, top: menu.y }}
      onClick={(event) => event.stopPropagation()}
      role="menu"
      aria-label="Translation options"
    >
      <button
        type="button"
        onClick={() => {
          openTextTranslation(menu.text);
          setMenu((current) => ({ ...current, open: false }));
        }}
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs uppercase tracking-widest text-ivory-muted transition hover:bg-wine-800 hover:text-gold-400"
        role="menuitem"
      >
        <Languages size={13} className="text-gold-400" />
        Translate text
      </button>
      <button
        type="button"
        onClick={() => {
          openPageTranslation();
          setMenu((current) => ({ ...current, open: false }));
        }}
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs uppercase tracking-widest text-ivory-muted transition hover:bg-wine-800 hover:text-gold-400"
        role="menuitem"
      >
        <Languages size={13} className="text-gold-400" />
        Translate page
      </button>
      <button
        type="button"
        onClick={() => setMenu((current) => ({ ...current, open: false }))}
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs uppercase tracking-widest text-ivory-dim transition hover:bg-wine-800 hover:text-ivory-muted"
        role="menuitem"
      >
        <X size={13} />
        Close
      </button>
    </div>
  );
}
