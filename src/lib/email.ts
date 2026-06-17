import { Resend } from 'resend';
import type { CartItem } from '@/types';

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM = process.env.RESEND_FROM_EMAIL ?? 'Velour <onboarding@resend.dev>';
const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

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
  <title>Velour</title>
</head>
<body style="margin:0;padding:0;background:${BG};font-family:Georgia,serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:${BG};padding:40px 16px;">
    <tr><td align="center">
      <table width="100%" style="max-width:560px;background:${SURFACE};border:1px solid ${BORDER};">
        <tr><td style="padding:36px 40px 0;text-align:center;border-bottom:1px solid ${BORDER};">
          <p style="margin:0;font-family:Georgia,serif;font-size:26px;font-style:italic;font-weight:300;color:${GOLD};letter-spacing:0.06em;">Velour</p>
          <p style="margin:8px 0 0;font-size:10px;text-transform:uppercase;letter-spacing:0.3em;color:${MUTED};font-family:Arial,sans-serif;">Private Intimate Apparel</p>
          <div style="margin:20px auto 0;height:1px;width:40px;background:${BORDER};"></div>
        </td></tr>
        <tr><td style="padding:36px 40px;">
          ${body}
        </td></tr>
        <tr><td style="padding:24px 40px;border-top:1px solid ${BORDER};text-align:center;">
          <p style="margin:0;font-size:10px;color:${MUTED};font-family:Arial,sans-serif;line-height:1.6;">
            © ${new Date().getFullYear()} Velour · Private Intimate Apparel<br/>
            Billing appears as <strong style="color:${IVORY};">VLR APPAREL</strong> — never as Velour or intimate apparel.<br/>
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

function heading(text: string) {
  return `<h1 style="margin:0 0 16px;font-family:Georgia,serif;font-size:24px;font-weight:300;color:${IVORY};letter-spacing:0.02em;">${text}</h1>`;
}

function para(text: string) {
  return `<p style="margin:0 0 16px;font-size:14px;line-height:1.7;color:${MUTED};font-family:Arial,sans-serif;">${text}</p>`;
}

function button(label: string, href: string) {
  return `<table cellpadding="0" cellspacing="0" style="margin:24px 0;">
    <tr><td style="border:1px solid ${GOLD};text-align:center;">
      <a href="${href}" style="display:block;padding:13px 32px;font-size:10px;font-family:Arial,sans-serif;text-transform:uppercase;letter-spacing:0.2em;color:${GOLD};text-decoration:none;">${label}</a>
    </td></tr>
  </table>`;
}

function divider() {
  return `<div style="height:1px;background:${BORDER};margin:24px 0;"></div>`;
}

function productRow(image: string, title: string, price: number, href: string) {
  const displayImage = image.startsWith('/') ? `${BASE_URL}${image}` : image;
  return `<table cellpadding="0" cellspacing="0" width="100%" style="margin-bottom:12px;border:1px solid ${BORDER};">
    <tr>
      <td width="70" style="padding:10px;vertical-align:top;">
        <img src="${displayImage}" width="60" height="80" alt="${title}" style="object-fit:cover;display:block;" />
      </td>
      <td style="padding:10px;vertical-align:top;">
        <a href="${href}" style="font-size:13px;color:${IVORY};text-decoration:none;font-family:Georgia,serif;font-weight:300;">${title}</a>
        <p style="margin:6px 0 0;font-size:13px;color:${GOLD};font-family:Georgia,serif;">$${price.toFixed(2)}</p>
      </td>
    </tr>
  </table>`;
}

// ─── Templates ─────────────────────────────────────────────────────────────────

function welcomeHtml(firstName: string) {
  return emailWrapper(`
    ${heading(`Welcome, ${firstName || 'there'}.`)}
    ${para('Your private wardrobe is ready. Everything here — your fit profile, saved looks, and wishlist — stays private to this account.')}
    ${divider()}
    ${para('<strong style="color:' + IVORY + ';">What you can do now:</strong>')}
    ${para('✦ &nbsp;<a href="' + BASE_URL + '/pages/size-guide" style="color:' + GOLD + ';">Create your private fit profile</a> for guided sizing<br/>✦ &nbsp;<a href="' + BASE_URL + '/collections/new-arrivals" style="color:' + GOLD + ';">Browse new arrivals</a> and save your favorites<br/>✦ &nbsp;<a href="' + BASE_URL + '/products/bow-corset-garter-set" style="color:' + GOLD + ';">Try an AI preview</a> — private to your browser')}
    ${button('Browse the Collection', BASE_URL)}
    ${para('If you have any questions, reply to this email or visit our <a href="' + BASE_URL + '/pages/contact" style="color:' + GOLD + ';">contact page</a>.')}
  `);
}

