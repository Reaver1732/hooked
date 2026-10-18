import type { FlagType, Message } from './messages.ts';

export const FLAG_LABELS: Record<FlagType, string> = {
  'lookalike-sender': 'Copycat sender or website',
  urgency: 'Rushes or scares you',
  'mismatched-link': 'Link goes somewhere else',
  'asks-for-credentials': 'Asks for passwords, codes, money, or private info',
  'generic-greeting': 'Doesn’t use your name',
  'too-good-to-be-true': 'Too good to be true',
  'unexpected-attachment': 'Unexpected attachment',
};

/**
 * Counts the red-flag types in phish that were marked Legit, most-missed first
 * (ties broken by label). Used by the solo results screen and the class summary.
 */
export function mostMissedFlags(answers: { message: Message; guessedPhish: boolean }[]): [FlagType, number][] {
  const counts = new Map<FlagType, number>();
  for (const { message, guessedPhish } of answers) {
    if (!message.isPhish || guessedPhish) continue;
    for (const h of message.highlights) {
      if (h.type) counts.set(h.type, (counts.get(h.type) ?? 0) + 1);
    }
  }
  return [...counts].sort(([typeA, a], [typeB, b]) => b - a || FLAG_LABELS[typeA].localeCompare(FLAG_LABELS[typeB]));
}
