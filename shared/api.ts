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

/** Rejoin codes use the same unambiguous alphabet as class codes. */
export const REJOIN_CODE_LENGTH = 6;
export const DEFAULT_TARGET_PERCENT = 80;

export type CreateClassResponse = { code: string; teacherKey: string };
export type JoinClassRequest = { nickname: string };
/** The rejoin code is returned once, here; only its hash is stored. */
export type JoinClassResponse = { playerId: string; nickname: string; rejoinCode: string };
export type RejoinRequest = { nickname: string; rejoinCode: string };
export type RejoinResponse = { playerId: string; nickname: string };

/** The current unfinished attempt: its id and what this player has answered so far. */
export type AttemptProgress = { attemptId: string; answers: { messageId: string; choice: Choice }[] };
export type PlayerProgress = {
  playerId: string;
  nickname: string;
  classCode: string;
  currentAttempt: AttemptProgress | null;
  finishedAttempts: number;
};

export type SubmitAnswerRequest = { playerId: string; attemptId: string; messageId: string; choice: Choice };
export type SubmitAnswerResponse = { correct: boolean; alreadyAnswered: boolean; attemptFinished: boolean };
export type ResetRejoinCodeResponse = { rejoinCode: string };
export type UpdateClassRequest = { targetPercent: number };
/** Returned when the teacher keeps the class alive (dashboard load or "Keep this class"). */
export type KeepClassResponse = { expiresAt: string };

export type Score = { correct: number; total: number; percent: number };

export type ClassSummary = {
  code: string;
  /** ISO time the class will be deleted if nothing happens before then. */
  expiresAt: string;
  targetPercent: number;
  playerCount: number;
  totalMessages: number;
  /** Mean of best-attempt percentages among players with a finished attempt; null if none. */
  averageBestPercent: number | null;
  passedCount: number;
  players: {
    id: string;
    nickname: string;
    /** Finished attempts. */
    attempts: number;
    /** Messages answered in the current unfinished attempt, if there is one. */
    inProgress: number | null;
    /** The first finished attempt, played before seeing any answers. */
    first: Score | null;
    /** The best finished attempt; decides `passed`. */
    best: Score | null;
    passed: boolean;
  }[];
  /** From each player's first finished attempt. */
  mostMissedFlags: { type: FlagType; count: number }[];
  /** From each player's first finished attempt. */
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
