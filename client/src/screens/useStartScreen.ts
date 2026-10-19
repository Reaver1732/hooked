import { useEffect, useRef, useState } from 'react';
import { api, ApiRequestError } from '../class/api.ts';
import { forgetDashboardKey } from '../class/dashboardLink.ts';
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
  const classesHeadingRef = useRef<HTMLHeadingElement>(null);
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

  // "Forget" on a shared computer: drop the class from this browser only. The class and its
  // results stay, and the saved dashboard link still opens it.
  const forget = (code: string) => {
    if (!window.confirm(`Forget class ${code} on this device? The class and its results stay; you’ll need the dashboard link you saved to open it again.`)) {
      return;
    }
    forgetClass(code);
    forgetDashboardKey(code);
    focusAfterForget.current = true;
    setClasses((list) => list.filter((c) => c.code !== code));
  };
  // The row (and its focused button) is gone: once the list has re-rendered, keep focus nearby.
  const focusAfterForget = useRef(false);
  useEffect(() => {
    if (!focusAfterForget.current) return;
    focusAfterForget.current = false;
    (classes.length ? classesHeadingRef : headingRef).current?.focus({ preventScroll: true });
  }, [classes]);

  return { joinRef, headingRef, rejoinRef, classesHeadingRef, classes, forget };
}
