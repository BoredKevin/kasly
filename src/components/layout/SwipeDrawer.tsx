import { ReactNode, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavDrawer } from "./useNavDrawer";

interface SwipeDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  side: "left" | "right";
  children: ReactNode;
  widthClass?: string;
}

export function SwipeDrawer({
  isOpen,
  onClose,
  side,
  children,
  widthClass = "w-[85vw] max-w-sm sm:max-w-md",
}: SwipeDrawerProps) {
  const { activeDragSide, dragProgress, isDraggingEdge } = useNavDrawer();

  const isEdgeDraggingThis = isDraggingEdge && activeDragSide === side;

  // DOM mount state (stays mounted during open and close transitions)
  const [isMounted, setIsMounted] = useState(isOpen || isEdgeDraggingThis);
  // Visual active animation state
  const [isActive, setIsActive] = useState(false);

  const shouldBeOpen = Boolean(isOpen || isEdgeDraggingThis);

  if (shouldBeOpen && !isMounted) {
    setIsMounted(true);
  }
  if (!shouldBeOpen && isActive) {
    setIsActive(false);
  }

  // Local drag-to-close state when drawer is open
  const [closeDragOffset, setCloseDragOffset] = useState<number | null>(null);
  const [closeDragRemainingRatio, setCloseDragRemainingRatio] = useState<number>(1);
  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Handle open / close transitions and mount lifecycle
  useEffect(() => {
    if (shouldBeOpen) {
      // Double RAF ensures browser commits the initial offscreen layout before starting transition
      let cleanupFrame2: number | null = null;
      const frame1 = requestAnimationFrame(() => {
        const frame2 = requestAnimationFrame(() => {
          setIsActive(true);
        });
        cleanupFrame2 = frame2;
      });
      return () => {
        cancelAnimationFrame(frame1);
        if (cleanupFrame2 !== null) {
          cancelAnimationFrame(cleanupFrame2);
        }
      };
    }
  }, [shouldBeOpen]);

  // Safety fallback unmount timeout if onTransitionEnd does not fire
  useEffect(() => {
    if (!isOpen && !isEdgeDraggingThis && isMounted && !isActive) {
      const timer = setTimeout(() => {
        setIsMounted(false);
      }, 350);
      return () => clearTimeout(timer);
    }
  }, [isOpen, isEdgeDraggingThis, isMounted, isActive]);

  // Prevent body scrolling when drawer is mounted
  useEffect(() => {
    if (isMounted) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isMounted]);

  // Handle ESC key to close
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Handle drag-to-close on the panel when open
  const handlePanelTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      touchStartRef.current = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY,
        time: Date.now(),
      };
    }
  };

  const handlePanelTouchMove = (e: React.TouchEvent) => {
    if (!touchStartRef.current) return;
    const currentX = e.touches[0].clientX;
    const currentY = e.touches[0].clientY;
    const deltaX = currentX - touchStartRef.current.x;
    const deltaY = currentY - touchStartRef.current.y;

    const panelWidth = panelRef.current?.offsetWidth || 320;

    // Only initiate closing drag if horizontal drag exceeds vertical drag
    if (Math.abs(deltaX) > Math.abs(deltaY)) {
      if (side === "left" && deltaX < 0) {
        // Dragging left on a left drawer
        setCloseDragOffset(deltaX);
        const ratio = Math.max(0, 1 - Math.abs(deltaX) / panelWidth);
        setCloseDragRemainingRatio(ratio);
      } else if (side === "right" && deltaX > 0) {
        // Dragging right on a right drawer
        setCloseDragOffset(deltaX);
        const ratio = Math.max(0, 1 - Math.abs(deltaX) / panelWidth);
        setCloseDragRemainingRatio(ratio);
      }
    }
  };

  const handlePanelTouchEnd = (e: React.TouchEvent) => {
    if (!touchStartRef.current) return;
    const touch = e.changedTouches[0];
    const deltaX = touch.clientX - touchStartRef.current.x;
    const deltaTime = Date.now() - touchStartRef.current.time;
    const velocityX = deltaX / (deltaTime || 1);

    const panelWidth = panelRef.current?.offsetWidth || 320;

    if (side === "left") {
      if (deltaX < -panelWidth * 0.25 || velocityX < -0.35) {
        onClose();
      }
    } else if (side === "right") {
      if (deltaX > panelWidth * 0.25 || velocityX > 0.35) {
        onClose();
      }
    }

    touchStartRef.current = null;
    setCloseDragOffset(null);
    setCloseDragRemainingRatio(1);
  };

  const handlePanelTouchCancel = () => {
    touchStartRef.current = null;
    setCloseDragOffset(null);
    setCloseDragRemainingRatio(1);
  };

  // Clean unmount on transition end when closed
  const handleTransitionEnd = (e: React.TransitionEvent<HTMLDivElement>) => {
    if (e.target === panelRef.current && e.propertyName === "transform") {
      if (!isOpen && !isEdgeDraggingThis) {
        setIsMounted(false);
      }
    }
  };

  if (!isMounted || typeof document === "undefined") return null;

  // Calculate transform and visual progress
  let transform = side === "left" ? "translateX(-100%)" : "translateX(100%)";
  let blurAmount = 0;
  let bgAlpha = 0;
  let opacity = 0;
  const isActivelyDragging = isEdgeDraggingThis || closeDragOffset !== null;

  if (isEdgeDraggingThis) {
    if (side === "left") {
      transform = `translateX(${(dragProgress - 1) * 100}%)`;
    } else {
      transform = `translateX(${(1 - dragProgress) * 100}%)`;
    }
    blurAmount = Math.max(0, dragProgress * 16);
    bgAlpha = dragProgress * 0.75;
    opacity = dragProgress;
  } else if (closeDragOffset !== null) {
    transform = `translateX(${closeDragOffset}px)`;
    blurAmount = Math.max(0, closeDragRemainingRatio * 16);
    bgAlpha = closeDragRemainingRatio * 0.75;
    opacity = closeDragRemainingRatio;
  } else if (isActive) {
    transform = "translateX(0%)";
    blurAmount = 16;
    bgAlpha = 0.75;
    opacity = 1;
  }

  const drawerElement = (
    <div className="fixed inset-0 z-[60] flex">
      {/* Full Page Backdrop with smooth fade and blur transition */}
      <div
        className="fixed inset-0 z-[60]"
        style={{
          backgroundColor: `rgba(0, 0, 0, ${bgAlpha})`,
          backdropFilter: `blur(${blurAmount}px)`,
          WebkitBackdropFilter: `blur(${blurAmount}px)`,
          opacity,
          transition: isActivelyDragging
            ? "none"
            : "opacity 0.28s ease, background-color 0.28s ease, backdrop-filter 0.28s ease, -webkit-backdrop-filter 0.28s ease",
          pointerEvents: isActive ? "auto" : "none",
        }}
        onClick={onClose}
        aria-hidden={!isActive}
      />

      {/* Drawer Panel - Solid Dark Background with Glass Blur, Shadow & Smooth Slide Animation */}
      <div
        ref={panelRef}
        onTouchStart={handlePanelTouchStart}
        onTouchMove={handlePanelTouchMove}
        onTouchEnd={handlePanelTouchEnd}
        onTouchCancel={handlePanelTouchCancel}
        onTransitionEnd={handleTransitionEnd}
        style={{
          transform,
          backgroundColor: "rgba(10, 10, 10, 0.75)",
          backdropFilter: "blur(24px)",
          WebkitBackdropFilter: "blur(24px)",
          transition: isActivelyDragging
            ? "none"
            : "transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
        }}
        className={`fixed inset-y-0 ${
          side === "left" ? "left-0" : "right-0"
        } ${widthClass} z-[70] flex flex-col ${
          side === "left" ? "border-r" : "border-l"
        } border-border/80 shadow-2xl shadow-black select-none touch-pan-y will-change-transform`}
      >
        {/* Drawer Top Drag Handle Bar */}
        <div className="py-2.5 flex items-center justify-center shrink-0">
          <div className="w-10 h-1 bg-muted-foreground/30 rounded-full" />
        </div>

        {/* Drawer Content */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden p-3.5 pt-1 space-y-4">
          {children}
        </div>
      </div>
    </div>
  );

  return createPortal(drawerElement, document.body);
}
