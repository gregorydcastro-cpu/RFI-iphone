/**
 * Field Log-facing helpers for `procore_connections.notify_email`.
 *
 * Parse / resolve live in notifyMike.ts so Node tests do not need a
 * second module. Persist helpers are in notifyEmailStore.ts.
 */

export {
  NOTIFY_EMAIL_COLUMN,
  isNotifyEmail,
  normalizeNotifyEmail,
  parseNotifyEmailInput,
  resolveBumpNotifyRecipients,
} from "./notifyMike";

export type {
  NotifyEmailParse,
  NotifyRecipientDelivery,
  NotifyRecipientPlan,
  NotifyRecipientSkip,
  NotifyRecipientSkipReason,
  NotifyRecipientSource,
} from "./notifyMike";
