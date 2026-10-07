import { useState, useCallback, ReactNode } from "react";
import { Id } from "../../convex/_generated/dataModel";
import { ActiveWorkspaceContext } from "./activeWorkspaceContextInstance";

const STORAGE_KEY_ORG = "kasly_active_org_id";
const getFundStorageKey = (orgId: string) => `kasly_active_fund_${orgId}`;

export function ActiveWorkspaceProvider({ children }: { children: ReactNode }) {
  const [activeOrgId, setActiveOrgIdState] = useState<Id<"organizations"> | null>(() => {
    if (typeof window === "undefined") return null;
    const stored = localStorage.getItem(STORAGE_KEY_ORG);
    return (stored as Id<"organizations">) || null;
  });

  const [activeFundId, setActiveFundIdState] = useState<Id<"funds"> | null>(() => {
    if (typeof window === "undefined") return null;
    const storedOrg = localStorage.getItem(STORAGE_KEY_ORG);
    if (storedOrg) {
      const storedFund = localStorage.getItem(getFundStorageKey(storedOrg));
      if (storedFund) return storedFund as Id<"funds">;
    }
    return null;
  });

  const setActiveOrgId = useCallback((newOrgId: Id<"organizations"> | null) => {
    setActiveOrgIdState(newOrgId);
    if (typeof window === "undefined") return;
    if (newOrgId) {
      localStorage.setItem(STORAGE_KEY_ORG, newOrgId);
      const storedFundForOrg = localStorage.getItem(getFundStorageKey(newOrgId));
      setActiveFundIdState((storedFundForOrg as Id<"funds">) || null);
    } else {
      localStorage.removeItem(STORAGE_KEY_ORG);
      setActiveFundIdState(null);
    }
  }, []);

  const setActiveFundId = useCallback((newFundId: Id<"funds"> | null) => {
    setActiveFundIdState(newFundId);
    if (typeof window === "undefined") return;
    const currentOrgId = activeOrgId || (localStorage.getItem(STORAGE_KEY_ORG) as Id<"organizations"> | null);
    if (currentOrgId) {
      const key = getFundStorageKey(currentOrgId);
      if (newFundId) {
        localStorage.setItem(key, newFundId);
      } else {
        localStorage.removeItem(key);
      }
    }
  }, [activeOrgId]);

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
