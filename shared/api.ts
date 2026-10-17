// Request/response shapes for the class API, shared by client and server.
import type { FlagType, Message } from './messages.ts';

/** 6 characters, no look-alikes (0/O, 1/I/L), so codes are easy to read off a projector. */
export const CLASS_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const CLASS_CODE_LENGTH = 6;
export const NICKNAME_MAX = 20;
export const MAX_PLAYERS_PER_CLASS = 60;
/** Classes with no activity for this long are deleted, with their players and answers. */
export const CLASS_IDLE_DAYS = 7;

export type Choice = 'phish' | 'legit';

export type CreateClassResponse = { code: string; teacherKey: string };
export type JoinClassRequest = { nickname: string };
export type JoinClassResponse = { playerId: string };
export type SubmitAnswerRequest = { playerId: string; messageId: string; choice: Choice };
export type SubmitAnswerResponse = { correct: boolean; alreadyAnswered: boolean };
/** Returned when the teacher keeps the class alive (dashboard load or "Keep this class"). */
export type KeepClassResponse = { expiresAt: string };

export type ClassSummary = {
  code: string;
  /** ISO time the class will be deleted if nothing happens before then. */
  expiresAt: string;
  playerCount: number;
  totalMessages: number;
  /** Mean correct answers among players who answered at least one message; null if none have. */
  averageCorrect: number | null;
  players: { id: string; nickname: string; answered: number; correct: number }[];
  mostMissedFlags: { type: FlagType; count: number }[];
  perMessage: {
    id: string;
    kind: Message['kind'];
    label: string;
    isPhish: boolean;
    answered: number;
    /** 0-100, or null when nobody has answered it yet. */
    percentCorrect: number | null;
  }[];
};

export type ApiError = { error: string };
