import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { Resend } from 'resend';
import type { CartItem } from '@/types';

let resend: Resend | null = null;

function getResend() {
  resend ??= new Resend(process.env.RESEND_API_KEY);
  return resend;
}

const FROM = process.env.RESEND_FROM_EMAIL ?? 'Self Love <onboarding@resend.dev>';
const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

// ─── Escaping ──────────────────────────────────────────────────────────────────
// Every value that did not come from this file (user input, cart snapshots, Shopify
// data) must pass through one of these before it is placed in an email.

/** Escapes text for HTML element content and quoted attribute values. */
export function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Returns an absolute http(s) URL safe for href/src, or null. Site-relative paths resolve against BASE_URL. */
function safeUrl(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  try {
    const url = new URL(value.trim(), BASE_URL);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : null;
  } catch {
    return null;
  }
}

/** Single-line text for subjects: no control characters (header injection), bounded length. */
function headerText(value: unknown, maxLength = 120): string {
  const text = String(value ?? '').replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim();
  return text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text;
}

function productUrl(handle: unknown): string {
  return `${BASE_URL}/products/${encodeURIComponent(String(handle ?? ''))}`;
}

// ─── Delivery ──────────────────────────────────────────────────────────────────

type OutgoingEmail = { to: string; subject: string; html: string; replyTo?: string };

/**
 * Sends an email and throws if the provider rejects it (the Resend SDK reports failures in
 * its return value instead of throwing). When E2E_EMAIL_OUTBOX_DIR is set — only in the
 * test environment — messages are written there as JSON instead of being sent.
 */
async function deliver(email: OutgoingEmail, idempotencyKey?: string): Promise<{ id: string | null }> {
  const outbox = process.env.E2E_EMAIL_OUTBOX_DIR;
  if (outbox) {
    const id = idempotencyKey ? crypto.createHash('sha256').update(idempotencyKey).digest('hex') : `${Date.now()}-${crypto.randomUUID()}`;
    await fs.mkdir(outbox, { recursive: true });
    await fs.writeFile(path.join(outbox, `${id}.json`), JSON.stringify({ from: FROM, ...email }, null, 2));
    return { id };
  }

  const { data, error } = await getResend().emails.send({ from: FROM, ...email }, idempotencyKey ? { idempotencyKey } : undefined);
  if (error) throw new Error(`Email send failed: ${error.message}`);
  return { id: data?.id ?? null };
}

// ─── Shared style constants ────────────────────────────────────────────────────

const BG = '#130208';
const SURFACE = '#1e0810';
const GOLD = '#c9a84c';
const IVORY = '#f0e6d3';
const MUTED = '#9b8476';
const BORDER = '#3a1a22';

function emailWrapper(body: string) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Self Love</title>
</head>
<body style="margin:0;padding:0;background:${BG};font-family:Georgia,serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:${BG};padding:40px 16px;">
    <tr><td align="center">
      <table width="100%" style="max-width:560px;background:${SURFACE};border:1px solid ${BORDER};">
        <tr><td style="padding:36px 40px 0;text-align:center;border-bottom:1px solid ${BORDER};">
          <img src="${BASE_URL}/logo.png" width="72" height="72" alt="Self Love" style="display:block;margin:0 auto 12px;border-radius:999px;object-fit:cover;" />
          <p style="margin:0;font-family:Arial,sans-serif;font-size:13px;font-weight:700;color:${IVORY};letter-spacing:0.22em;text-transform:uppercase;">Self Love</p>
          <p style="margin:8px 0 0;font-size:10px;text-transform:uppercase;letter-spacing:0.3em;color:${MUTED};font-family:Arial,sans-serif;">Private Intimate Apparel</p>
          <div style="margin:20px auto 0;height:1px;width:40px;background:${BORDER};"></div>
        </td></tr>
        <tr><td style="padding:36px 40px;">
          ${body}
        </td></tr>
        <tr><td style="padding:24px 40px;border-top:1px solid ${BORDER};text-align:center;">
          <p style="margin:0;font-size:10px;color:${MUTED};font-family:Arial,sans-serif;line-height:1.6;">
            © ${new Date().getFullYear()} Self Love · Private Intimate Apparel<br/>
            Billing appears discreetly — never as intimate apparel.<br/>
            <a href="${BASE_URL}/pages/privacy" style="color:${MUTED};">Privacy Policy</a> &nbsp;·&nbsp;
            <a href="${BASE_URL}/pages/terms" style="color:${MUTED};">Terms</a> &nbsp;·&nbsp;
            <a href="${BASE_URL}/pages/contact" style="color:${MUTED};">Contact Us</a>
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// heading/para/button take trusted HTML; callers escape any dynamic values.

