import { useEffect, useState } from 'react';

export function readNavigatorOnline(): boolean {
  return typeof navigator === 'undefined' ? true : navigator.onLine !== false;
}

export function useOnlineStatus(): boolean {
  const [online, setOnline] = useState(readNavigatorOnline);

  useEffect(() => {
    const sync = () => setOnline(readNavigatorOnline());
    window.addEventListener('online', sync);
    window.addEventListener('offline', sync);
    queueMicrotask(sync);
    return () => {
      window.removeEventListener('online', sync);
      window.removeEventListener('offline', sync);
    };
  }, []);

  return online;
}
