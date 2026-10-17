import type { Message } from '../data/messages.ts';

export type Answer = { message: Message; guessedPhish: boolean };

export const isCorrect = (a: Answer) => a.guessedPhish === a.message.isPhish;
