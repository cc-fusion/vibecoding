import { useEffect, useRef } from 'react';
// @ts-ignore - vanilla JS game engine (React is only the mount wrapper)
import { initTetris } from './game/main.js';
import './game/styles.css';

export default function App() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    const destroy = initTetris(ref.current);
    return destroy;
  }, []);

  return <div id="tetris-root" ref={ref} />;
}
