import { useContext } from "react";
import { ActiveWorkspaceContext } from "./activeWorkspaceContextInstance";

export function useActiveWorkspace() {
  const context = useContext(ActiveWorkspaceContext);
  if (!context) {
    throw new Error("useActiveWorkspace must be used within an ActiveWorkspaceProvider");
  }
  return context;
}
