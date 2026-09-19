export const requiredActivationChecks = [
  "businessDetailsComplete",
  "managerAccountActive",
  "googleConnectionTested",
  "customerPageApproved",
  "nfcTested",
  "qrTested",
  "privateFeedbackTested",
  "notificationEmailTested",
] as const;

export type ActivationChecks = Record<(typeof requiredActivationChecks)[number], boolean>;

export function outstandingActivationChecks(checks: ActivationChecks) {
  return requiredActivationChecks.filter(key => !checks[key]);
}

export function canActivatePilot(checks: ActivationChecks) {
  return outstandingActivationChecks(checks).length === 0;
}

export function managerCanAccessBusiness(sessionBusinessId: string, requestedBusinessId: string) {
  return Boolean(sessionBusinessId) && sessionBusinessId === requestedBusinessId;
}

export function safeBusinessSlug(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80);
}
