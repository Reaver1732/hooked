import type {
  ApiError,
  AttemptProgress,
  ClassSummary,
  CreateClassResponse,
  JoinClassResponse,
  KeepClassResponse,
  PlayerProgress,
  RejoinResponse,
  ResetRejoinCodeResponse,
  SubmitAnswerRequest,
  SubmitAnswerResponse,
} from '../../../shared/api.ts';

export class ApiRequestError extends Error {
  constructor(
    message: string,
    readonly status: number | null, // null: the request never got a response
  ) {
    super(message);
  }
}

// The server gives up on the database after about 10 seconds, so a request still open after 15
// is stuck somewhere on the way. Without this, a stalled request leaves "Joining…" up forever.
const REQUEST_TIMEOUT_MS = 15_000;

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    let res: Response;
    try {
      res = await fetch(`/api${path}`, {
        ...init,
        signal: controller.signal,
        headers: { ...(init.body ? { 'Content-Type': 'application/json' } : {}), ...init.headers },
      });
    } catch {
      throw new ApiRequestError(
        controller.signal.aborted
          ? 'The server is taking too long to answer. Try again in a minute.'
          : 'Couldn’t reach the server. Check your connection and try again.',
        null,
      );
    }
    if (res.status === 204) return undefined as T;
    const data: unknown = await res.json().catch(() => null);
    if (!res.ok) {
      const message = (data as ApiError | null)?.error ?? `Request failed (HTTP ${res.status})`;
      throw new ApiRequestError(message, res.status);
    }
    return data as T;
  } finally {
    clearTimeout(timer);
  }
}

const teacherHeaders = (teacherKey: string) => ({ 'X-Teacher-Key': teacherKey });

export const api = {
  createClass: () => request<CreateClassResponse>('/classes', { method: 'POST' }),

  joinClass: (code: string, nickname: string) =>
    request<JoinClassResponse>(`/classes/${encodeURIComponent(code)}/join`, {
      method: 'POST',
      body: JSON.stringify({ nickname }),
    }),

  rejoinClass: (code: string, nickname: string, rejoinCode: string) =>
    request<RejoinResponse>(`/classes/${encodeURIComponent(code)}/rejoin`, {
      method: 'POST',
      body: JSON.stringify({ nickname, rejoinCode }),
    }),

  /** This player's own progress; rejects with 404 if they were removed or the class closed. */
  player: (playerId: string) => request<PlayerProgress>(`/players/${encodeURIComponent(playerId)}`),

  /** Resumes the unfinished attempt, or starts a new one. */
  startAttempt: (playerId: string) =>
    request<AttemptProgress>(`/players/${encodeURIComponent(playerId)}/attempts`, { method: 'POST' }),

  submitAnswer: (body: SubmitAnswerRequest) =>
    request<SubmitAnswerResponse>('/answers', { method: 'POST', body: JSON.stringify(body) }),

  summary: (code: string, teacherKey: string) =>
    request<ClassSummary>(`/classes/${encodeURIComponent(code)}/summary`, { headers: teacherHeaders(teacherKey) }),

  removePlayer: (code: string, teacherKey: string, playerId: string) =>
    request<void>(`/classes/${encodeURIComponent(code)}/players/${encodeURIComponent(playerId)}`, {
      method: 'DELETE',
      headers: teacherHeaders(teacherKey),
    }),

  /** Resets the inactivity timer. Called on the dashboard's first load and by "Keep this class". */
  keepClass: (code: string, teacherKey: string) =>
    request<KeepClassResponse>(`/classes/${encodeURIComponent(code)}/keep`, {
      method: 'POST',
      headers: teacherHeaders(teacherKey),
    }),

  setTargetPercent: (code: string, teacherKey: string, targetPercent: number) =>
    request<{ targetPercent: number }>(`/classes/${encodeURIComponent(code)}`, {
      method: 'PATCH',
      headers: teacherHeaders(teacherKey),
      body: JSON.stringify({ targetPercent }),
    }),

  resetRejoinCode: (code: string, teacherKey: string, playerId: string) =>
    request<ResetRejoinCodeResponse>(
      `/classes/${encodeURIComponent(code)}/players/${encodeURIComponent(playerId)}/rejoin-code`,
      { method: 'POST', headers: teacherHeaders(teacherKey) },
    ),

  deleteClass: (code: string, teacherKey: string) =>
    request<void>(`/classes/${encodeURIComponent(code)}`, { method: 'DELETE', headers: teacherHeaders(teacherKey) }),

  /** Resolves if the class is still open; rejects with status 404 once it's closed or expired. */
  classStatus: (code: string) => request<{ open: true }>(`/classes/${encodeURIComponent(code)}/status`),
};
