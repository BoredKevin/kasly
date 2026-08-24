import { createContext } from "react";
import { Id } from "../../convex/_generated/dataModel";

export interface ActiveWorkspaceContextType {
  activeOrgId: Id<"organizations"> | null;
  setActiveOrgId: (id: Id<"organizations"> | null) => void;
}

export const ActiveWorkspaceContext = createContext<ActiveWorkspaceContextType | undefined>(undefined);