function heading(html: string) {
  return `<h1 style="margin:0 0 16px;font-family:Georgia,serif;font-size:24px;font-weight:300;color:${IVORY};letter-spacing:0.02em;">${html}</h1>`;
}

function para(html: string) {
  return `<p style="margin:0 0 16px;font-size:14px;line-height:1.7;color:${MUTED};font-family:Arial,sans-serif;">${html}</p>`;
}

function button(label: string, href: string) {
  return `<table cellpadding="0" cellspacing="0" style="margin:24px 0;">
    <tr><td style="border:1px solid ${GOLD};text-align:center;">
      <a href="${escapeHtml(href)}" style="display:block;padding:13px 32px;font-size:10px;font-family:Arial,sans-serif;text-transform:uppercase;letter-spacing:0.2em;color:${GOLD};text-decoration:none;">${label}</a>
    </td></tr>
  </table>`;
}

function divider() {
  return `<div style="height:1px;background:${BORDER};margin:24px 0;"></div>`;
}

function strong(text: unknown) {
  return `<strong style="color:${IVORY};">${escapeHtml(text)}</strong>`;
}

function productRow(image: unknown, title: unknown, price: number | null, href: string) {
  const imageUrl = safeUrl(image);
  const amount = Number(price);
  return `<table cellpadding="0" cellspacing="0" width="100%" style="margin-bottom:12px;border:1px solid ${BORDER};">
    <tr>
      ${imageUrl ? `<td width="70" style="padding:10px;vertical-align:top;">
        <img src="${escapeHtml(imageUrl)}" width="60" height="80" alt="${escapeHtml(title)}" style="object-fit:cover;display:block;" />
      </td>` : ''}
      <td style="padding:10px;vertical-align:top;">
        <a href="${escapeHtml(href)}" style="font-size:13px;color:${IVORY};text-decoration:none;font-family:Georgia,serif;font-weight:300;">${escapeHtml(title)}</a>
        ${price !== null && Number.isFinite(amount) ? `<p style="margin:6px 0 0;font-size:13px;color:${GOLD};font-family:Georgia,serif;">$${amount.toFixed(2)}</p>` : ''}
      </td>
    </tr>
  </table>`;
}

// ─── Templates ─────────────────────────────────────────────────────────────────

function welcomeHtml(firstName: string) {
  return emailWrapper(`
    ${heading(`Welcome, ${escapeHtml(firstName) || 'there'}.`)}
    ${para('Your private wardrobe is ready. Everything here — your fit profile, saved looks, and wishlist — stays private to this account.')}
    ${divider()}
    ${para('<strong style="color:' + IVORY + ';">What you can do now:</strong>')}
    ${para('✦ &nbsp;<a href="' + BASE_URL + '/pages/size-guide" style="color:' + GOLD + ';">Create your private fit profile</a> for guided sizing<br/>✦ &nbsp;<a href="' + BASE_URL + '/collections/new-arrivals" style="color:' + GOLD + ';">Browse new arrivals</a> and save your favorites<br/>✦ &nbsp;<a href="' + BASE_URL + '/products/bow-corset-garter-set" style="color:' + GOLD + ';">Try an AI preview</a> — private to your browser')}
    ${button('Browse the Collection', BASE_URL)}
    ${para('If you have any questions, reply to this email or visit our <a href="' + BASE_URL + '/pages/contact" style="color:' + GOLD + ';">contact page</a>.')}
  `);
}

function greeting(firstName: string) {
  return firstName ? `Hi ${escapeHtml(firstName)}, your` : 'Your';
}

function wishlistReminderHtml(firstName: string, productTitle: string, productImage: string, productHandle: string) {
  return emailWrapper(`
    ${heading('A style you saved is still waiting.')}
    ${para(`${greeting(firstName)} private wishlist has items ready when you are. No pressure — your saved styles stay private.`)}
    ${divider()}
    ${productRow(productImage, productTitle, null, productUrl(productHandle))}
    ${button('View Your Wishlist', `${BASE_URL}/account/wishlist`)}
    ${para('Your wishlist is private — only visible to you when signed in.')}
  `);
}

function abandonedCartHtml(firstName: string, items: CartItem[]) {
  const rows = items.slice(0, 3).map((item) =>
    productRow(item.image, `${item.title} — ${item.color} / ${item.size}`, item.price, productUrl(item.productId))
  ).join('');
  const extra = items.length - 3;
  const more = extra > 0 ? para(`<em>+ ${extra} more item${extra > 1 ? 's' : ''} in your bag</em>`) : '';
  return emailWrapper(`
    ${heading('You left something in your private bag.')}
    ${para(`${greeting(firstName)} bag is saved and still private. No rush — your styles will be here when you return.`)}
    ${divider()}
    ${rows}
    ${more}
    ${button('Return to Your Bag', BASE_URL)}
    ${para('Your bag stays private in this browser. Billing appears discreetly.')}
  `);
}

