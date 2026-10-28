'use client';

import { useEffect, useRef } from 'react';

export default function GameClient() {
  const root = useRef(null);

  useEffect(() => {
    let active = true;
    let cleanup;
    import('../src/main.js').then(({ mountGame }) => {
      if (active && root.current) cleanup = mountGame(root.current);
    });
    return () => {
      active = false;
      cleanup?.();
    };
  }, []);

  return <div id="app" ref={root} />;
}
