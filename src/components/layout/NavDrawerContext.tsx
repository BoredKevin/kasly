import { useState, ReactNode } from "react";
import { NavDrawerContext } from "./navDrawerContextInstance";
import { useInteractiveSwipeGesture } from "./useSwipeGesture";

export function NavDrawerProvider({
  children,
}: {
  children: ReactNode;
  activeTab?: string;
}) {
  const [isMainNavOpen, setIsMainNavOpen] = useState(false);

  const openMainNav = () => setIsMainNavOpen(true);
  const closeMainNav = () => setIsMainNavOpen(false);
  const toggleMainNav = () => setIsMainNavOpen((prev) => !prev);

  // Real-time left edge gesture tracking
  const { activeDragSide, dragProgress, isDraggingEdge } = useInteractiveSwipeGesture({
    onOpenLeft: openMainNav,
    isAnyDrawerOpen: isMainNavOpen,
    edgeThreshold: 40,
    drawerWidth: 320,
  });

  return (
    <NavDrawerContext.Provider
      value={{
        isMainNavOpen,
        openMainNav,
        closeMainNav,
        toggleMainNav,
        activeDragSide,
        dragProgress,
        isDraggingEdge,
      }}
    >
      {children}
    </NavDrawerContext.Provider>
  );
}

