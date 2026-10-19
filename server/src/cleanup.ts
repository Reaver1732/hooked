import { idleCutoff } from './classes.ts';
import { databaseDownReason, getPrisma } from './db.ts';

const HOUR_MS = 60 * 60 * 1000;

/** Deletes classes idle for CLASS_IDLE_DAYS (players and answers cascade). Runs now, then hourly. */
export function startClassCleanup(): void {
  const run = async () => {
    const prisma = getPrisma();
    if (!prisma) return;
    try {
      const { count } = await prisma.class.deleteMany({ where: { lastActivityAt: { lt: idleCutoff() } } });
      if (count) console.log(`class cleanup: deleted ${count} idle class${count === 1 ? '' : 'es'}`);
    } catch (err) {
      const down = databaseDownReason(err);
      if (down) console.error(`class cleanup skipped: database unavailable (${down})`);
      else console.error('class cleanup failed', err);
    }
  };
  void run();
  setInterval(run, HOUR_MS).unref();
}
