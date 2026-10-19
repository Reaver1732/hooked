import { useCallback, useState } from 'react';

// P and L answer from anywhere on the play screen. Single-letter shortcuts can be set off by
// speech input or a stray key, so they can be turned off (WCAG 2.1.4); the choice is kept on
// this device. Enter for "Next" isn't a letter key and stays.
const KEY = 'hooked.letterShortcuts';

function read(): boolean {
  try {
    return window.localStorage.getItem(KEY) !== 'off';
  } catch {
    return true;
  }
}

export function useLetterShortcuts(): [boolean, (on: boolean) => void] {
  const [on, setOn] = useState(read);
  const set = useCallback((value: boolean) => {
    setOn(value);
    try {
      if (value) window.localStorage.removeItem(KEY);
      else window.localStorage.setItem(KEY, 'off');
    } catch {
      // Storage unavailable: the choice lasts until the page is reloaded.
    }
  }, []);
  return [on, set];
}
