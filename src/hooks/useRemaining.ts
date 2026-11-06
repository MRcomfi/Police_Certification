import { useEffect, useState } from 'react';

/**
 * Сколько миллисекунд осталось до момента until (0, если момент прошёл или не задан).
 * Компонент перерисовывается на каждой границе секунды и один раз после истечения срока,
 * поэтому блокировка снимается автоматически, без перезагрузки страницы.
 */
export function useRemaining(until: number | null): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (until === null) return undefined;

    let timer = 0;
    const tick = () => {
      const current = Date.now();
      setNow(current);
      const remaining = until - current;
      if (remaining > 0) {
        // Ждём следующей границы секунды (+ небольшой запас), чтобы ММ:СС менялось ровно раз в секунду.
        timer = window.setTimeout(tick, (remaining % 1000 || 1000) + 20);
      }
    };
    timer = window.setTimeout(tick, 0);

    return () => window.clearTimeout(timer);
  }, [until]);

  return until === null ? 0 : Math.max(0, until - now);
}
