import { test } from '@playwright/test';

/**
 * Marks the current test as failing because of a known, not-yet-fixed defect
 * (docs/testing/TEST_PLAN.md §0). The suite stays green while the bug exists and turns red
 * the moment it is fixed — then delete the knownDefect() call.
 *
 * Run with STRICT=1 to disable the marking and see the real assertion failures.
 */
export function knownDefect(defectId: string, summary: string) {
  test.info().annotations.push({ type: 'known-defect', description: `${defectId}: ${summary}` });
  test.fail(!process.env.STRICT, `${defectId}: ${summary}`);
}
