import assert from 'node:assert/strict';
import test from 'node:test';
import { createRecoveryProof, verifyRecoveryProof } from '@/lib/password-recovery';

process.env.PASSWORD_RECOVERY_SECRET = 'unit-test-password-recovery-secret-32-chars';

test('recovery proof is signed, user-bound and short lived', () => {
  const now = Date.parse('2026-10-22T12:00:00Z');
  const proof = createRecoveryProof('user-a', now);
  assert.equal(verifyRecoveryProof(proof, 'user-a', now + 1_000), true);
  assert.equal(verifyRecoveryProof(proof, 'user-b', now + 1_000), false);
  assert.equal(verifyRecoveryProof(`${proof.slice(0, -1)}x`, 'user-a', now + 1_000), false);
  assert.equal(verifyRecoveryProof(proof, 'user-a', now + 11 * 60_000), false);
  assert.equal(verifyRecoveryProof('1', 'user-a', now), false);
});
