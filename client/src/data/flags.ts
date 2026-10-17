import type { FlagType } from './messages.ts';

export const FLAG_LABELS: Record<FlagType, string> = {
  'lookalike-sender': 'Look-alike sender',
  urgency: 'Pressure and urgency',
  'mismatched-link': 'Link goes somewhere else',
  'asks-for-credentials': 'Asks for passwords or card details',
  'generic-greeting': 'Generic greeting',
  'too-good-to-be-true': 'Too good to be true',
  'unexpected-attachment': 'Unexpected attachment',
};
