import assert from 'node:assert/strict';
import test from 'node:test';
import { aiPreviewSafetyIssue, isAiPreviewEligibleProduct } from '../../src/lib/ai-preview-safety';
import { cartTotalsByCurrency, formatMoney, productImage } from '../../src/lib/product-display';
import { publicReferralRewardSettings, referralMarketingEnabled } from '../../src/lib/referral-public';

test('AI preview rejects minor-coded product context after the full prompt is assembled', () => {
  assert.equal(aiPreviewSafetyIssue('adult model wearing a Schoolgirl Costume Lace Role-Play Set'), 'minor');
  assert.equal(isAiPreviewEligibleProduct({ title: 'School-girl Costume', description: 'Role-play set' }), false);
  assert.equal(isAiPreviewEligibleProduct({ title: 'Floral Lace Robe', description: 'Adult sleepwear' }), true);
});

test('public referral marketing is disabled unless explicitly enabled', () => {
  const previous = process.env.NEXT_PUBLIC_REFERRAL_REWARDS_ENABLED;
  delete process.env.NEXT_PUBLIC_REFERRAL_REWARDS_ENABLED;
  assert.equal(referralMarketingEnabled(), false);
  process.env.NEXT_PUBLIC_REFERRAL_REWARDS_ENABLED = 'true';
  assert.equal(referralMarketingEnabled(), true);
  if (previous === undefined) delete process.env.NEXT_PUBLIC_REFERRAL_REWARDS_ENABLED;
  else process.env.NEXT_PUBLIC_REFERRAL_REWARDS_ENABLED = previous;
});

test('public referral display settings reject invalid values', () => {
  const previousAmount = process.env.NEXT_PUBLIC_REFERRAL_REWARD_AMOUNT;
  const previousMinimum = process.env.NEXT_PUBLIC_REFERRAL_REWARD_MIN_SUBTOTAL;
  process.env.NEXT_PUBLIC_REFERRAL_REWARD_AMOUNT = '-2';
  process.env.NEXT_PUBLIC_REFERRAL_REWARD_MIN_SUBTOTAL = 'invalid';
  assert.deepEqual(publicReferralRewardSettings(), { amount: 10, minimumSubtotal: 30 });
  if (previousAmount === undefined) delete process.env.NEXT_PUBLIC_REFERRAL_REWARD_AMOUNT;
  else process.env.NEXT_PUBLIC_REFERRAL_REWARD_AMOUNT = previousAmount;
  if (previousMinimum === undefined) delete process.env.NEXT_PUBLIC_REFERRAL_REWARD_MIN_SUBTOTAL;
  else process.env.NEXT_PUBLIC_REFERRAL_REWARD_MIN_SUBTOTAL = previousMinimum;
});

test('commerce display helpers preserve currency boundaries and image fallback', () => {
  assert.equal(formatMoney(12.5, 'USD'), '$12.50');
  assert.deepEqual(cartTotalsByCurrency([
    { price: 10, quantity: 2, currency: 'USD' },
    { price: 5, quantity: 1, currency: 'CAD' },
  ]), { USD: 20, CAD: 5 });
  assert.equal(productImage({ images: [] }), '/logo.png');
});
