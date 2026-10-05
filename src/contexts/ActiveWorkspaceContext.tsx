import { useState, ReactNode } from "react";
import { Id } from "../../convex/_generated/dataModel";
import { ActiveWorkspaceContext } from "./activeWorkspaceContextInstance";

export function ActiveWorkspaceProvider({ children }: { children: ReactNode }) {
  const [activeOrgId, setActiveOrgId] = useState<Id<"organizations"> | null>(null);
  const [activeFundId, setActiveFundId] = useState<Id<"funds"> | null>(null);

  return (
    <ActiveWorkspaceContext.Provider
      value={{
        activeOrgId,
        setActiveOrgId,
        activeFundId,
        setActiveFundId,
      }}
    >
      {children}
    </ActiveWorkspaceContext.Provider>
  );
}
