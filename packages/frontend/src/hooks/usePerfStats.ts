import { useState, useEffect } from 'react';
import { perfStats, type PerfSnapshot } from '../store/perfStats.ts';

/** Poll perfStats every 1s to display in UI without Zustand overhead */
export function usePerfStats(): PerfSnapshot {
  const [snapshot, setSnapshot] = useState<PerfSnapshot>({ ...perfStats });

  useEffect(() => {
    const timer = setInterval(() => {
      setSnapshot({ ...perfStats });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  return snapshot;
}