function restockAlertHtml(productTitle: string, size: string, color: string, productHandle: string) {
  return emailWrapper(`
    ${heading('Good news — your size is back.')}
    ${para(`${strong(productTitle)} in ${strong(`${color} / ${size}`)} is available again.`)}
    ${button('View Style', productUrl(productHandle))}
    ${para('This notification was sent because you requested a restock alert. We won\'t send it again.')}
  `);
}

export function shipmentCreatedHtml(input: {
  orderNumber: string;
  carrier: string | null;
  trackingNumber: string;
  trackingUrl: string | null;
  lookupToken: string;
}) {
  const privateTrackingUrl = `${BASE_URL}/track/${encodeURIComponent(input.lookupToken)}`;
  const carrierUrl = safeUrl(input.trackingUrl);
  return emailWrapper(`
    ${heading('Your order is on the way.')}
    ${para(`Order ${strong(`#${input.orderNumber}`)} has shipped. Tracking is available through your private order link.`)}
    ${divider()}
    ${para(`${strong('Carrier:')} ${escapeHtml(input.carrier ?? 'Carrier update pending')}<br/>${strong('Tracking:')} ${escapeHtml(input.trackingNumber)}`)}
    ${button('View Private Tracking', privateTrackingUrl)}
    ${carrierUrl ? para(`Carrier page: <a href="${escapeHtml(carrierUrl)}" style="color:${GOLD};">open tracking</a>`) : ''}
    ${para('For privacy, this message does not include product names. Billing appears discreetly.')}
  `);
}

// Sent to whatever address is typed into the public contact form, so it must not contain
// anything the submitter controls — otherwise it becomes a branded phishing relay.
function contactConfirmationHtml() {
  return emailWrapper(`
    ${heading('Thanks for reaching out.')}
    ${para('We received your message and will reply within 24 hours.')}
    ${para('For urgent matters, please include your order number (once ordering is live) or a brief description so we can help faster.')}
    ${divider()}
    ${para('While you wait, you can explore the collection or use the <a href="' + BASE_URL + '/pages/faq" style="color:' + GOLD + ';">FAQ</a> for common questions.')}
    ${para('If you did not contact us, you can ignore this email.')}
    ${button('Back to Self Love', BASE_URL)}
  `);
}

function contactNotificationHtml(name: string, email: string, subject: string, message: string) {
  return emailWrapper(`
    ${heading('New contact form submission')}
    ${para(`${strong('From:')} ${escapeHtml(name)} &lt;${escapeHtml(email)}&gt;`)}
    ${para(`${strong('Subject:')} ${escapeHtml(subject)}`)}
    ${divider()}
    ${para(escapeHtml(message).replace(/\r?\n/g, '<br/>'))}
  `);
}

function newsletterWelcomeHtml() {
  return emailWrapper(`
    ${heading('Welcome to Self Love')}
    ${para('You now have private early access to new arrivals, member-only offers, and exclusive styling guides — all sent discreetly to this address.')}
    ${para('If you did not sign up, you can ignore this email. To unsubscribe, reply with "unsubscribe".')}
  `);
}

export function giftCardHtml(input: {
  code: string;
  amount: number;
  recipientName?: string | null;
  senderName?: string | null;
  message?: string | null;
  expiresAt: Date;
}) {
  const sender = escapeHtml(input.senderName || 'Someone special');
  const amount = `$${input.amount.toFixed(2)}`;
  return emailWrapper(`
    ${heading(`A gift for you, ${escapeHtml(input.recipientName || 'you')}`)}
    ${para(`${sender} sent you a Self Love gift card worth <strong style="color:${GOLD};">${amount}</strong>.`)}
    ${input.message ? `<blockquote style="border-left:2px solid ${GOLD};padding-left:16px;margin:20px 0;font-style:italic;color:${MUTED};font-size:13px;font-family:Arial,sans-serif;">&ldquo;${escapeHtml(input.message).replace(/\r?\n/g, '<br/>')}&rdquo;</blockquote>` : ''}
    <div style="background:${BG};border:1px solid ${BORDER};padding:20px;text-align:center;margin:24px 0;">
      <p style="font-size:11px;color:${MUTED};margin:0 0 8px;letter-spacing:0.2em;text-transform:uppercase;font-family:Arial,sans-serif;">Your Gift Card Code</p>
      <p style="font-size:22px;font-weight:300;color:${GOLD};letter-spacing:0.15em;margin:0;">${escapeHtml(input.code)}</p>
      <p style="font-size:11px;color:${MUTED};margin:8px 0 0;font-family:Arial,sans-serif;">Balance: ${amount} · Expires: ${input.expiresAt.toLocaleDateString('en-US', { year: 'numeric', month: 'long' })}</p>
    </div>
    ${para('Enter this code at checkout to redeem your gift.')}
    ${para('Sent discreetly. The gift card is valid for one year from issue date.')}
  `);
}

