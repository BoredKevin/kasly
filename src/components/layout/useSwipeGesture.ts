import { useEffect, useRef, useState } from "react";

interface SwipeGestureOptions {
  onOpenLeft: () => void;
  isAnyDrawerOpen: boolean;
  edgeThreshold?: number;
  drawerWidth?: number;
}

export function useInteractiveSwipeGesture({
  onOpenLeft,
  isAnyDrawerOpen,
  edgeThreshold = 35,
  drawerWidth = 320,
}: SwipeGestureOptions) {
  const [activeDragSide, setActiveDragSide] = useState<"left" | null>(null);
  const [dragProgress, setDragProgress] = useState(0);
  const [isDraggingEdge, setIsDraggingEdge] = useState(false);

  const gestureStateRef = useRef<{
    startX: number;
    startY: number;
    startTime: number;
    side: "left" | null;
    isConfirmedHorizontal: boolean;
    isConfirmedVertical: boolean;
  } | null>(null);

  useEffect(() => {
    // If drawer is open, do not attach edge listeners
    if (isAnyDrawerOpen) {
      return;
    }

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      const touch = e.touches[0];
      const startX = touch.clientX;
      const startY = touch.clientY;

      let side: "left" | null = null;
      if (startX <= edgeThreshold) {
        side = "left";
      }

      if (!side) {
        gestureStateRef.current = null;
        return;
      }

      gestureStateRef.current = {
        startX,
        startY,
        startTime: Date.now(),
        side,
        isConfirmedHorizontal: false,
        isConfirmedVertical: false,
      };
    };

    const handleTouchMove = (e: TouchEvent) => {
      const state = gestureStateRef.current;
      if (!state || !state.side) return;

      const touch = e.touches[0];
      const deltaX = touch.clientX - state.startX;
      const deltaY = touch.clientY - state.startY;

      // Determine initial gesture direction
      if (!state.isConfirmedHorizontal && !state.isConfirmedVertical) {
        if (Math.abs(deltaY) > 10 && Math.abs(deltaY) > Math.abs(deltaX)) {
          state.isConfirmedVertical = true;
          return;
        }
        if (Math.abs(deltaX) > 8 && Math.abs(deltaX) > Math.abs(deltaY)) {
          if (deltaX > 0) {
            state.isConfirmedHorizontal = true;
          } else {
            state.isConfirmedVertical = true;
            return;
          }
        }
      }

      if (state.isConfirmedHorizontal) {
        if (e.cancelable) {
          e.preventDefault();
        }
        const progress = Math.min(1, Math.max(0, deltaX / drawerWidth));

        setActiveDragSide(state.side);
        setIsDraggingEdge(true);
        setDragProgress(progress);
      }
    };

    const handleTouchEnd = (e: TouchEvent) => {
      const state = gestureStateRef.current;
      if (!state) return;

      if (state.isConfirmedHorizontal && state.side === "left") {
        const touch = e.changedTouches[0];
        const deltaX = touch.clientX - state.startX;
        const deltaTime = Date.now() - state.startTime;
        const velocityX = deltaX / (deltaTime || 1);

        const finalProgress = Math.min(1, Math.max(0, deltaX / drawerWidth));
        if (finalProgress > 0.3 || velocityX > 0.35) {
          onOpenLeft();
        }
      }

      gestureStateRef.current = null;
      setActiveDragSide(null);
      setIsDraggingEdge(false);
      setDragProgress(0);
    };

    const handleTouchCancel = () => {
      gestureStateRef.current = null;
      setActiveDragSide(null);
      setIsDraggingEdge(false);
      setDragProgress(0);
    };

    window.addEventListener("touchstart", handleTouchStart, { passive: true });
    window.addEventListener("touchmove", handleTouchMove, { passive: false });
    window.addEventListener("touchend", handleTouchEnd, { passive: true });
    window.addEventListener("touchcancel", handleTouchCancel, { passive: true });

    return () => {
      window.removeEventListener("touchstart", handleTouchStart);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", handleTouchEnd);
      window.removeEventListener("touchcancel", handleTouchCancel);
    };
  }, [onOpenLeft, isAnyDrawerOpen, edgeThreshold, drawerWidth]);

  return {
    activeDragSide,
    dragProgress,
    isDraggingEdge,
  };
}
