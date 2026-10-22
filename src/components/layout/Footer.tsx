'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Mail } from 'lucide-react';
import NewsletterForm from '@/components/ui/NewsletterForm';

export default function Footer() {
  return (
    <footer className="border-t border-gold-600/20 bg-wine-900 py-16 text-ivory-dim">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">

        {/* Brand + divider */}
        <div className="mb-12 text-center">
          <Image
            src="/logo.png"
            alt="Self Love"
            width={72}
            height={72}
            className="mx-auto h-16 w-16 rounded-full object-cover"
          />
          <p className="mt-3 text-sm font-semibold uppercase tracking-[0.24em] text-ivory">Self Love</p>
          <div className="mx-auto mt-3 h-px w-12 bg-gold-600/40" />
        </div>

        <div className="grid grid-cols-2 gap-10 md:grid-cols-4">
          <div className="col-span-2 md:col-span-1">
            <p className="mb-5 text-xs font-medium uppercase tracking-[0.3em] text-ivory-muted">
              About
            </p>
            <p className="text-xs leading-relaxed">
              Premium intimate apparel with discreet shopping and curated essentials.
            </p>
            <Link href="/pages/contact" className="mt-6 inline-flex items-center gap-2 text-xs text-gold-400 hover:underline">
              <Mail size={11} /> Contact support
            </Link>
            {process.env.NEXT_PUBLIC_NEWSLETTER_ENABLED === 'true' && <NewsletterForm />}
          </div>

          <div>
            <p className="mb-5 text-xs font-medium uppercase tracking-[0.3em] text-ivory-muted">Shop</p>
            <ul className="space-y-2.5 text-xs">
              {[['Shop ALL', '/collections/all'], ['SALES', '/sale'], ['Hosiery', '/collections/hosiery']].map(([label, href]) => (
                <li key={label}>
                  <Link href={href} className="transition hover:text-gold-400">{label}</Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="mb-5 text-xs font-medium uppercase tracking-[0.3em] text-ivory-muted">Help</p>
            <ul className="space-y-2.5 text-xs">
              {[['Size Guide', '/pages/size-guide'], ['Fulfillment Notes', '/pages/shipping'],
                ['Returns', '/pages/returns'], ['FAQ', '/pages/faq'],
                ['Track Order', '/track'], ['Contact Us', '/pages/contact']].map(([label, href]) => (
                <li key={label}>
                  <Link href={href} className="transition hover:text-gold-400">{label}</Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="mb-5 text-xs font-medium uppercase tracking-[0.3em] text-ivory-muted">Account</p>
            <ul className="space-y-2.5 text-xs">
              {[['My Account', '/account'], ['Order History', '/account/orders'],
                ['Track Package', '/track'],
                ['Gift Cards', '/pages/gift-card'],
                ['Referral Program', '/pages/referral']].map(([label, href]) => (
                <li key={label}>
                  <Link href={href} className="transition hover:text-gold-400">{label}</Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-3 border-t border-gold-600/10 pt-8 text-xs md:flex-row">
          <p>© {new Date().getFullYear()} Self Love. All rights reserved.</p>
          <div className="flex gap-5">
            <Link href="/pages/privacy" className="hover:text-gold-400 transition">Privacy Policy</Link>
            <Link href="/pages/terms" className="hover:text-gold-400 transition">Terms of Service</Link>
            <button
              type="button"
              onClick={() => window.dispatchEvent(new Event('velour:open-cookie-settings'))}
              className="hover:text-gold-400 transition"
            >
              Cookie Settings
            </button>
          </div>
        </div>
      </div>
    </footer>
  );
}
