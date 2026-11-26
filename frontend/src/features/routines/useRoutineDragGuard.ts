import { type PointerEvent as ReactPointerEvent, useRef, useState } from "react";
import { useChangeToast } from "../../stores/changeToastStore";

/**
 * Detects drag attempts on non-draggable routine items, shakes the element, and shows a
 * brief toast popup ("Cannot drag routines").
 */
export function useRoutineDragGuard() {
  const showNotice = useChangeToast((state) => state.showNotice);
  const [shaking, setShaking] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const trigger = () => {
    clearTimeout(timer.current);
    setShaking(false);
    requestAnimationFrame(() => setShaking(true));
    timer.current = setTimeout(() => setShaking(false), 360);
    showNotice("Cannot drag routines");
  };

  const onPointerDown = (event: ReactPointerEvent) => {
    if (event.button !== 0) return;
    const startX = event.clientX;
    const startY = event.clientY;
    let triggered = false;

    const cleanup = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", cleanup);
      window.removeEventListener("pointercancel", cleanup);
    };

    const onMove = (move: PointerEvent) => {
      if (triggered) return;
      if (Math.hypot(move.clientX - startX, move.clientY - startY) >= 6) {
        triggered = true;
        cleanup();
        trigger();
      }
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", cleanup);
    window.addEventListener("pointercancel", cleanup);
  };

  return {
    shaking,
    shakeClass: shaking ? "animate-routine-shake" : "",
    onPointerDown,
  };
}
