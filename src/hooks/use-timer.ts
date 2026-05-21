'use client';

import { useEffect, useRef, useState } from 'react';

export function useTimer(initial: number, onExpire: () => void, active: boolean) {
  const [time, setTime] = useState(initial);
  const onExpireRef = useRef(onExpire);
  onExpireRef.current = onExpire;
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!active) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      setTime(initial);
      return;
    }

    intervalRef.current = setInterval(() => {
      setTime((prev) => {
        if (prev <= 1) {
          if (intervalRef.current) clearInterval(intervalRef.current);
          onExpireRef.current();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [active, initial]);

  return time;
}