function wishlistReminderHtml(firstName: string, productTitle: string, productImage: string, productHandle: string) {
  return emailWrapper(`
    ${heading('A style you saved is still waiting.')}
    ${para(`${firstName ? 'Hi ' + firstName + ', your' : 'Your'} private wishlist has items ready when you are. No pressure — your saved styles stay private.`)}
    ${divider()}
    ${productRow(productImage, productTitle, 0, `${BASE_URL}/products/${productHandle}`)}
    ${button('View Your Wishlist', `${BASE_URL}/account/wishlist`)}
    ${para('Your wishlist is private — only visible to you when signed in.')}
  `);
}

function abandonedCartHtml(firstName: string, items: CartItem[]) {
  const rows = items.slice(0, 3).map((item) =>
    productRow(item.image, `${item.title} — ${item.color} / ${item.size}`, item.price, `${BASE_URL}/products/${item.productId}`)
  ).join('');
  const more = items.length > 3 ? para(`<em>+ ${items.length - 3} more item${items.length - 3 > 1 ? 's' : ''} in your bag</em>`) : '';
  return emailWrapper(`
    ${heading('You left something in your private bag.')}
    ${para(`${firstName ? 'Hi ' + firstName + ', your' : 'Your'} bag is saved and still private. No rush — your styles will be here when you return.`)}
    ${divider()}
    ${rows}
    ${more}
    ${button('Return to Your Bag', BASE_URL)}
    ${para('Your bag stays private in this browser. Billing always appears as <strong style="color:' + IVORY + ';">VLR APPAREL</strong>.')}
  `);
}

function restockAlertHtml(productTitle: string, size: string, color: string, productHandle: string) {
  return emailWrapper(`
    ${heading('Good news — your size is back.')}
    ${para(`<strong style="color:${IVORY};">${productTitle}</strong> in <strong style="color:${IVORY};">${color} / ${size}</strong> is available again.`)}
    ${button('View Style', `${BASE_URL}/products/${productHandle}`)}
    ${para('This notification was sent because you requested a restock alert. We won\'t send it again.')}
  `);
}

function contactConfirmationHtml(name: string) {
  return emailWrapper(`
    ${heading(`Thanks, ${name}.`)}
    ${para('We received your message and will reply within 24 hours.')}
    ${para('For urgent matters, please include your order number (once ordering is live) or a brief description so we can help faster.')}
    ${divider()}
    ${para('While you wait, you can explore the collection or use the <a href="' + BASE_URL + '/pages/faq" style="color:' + GOLD + ';">FAQ</a> for common questions.')}
    ${button('Back to Velour', BASE_URL)}
  `);
}

// ─── Send helpers ───────────────────────────────────────────────────────────────

export async function sendWelcomeEmail(to: string, firstName: string) {
  return resend.emails.send({
    from: FROM,
    to,
    subject: 'Your private wardrobe is ready',
    html: welcomeHtml(firstName),
  });
}

export async function sendWishlistReminderEmail(
  to: string,
  firstName: string,
  productTitle: string,
  productImage: string,
  productHandle: string,
) {
  return resend.emails.send({
    from: FROM,
    to,
    subject: 'A style you saved is still waiting',
    html: wishlistReminderHtml(firstName, productTitle, productImage, productHandle),
  });
}

export async function sendAbandonedCartEmail(to: string, firstName: string, items: CartItem[]) {
  return resend.emails.send({
    from: FROM,
    to,
    subject: 'You left something in your private bag',
    html: abandonedCartHtml(firstName, items),
  });
}

export async function sendRestockAlertEmail(
  to: string,
  productTitle: string,
  size: string,
  color: string,
  productHandle: string,
) {
  return resend.emails.send({
    from: FROM,
    to,
    subject: `Back in stock: ${productTitle} — ${color} / ${size}`,
    html: restockAlertHtml(productTitle, size, color, productHandle),
  });
}

export async function sendContactConfirmation(to: string, name: string) {
  return resend.emails.send({
    from: FROM,
    to,
    subject: "We received your message — Velour",
    html: contactConfirmationHtml(name),
  });
}

export async function sendContactNotification(
  name: string,
  email: string,
  subject: string,
  message: string,
) {
  const recipientEmail = process.env.CONTACT_RECIPIENT_EMAIL ?? 'ykj2018720@gmail.com';
  return resend.emails.send({
    from: FROM,
    to: recipientEmail,
    replyTo: email,
    subject: `[Velour Contact] ${subject} — from ${name}`,
    html: emailWrapper(`
      ${heading('New contact form submission')}
      ${para('<strong style="color:' + IVORY + ';">From:</strong> ' + name + ' &lt;' + email + '&gt;')}
      ${para('<strong style="color:' + IVORY + ';">Subject:</strong> ' + subject)}
      ${divider()}
      ${para(message.replace(/\n/g, '<br/>'))}
    `),
  });
}
