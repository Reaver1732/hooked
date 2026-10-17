import type {
  ApiError,
  ClassSummary,
  CreateClassResponse,
  JoinClassResponse,
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

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      ...init,
      headers: { ...(init.body ? { 'Content-Type': 'application/json' } : {}), ...init.headers },
    });
  } catch {
    throw new ApiRequestError('Couldn’t reach the server. Check your connection and try again.', null);
  }
  if (res.status === 204) return undefined as T;
  const data: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const message = (data as ApiError | null)?.error ?? `Request failed (HTTP ${res.status})`;
    throw new ApiRequestError(message, res.status);
  }
  return data as T;
}

const teacherHeaders = (teacherKey: string) => ({ 'X-Teacher-Key': teacherKey });

export const api = {
  createClass: () => request<CreateClassResponse>('/classes', { method: 'POST' }),

  joinClass: (code: string, nickname: string) =>
    request<JoinClassResponse>(`/classes/${encodeURIComponent(code)}/join`, {
      method: 'POST',
      body: JSON.stringify({ nickname }),
    }),

  submitAnswer: (body: SubmitAnswerRequest) =>
    request<SubmitAnswerResponse>('/answers', { method: 'POST', body: JSON.stringify(body) }),

  summary: (code: string, teacherKey: string) =>
    request<ClassSummary>(`/classes/${encodeURIComponent(code)}/summary`, { headers: teacherHeaders(teacherKey) }),

  removePlayer: (code: string, teacherKey: string, playerId: string) =>
    request<void>(`/classes/${encodeURIComponent(code)}/players/${encodeURIComponent(playerId)}`, {
      method: 'DELETE',
      headers: teacherHeaders(teacherKey),
    }),
};
