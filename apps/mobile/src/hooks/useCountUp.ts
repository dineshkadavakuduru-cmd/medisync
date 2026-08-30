import { useState, useEffect } from 'react';

export function useCountUp(target: number, duration = 1000): number {
  const [value, setValue] = useState(0);

  useEffect(() => {
    const startTime = Date.now();
    let raf: number;

    const animate = () => {
      const now = Date.now();
      const progress = Math.min((now - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(eased * target));

      if (progress < 1) {
        raf = requestAnimationFrame(animate);
      }
    };

    raf = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);

  return value;
}
