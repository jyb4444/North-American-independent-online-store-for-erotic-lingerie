import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { aiPreviewSafetyIssue, isAiPreviewEligibleProduct } from '../../src/lib/ai-preview-safety';
import { cartTotalsByCurrency, formatMoney, productImage } from '../../src/lib/product-display';
import { referralRewardSettings, referralRewardsEnabled } from '../../src/lib/referral-config';

test('AI preview rejects minor-coded product context after the full prompt is assembled', () => {
  assert.equal(aiPreviewSafetyIssue('adult model wearing a Schoolgirl Costume Lace Role-Play Set'), 'minor');
  assert.equal(isAiPreviewEligibleProduct({ title: 'School-girl Costume', description: 'Role-play set' }), false);
  assert.equal(isAiPreviewEligibleProduct({ title: 'Floral Lace Robe', description: 'Adult sleepwear' }), true);
});

test('public referral marketing is disabled unless explicitly enabled', () => {
  const previous = process.env.REFERRAL_REWARDS_ENABLED;
  delete process.env.REFERRAL_REWARDS_ENABLED;
  assert.equal(referralRewardsEnabled(), false);
  process.env.REFERRAL_REWARDS_ENABLED = 'true';
  assert.equal(referralRewardsEnabled(), true);
  if (previous === undefined) delete process.env.REFERRAL_REWARDS_ENABLED;
  else process.env.REFERRAL_REWARDS_ENABLED = previous;
});

test('footer uses the server referral flag and retired newsletter jobs stay out of admin review', async () => {
  const footer = await readFile(new URL('../../src/components/layout/Footer.tsx', import.meta.url), 'utf8');
  const operations = await readFile(new URL('../../src/app/admin/operations/page.tsx', import.meta.url), 'utf8');
  assert.match(footer, /referralRewardsEnabled\(\)/);
  assert.doesNotMatch(footer, /NEXT_PUBLIC_REFERRAL_REWARDS_ENABLED/);
  assert.match(operations, /\.not\('kind', 'in', '\(newsletter_confirmation,newsletter_welcome\)'\)/);
});

test('public referral display settings reject invalid values', () => {
  const previousAmount = process.env.REFERRAL_REWARD_AMOUNT;
  const previousMinimum = process.env.REFERRAL_REWARD_MIN_SUBTOTAL;
  process.env.REFERRAL_REWARD_AMOUNT = '-2';
  process.env.REFERRAL_REWARD_MIN_SUBTOTAL = 'invalid';
  assert.deepEqual(referralRewardSettings(), { amount: 10, minimumSubtotal: 30 });
  if (previousAmount === undefined) delete process.env.REFERRAL_REWARD_AMOUNT;
  else process.env.REFERRAL_REWARD_AMOUNT = previousAmount;
  if (previousMinimum === undefined) delete process.env.REFERRAL_REWARD_MIN_SUBTOTAL;
  else process.env.REFERRAL_REWARD_MIN_SUBTOTAL = previousMinimum;
});

test('commerce display helpers preserve currency boundaries and image fallback', () => {
  assert.equal(formatMoney(12.5, 'USD'), '$12.50');
  assert.deepEqual(cartTotalsByCurrency([
    { price: 10, quantity: 2, currency: 'USD' },
    { price: 5, quantity: 1, currency: 'CAD' },
  ]), { USD: 20, CAD: 5 });
  assert.equal(productImage({ images: [] }), '/logo.png');
});

test('the storefront does not advertise the retired Fit Advisor flow', async () => {
  const cartDrawer = await readFile(new URL('../../src/components/cart/CartDrawer.tsx', import.meta.url), 'utf8');
  const productPage = await readFile(new URL('../../src/app/(shop)/products/[handle]/ProductPageClient.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(cartDrawer, /Try Fit Advisor/);
  assert.doesNotMatch(productPage, /FitAdvisor|Try our Fit Advisor/);
});

test('product quantity can increase before variant selection and is capped after selection', async () => {
  const productPage = await readFile(new URL('../../src/app/(shop)/products/[handle]/ProductPageClient.tsx', import.meta.url), 'utf8');
  assert.match(productPage, /const quantityLimit = selectedVariant \? Math\.min\(99, selectedVariant\.stock\) : 99/);
  assert.match(productPage, /disabled=\{quantity >= quantityLimit\}/);
  assert.doesNotMatch(productPage, /disabled=\{!selectedVariant \|\| quantity >=/);
});

test('signup keeps identity fields visible while referral marketing is disabled', async () => {
  const login = await readFile(new URL('../../src/app/(account)/login/LoginClient.tsx', import.meta.url), 'utf8');
  assert.match(login, /\{mode === 'signup' && \(\s*<div className="grid grid-cols-2 gap-3">/);
  assert.match(login, /\{mode === 'signup' && referralsEnabled && \(\s*<div>\s*<label htmlFor="login-referral"/);
});

test('tracking rejects non-string fields before calling logistics lookups', async () => {
  const route = await readFile(new URL('../../src/app/api/logistics/track/route.ts', import.meta.url), 'utf8');
  assert.match(route, /typeof input\[key\] !== 'string'/);
  assert.match(route, /Tracking details must be text/);
});

test('quick view auto-selects sole available options and hides a Default color', async () => {
  const quickView = await readFile(new URL('../../src/components/ui/QuickViewModal.tsx', import.meta.url), 'utf8');
  assert.match(quickView, /const initialColor = colors\.length === 1 \? colors\[0\] : null/);
  assert.match(quickView, /uniqueColors\[0\]\?\.color\.toLowerCase\(\) !== 'default'/);
});

test('restock alert targets an unavailable variant without making it purchasable', async () => {
  const selector = await readFile(new URL('../../src/components/product/VariantSelector.tsx', import.meta.url), 'utf8');
  assert.match(selector, /setRestockVariant\(unavailable \?\? null\)/);
  assert.match(selector, /restockVariant && \(/);
  assert.match(selector, /Choose a colour before selecting a size or requesting a restock alert/);
  assert.match(selector, /selectedColor \? isAvailable\(size, selectedColor\) : hasAnyStock\(size\)/);
  assert.doesNotMatch(selector, /disabled=!product\.variants/);
  assert.match(selector, /resolve\(size: string \| null, color: string \| null\)[\s\S]*variant\.stock > 0/);
});
