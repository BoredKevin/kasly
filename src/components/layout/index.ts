export { Header } from "./Header";
export { Layout } from "./Layout";
export { SwipeDrawer } from "./SwipeDrawer";
export { useInteractiveSwipeGesture } from "./useSwipeGesture";
export { NavDrawerProvider } from "./NavDrawerContext";
export { useNavDrawer } from "./useNavDrawer";

if (typeof window !== "undefined" && window.__updateAppProgress) {
  window.__updateAppProgress(75, "Loading layout & navigation...");
}
