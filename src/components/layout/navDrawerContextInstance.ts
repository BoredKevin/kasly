import { createContext } from "react";

export interface NavDrawerContextValue {
  isMainNavOpen: boolean;
  openMainNav: () => void;
  closeMainNav: () => void;
  toggleMainNav: () => void;
  // Live drag state for left edge swipe
  activeDragSide: "left" | null;
  dragProgress: number; // 0 to 1
  isDraggingEdge: boolean;
}

export const NavDrawerContext = createContext<NavDrawerContextValue | null>(null);
