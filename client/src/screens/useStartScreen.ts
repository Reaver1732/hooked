import { useEffect, useRef, useState } from 'react';
import { api, ApiRequestError } from '../class/api.ts';
import { forgetClass, storedClasses, type StoredClass } from '../class/storage.ts';
import type { ClassSession } from './JoinScreen.tsx';

/**
 * The start screen's behavior (saved classes, focus moves), separate from how it looks,
 * so every visual design shares it.
 */
export function useStartScreen({ session, rejoinCode }: { session: ClassSession | null; rejoinCode: string | null }) {
  const joinRef = useRef<HTMLButtonElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const rejoinRef = useRef<HTMLHeadingElement>(null);
  const hadSession = useRef(session !== null);
  const [classes, setClasses] = useState<StoredClass[]>(storedClasses);

  // Classes created on this browser: drop any the server says are gone (deleted or expired).
  useEffect(() => {
    let cancelled = false;
    for (const { code } of storedClasses()) {
      api.classStatus(code).catch((err) => {
        if (cancelled || !(err instanceof ApiRequestError) || err.status !== 404) return;
        forgetClass(code);
        setClasses((list) => list.filter((c) => c.code !== code));
      });
    }
    return () => {
      cancelled = true;
    };
  }, []);

  // A fresh rejoin code is the first thing to read (and hear) after joining.
  useEffect(() => {
    if (rejoinCode) rejoinRef.current?.focus();
  }, [rejoinCode]);

  // "Leave class" removes itself, so hand focus to the "Join a class" button that replaces it.
  useEffect(() => {
    if (hadSession.current && !session) joinRef.current?.focus();
    hadSession.current = session !== null;
  }, [session]);

  return { joinRef, headingRef, rejoinRef, classes };
}
