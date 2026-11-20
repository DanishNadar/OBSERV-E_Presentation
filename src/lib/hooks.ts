import { createContext, useContext, useEffect, useRef } from "react";

// Deck-wide motion preference
export const MotionContext = createContext({ reducedMotion: false });
export const useMotion = () => useContext(MotionContext);

// rAF loop with clamped dt; stops when inactive and on unmount
export const useAnimationLoop = (callback: (dt: number, elapsed: number) => void, active: boolean) => {
  const saved = useRef(callback);
  saved.current = callback;
  useEffect(() => {
    if (!active) return;
    let handle = 0;
    let last = performance.now();
    let elapsed = 0;
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      elapsed += dt;
      saved.current(dt, elapsed);
      handle = requestAnimationFrame(tick);
    };
    handle = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(handle);
  }, [active]);
};

// Fixed-size hi-DPI canvas context
export const setupCanvas = (canvas: HTMLCanvasElement, w: number, h: number) => {
  const ratio = Math.min(2, window.devicePixelRatio || 1);
  if (canvas.width !== w * ratio) {
    canvas.width = w * ratio;
    canvas.height = h * ratio;
  }
  const ctx = canvas.getContext("2d")!;
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  return ctx;
};

// CSS custom properties for framer-motion elements
export const motionVars = (vars: Record<string, string | number>) => vars as unknown as import("framer-motion").MotionStyle;
