import assert from "node:assert/strict";
import test from "node:test";
import { canActivatePilot, managerCanAccessBusiness, outstandingActivationChecks, safeBusinessSlug, type ActivationChecks } from "../lib/onboarding";

const completeChecks: ActivationChecks = {
  businessDetailsComplete: true,
  managerAccountActive: true,
  googleConnectionTested: true,
  customerPageApproved: true,
  nfcTested: true,
  qrTested: true,
  privateFeedbackTested: true,
  notificationEmailTested: true,
};

test("pilot activation is blocked while any required onboarding check is incomplete", () => {
  const incomplete = { ...completeChecks, qrTested: false };
  assert.equal(canActivatePilot(incomplete), false);
  assert.deepEqual(outstandingActivationChecks(incomplete), ["qrTested"]);
});

test("pilot activation is allowed only after all required checks pass", () => {
  assert.equal(canActivatePilot(completeChecks), true);
  assert.deepEqual(outstandingActivationChecks(completeChecks), []);
});

test("a manager cannot access another business", () => {
  assert.equal(managerCanAccessBusiness("business-a", "business-a"), true);
  assert.equal(managerCanAccessBusiness("business-a", "business-b"), false);
  assert.equal(managerCanAccessBusiness("", "business-a"), false);
});

test("business slugs are stable and URL safe", () => {
  assert.equal(safeBusinessSlug("  The Corner Café & Co. "), "the-corner-caf-co");
});