export function referralRewardHtml(input: { code: string; amount: number; minimumSubtotal: number; kind: 'welcome' | 'referrer' }) {
  const amount = `$${input.amount.toFixed(2)}`;
  const condition = input.minimumSubtotal > 0 ? ` on an order of $${input.minimumSubtotal.toFixed(2)} or more` : '';
  const intro = input.kind === 'welcome'
    ? `Welcome to Self Love. Because a friend invited you, here is ${strong(amount)} off your first order${condition}.`
    : `Your friend just placed their first order. Thank you for the introduction &mdash; here is ${strong(amount)} off your next order${condition}.`;
  return emailWrapper(`
    ${heading(input.kind === 'welcome' ? 'A gift from your friend.' : 'Thank you for the referral.')}
    ${para(intro)}
    <div style="background:${BG};border:1px solid ${BORDER};padding:20px;text-align:center;margin:24px 0;">
      <p style="font-size:11px;color:${MUTED};margin:0 0 8px;letter-spacing:0.2em;text-transform:uppercase;font-family:Arial,sans-serif;">Your code</p>
      <p style="font-size:22px;font-weight:300;color:${GOLD};letter-spacing:0.15em;margin:0;">${escapeHtml(input.code)}</p>
    </div>
    ${para('Enter it in the discount field at checkout. It can be used once and does not expire.')}
    ${button('Shop the Collection', BASE_URL)}
  `);
}

// ─── Send helpers ───────────────────────────────────────────────────────────────

export async function sendWelcomeEmail(to: string, firstName: string) {
  return deliver({ to, subject: 'Your private wardrobe is ready', html: welcomeHtml(firstName) });
}

export async function sendWishlistReminderEmail(
  to: string,
  firstName: string,
  productTitle: string,
  productImage: string,
  productHandle: string,
) {
  return deliver({
    to,
    subject: 'A style you saved is still waiting',
    html: wishlistReminderHtml(firstName, productTitle, productImage, productHandle),
  });
}

export async function sendAbandonedCartEmail(to: string, firstName: string, items: CartItem[]) {
  return deliver({ to, subject: 'You left something in your private bag', html: abandonedCartHtml(firstName, items) });
}

export async function sendRestockAlertEmail(
  to: string,
  productTitle: string,
  size: string,
  color: string,
  productHandle: string,
) {
  return deliver({
    to,
    subject: headerText(`Back in stock: ${productTitle} — ${color} / ${size}`),
    html: restockAlertHtml(productTitle, size, color, productHandle),
  });
}

export async function sendShipmentCreatedEmail(input: {
  to: string;
  orderNumber: string;
  carrier: string | null;
  trackingNumber: string;
  trackingUrl: string | null;
  lookupToken: string;
}) {
  return deliver({
    to: input.to,
    subject: headerText(`Your Self Love order #${input.orderNumber} has shipped`),
    html: shipmentCreatedHtml(input),
  });
}

export async function sendContactConfirmation(to: string) {
  return deliver({ to, subject: 'We received your message — Self Love', html: contactConfirmationHtml() });
}

export async function sendContactNotification(
  name: string,
  email: string,
  subject: string,
  message: string,
) {
  const recipientEmail = process.env.CONTACT_RECIPIENT_EMAIL ?? 'ykj2018720@gmail.com';
  return deliver({
    to: recipientEmail,
    replyTo: email,
    subject: headerText(`[Self Love Contact] ${subject} — from ${name}`),
    html: contactNotificationHtml(name, email, subject, message),
  });
}

export async function sendNewsletterWelcomeEmail(to: string) {
  return deliver({ to, subject: 'Welcome to Self Love — Your Private Access', html: newsletterWelcomeHtml() });
}

export async function sendGiftCardEmail(input: {
  to: string;
  code: string;
  amount: number;
  recipientName?: string | null;
  senderName?: string | null;
  message?: string | null;
  expiresAt: Date;
}) {
  return deliver({
    to: input.to,
    subject: headerText(`You've received a Self Love gift card — ${input.senderName || 'A friend'} sent you a gift`),
    html: giftCardHtml(input),
  });
}

export async function sendReferralRewardEmail(input: {
  to: string;
  code: string;
  amount: number;
  minimumSubtotal: number;
  kind: 'welcome' | 'referrer';
  idempotencyKey?: string;
}) {
  return deliver({
    to: input.to,
    subject: input.kind === 'welcome' ? 'Your welcome gift from a friend — Self Love' : 'Thank you for referring a friend — Self Love',
    html: referralRewardHtml(input),
  }, input.idempotencyKey);
}
