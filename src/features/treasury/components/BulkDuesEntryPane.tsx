import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useQuery, useMutation, useConvex } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Button,
  Badge,
} from "@boredkevin/ui";
import {
  Users,
  CheckCircle2,
  AlertTriangle,
  Lock,
  Sparkles,
  Trash2,
  Plus,
  Minus,
  ArrowLeft,
  Search,
  CheckCheck,
} from "lucide-react";
import { loadKeypair, listStoredKeys, signLedgerPayload, SigningPayload } from "../../../lib/treasury-crypto";

interface BulkDuesEntryPaneProps {
  organizationId: Id<"organizations">;
  initialFundId?: Id<"funds"> | null;
  onNavigateBack: () => void;
  onOpenKeyGen?: () => void;
  onInspectEntry?: (entryId: Id<"ledgerEntries">) => void;
}

interface StagedPaymentItem {
  id: string; // Unique row ID
  userId: Id<"users">;
  periodCount: number;
  customMemo: string;
  status: "idle" | "signing" | "completed" | "error";
  errorMessage?: string;
  entryHash?: string;
  entryId?: Id<"ledgerEntries">;
}

const HOLD_DURATION_MS = 3000;

function formatPeriodsRange(periods: Array<{ periodLabel: string }>): string {
  if (periods.length === 0) return "";
  if (periods.length === 1) return periods[0].periodLabel;
  const first = periods[0].periodLabel;
  const last = periods[periods.length - 1].periodLabel;
  if (first === last) return first;
  return `${first} – ${last}`;
}

export function BulkDuesEntryPane({
  organizationId,
  initialFundId,
  onNavigateBack,
  onOpenKeyGen,
  onInspectEntry,
}: BulkDuesEntryPaneProps) {
  const convex = useConvex();

  const funds = useQuery(api.treasury.funds.list, { organizationId });
  const myKeys = useQuery(api.treasury.keys.getMyKeys, { organizationId });

  // Selected Fund - derived from state override -> initialFundId -> first active fund
  const [selectedFundIdState, setSelectedFundIdState] = useState<Id<"funds"> | null>(null);
  const selectedFundId =
    selectedFundIdState ??
    initialFundId ??
    funds?.find((f) => !f.isArchived)?._id ??
    funds?.[0]?._id ??
    null;

  const currentFund = funds?.find((f) => f._id === selectedFundId);

  // Load spreadsheet data for the selected fund to know all members and unpaid periods
  const spreadsheet = useQuery(
    api.treasury.dues.getDuesSpreadsheet,
    selectedFundId ? { organizationId, fundId: selectedFundId } : "skip"
  );

  // Device key management
  const [localKeyIds, setLocalKeyIds] = useState<string[]>([]);
  const [isLoadingLocalKeys, setIsLoadingLocalKeys] = useState(true);

  useEffect(() => {
    let isMounted = true;
    listStoredKeys()
      .then((stored) => {
        if (isMounted) {
          setLocalKeyIds(stored.map((s) => s.keyId));
          setIsLoadingLocalKeys(false);
        }
      })
      .catch(() => {
        if (isMounted) {
          setLocalKeyIds([]);
          setIsLoadingLocalKeys(false);
        }
      });
    return () => {
      isMounted = false;
    };
  }, []);

  const activeKeys = useMemo(() => myKeys?.filter((k) => !k.revokedAt) ?? [], [myKeys]);
  const availableKeysOnDevice = useMemo(
    () => activeKeys.filter((k) => localKeyIds.includes(k.keyId)),
    [activeKeys, localKeyIds]
  );
  const otherDeviceKeys = useMemo(
    () => activeKeys.filter((k) => !localKeyIds.includes(k.keyId)),
    [activeKeys, localKeyIds]
  );

  const [selectedKeyIdState, setSelectedKeyIdState] = useState<string>("");
  const selectedKeyId =
    (selectedKeyIdState && localKeyIds.includes(selectedKeyIdState) ? selectedKeyIdState : null) ||
    availableKeysOnDevice[0]?.keyId ||
    activeKeys[0]?.keyId ||
    "";

  const isKeyAvailableOnDevice = Boolean(selectedKeyId && localKeyIds.includes(selectedKeyId));

  // Fast cell map for resolving unpaid periods per member
  const cellMap = useMemo(() => {
    const map = new Map<string, { hasPaid: boolean; isWaived?: boolean }>();
    if (spreadsheet?.cells) {
      for (const cell of spreadsheet.cells) {
        map.set(`${cell.memberId}_${cell.duesEventId}`, {
          hasPaid: cell.hasPaid,
          isWaived: cell.isWaived,
        });
      }
    }
    return map;
  }, [spreadsheet]);

  // Helper to get unpaid events for any member
  const getMemberUnpaidEvents = useCallback(
    (memberId: Id<"members">) => {
      if (!spreadsheet?.events) return [];
      return spreadsheet.events
        .filter((event) => {
          const cell = cellMap.get(`${memberId}_${event._id}`);
          return cell && !cell.hasPaid && !cell.isWaived;
        })
        .sort((a, b) => a.dueDate - b.dueDate);
    },
    [spreadsheet, cellMap]
  );

  // Row ID generator without calling Date.now() during render
  const rowCounterRef = useRef(0);
  const generateRowId = useCallback((userId: string) => {
    rowCounterRef.current += 1;
    return `${userId}_${rowCounterRef.current}_${Math.random().toString(36).slice(2, 7)}`;
  }, []);

  // Storage key specific to org and fund
  const storageKey = useMemo(() => {
    if (!organizationId || !selectedFundId) return null;
    return `kasly_bulk_dues_draft_${organizationId}_${selectedFundId}`;
  }, [organizationId, selectedFundId]);

  // Staged payments queue with lazy local storage hydration on mount
  const [stagedItems, setStagedItems] = useState<StagedPaymentItem[]>(() => {
    if (typeof window === "undefined" || !initialFundId) return [];
    try {
      const saved = localStorage.getItem(`kasly_bulk_dues_draft_${organizationId}_${initialFundId}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed?.rows)) {
          return parsed.rows.map((r: any) => ({ ...r, status: "idle" }));
        }
      }
    } catch {
      // Ignore parse errors
    }
    return [];
  });

  const [searchMemberQuery, setSearchMemberQuery] = useState("");
  const [searchStagedQuery, setSearchStagedQuery] = useState("");

  const handleSelectFund = (newFundId: Id<"funds">) => {
    setSelectedFundIdState(newFundId);
    try {
      const saved = localStorage.getItem(`kasly_bulk_dues_draft_${organizationId}_${newFundId}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed?.rows)) {
          setStagedItems(parsed.rows.map((r: any) => ({ ...r, status: "idle" })));
          return;
        }
      }
    } catch {
      // Ignore
    }
    setStagedItems([]);
  };

  // Auto-persist draft to localStorage on changes
  useEffect(() => {
    if (!storageKey) return;
    try {
      const pendingItems = stagedItems.filter((i) => i.status !== "completed");
      if (pendingItems.length === 0) {
        localStorage.removeItem(storageKey);
      } else {
        const payload = {
          rows: pendingItems.map((i) => ({
            id: i.id,
            userId: i.userId,
            periodCount: i.periodCount,
            customMemo: i.customMemo,
          })),
          updatedAt: Date.now(),
        };
        localStorage.setItem(storageKey, JSON.stringify(payload));
      }
    } catch {
      // Storage full or restricted
    }
  }, [stagedItems, storageKey]);

  // Warn on accidental refresh if there are staged uncommitted items
  useEffect(() => {
    const hasUncommitted = stagedItems.some((i) => i.status !== "completed");
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUncommitted) {
        e.preventDefault();
        e.returnValue = "";
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [stagedItems]);

  // Add individual member
  const handleAddMember = (userId: Id<"users">) => {
    if (stagedItems.some((i) => i.userId === userId && i.status !== "completed")) {
      return;
    }
    const member = spreadsheet?.members?.find((m) => m.userId === userId);
    if (!member) return;

    const unpaidEvents = getMemberUnpaidEvents(member._id);
    if (unpaidEvents.length === 0) return;

    const newItem: StagedPaymentItem = {
      id: generateRowId(userId),
      userId,
      periodCount: 1,
      customMemo: "",
      status: "idle",
    };

    setStagedItems((prev) => [...prev, newItem]);
    setSearchMemberQuery("");
  };

  // Quick-add all members with unpaid dues
  const handleStageAllUnpaid = () => {
    if (!spreadsheet?.members) return;

    const alreadyStagedUserIds = new Set(
      stagedItems.filter((i) => i.status !== "completed").map((i) => i.userId)
    );

    const membersWithUnpaid = spreadsheet.members.filter((m) => {
      if (alreadyStagedUserIds.has(m.userId)) return false;
      const unpaid = getMemberUnpaidEvents(m._id);
      return unpaid.length > 0;
    });

    const newRows: StagedPaymentItem[] = membersWithUnpaid.map((m) => ({
      id: generateRowId(m.userId),
      userId: m.userId,
      periodCount: 1,
      customMemo: "",
      status: "idle",
    }));

    setStagedItems((prev) => [...prev, ...newRows]);
  };

  // Discard draft
  const handleDiscardDraft = () => {
    if (window.confirm("Are you sure you want to discard this staged draft? All uncommitted rows will be cleared.")) {
      setStagedItems([]);
      if (storageKey) {
        localStorage.removeItem(storageKey);
      }
    }
  };

  // Update period count for a staged row
  const handleUpdatePeriodCount = (rowId: string, count: number, maxCount: number) => {
    const validCount = Math.max(1, Math.min(maxCount, count));
    setStagedItems((prev) =>
      prev.map((item) => (item.id === rowId ? { ...item, periodCount: validCount } : item))
    );
  };

  // Remove a staged row
  const handleRemoveRow = (rowId: string) => {
    setStagedItems((prev) => prev.filter((item) => item.id !== rowId));
  };

  // Set all rows to 1 period or max periods
  const handleSetAllPeriods = (mode: "one" | "max") => {
    if (!spreadsheet?.members) return;
    setStagedItems((prev) =>
      prev.map((item) => {
        if (item.status === "completed") return item;
        const member = spreadsheet.members.find((m) => m.userId === item.userId);
        if (!member) return item;
        const unpaid = getMemberUnpaidEvents(member._id);
        const count = mode === "one" ? 1 : Math.max(1, unpaid.length);
        return { ...item, periodCount: count };
      })
    );
  };

  // Resolved rows for calculation and display
  const resolvedStagedRows = useMemo(() => {
    if (!spreadsheet?.members) return [];
    return stagedItems.map((item) => {
      const member = spreadsheet.members.find((m) => m.userId === item.userId);
      const unpaidEvents = member ? getMemberUnpaidEvents(member._id) : [];
      const selectedPeriods = unpaidEvents.slice(0, item.periodCount);
      const amount = selectedPeriods.reduce((sum, e) => sum + e.amount, 0);
      const periodRange = formatPeriodsRange(selectedPeriods);
      const defaultMemo =
        member && selectedPeriods.length > 0
          ? `Dues Payment (${selectedPeriods.length} cycle${selectedPeriods.length > 1 ? "s" : ""}: ${periodRange}) - ${member.nickname || member.name || "Member"}`
          : "";

      return {
        ...item,
        member,
        unpaidEvents,
        selectedPeriods,
        amount,
        periodRange,
        defaultMemo,
        effectiveMemo: item.customMemo || defaultMemo,
      };
    });
  }, [stagedItems, spreadsheet, getMemberUnpaidEvents]);

  // Aggregate stats
  const pendingRows = resolvedStagedRows.filter((r) => r.status !== "completed");
  const completedRows = resolvedStagedRows.filter((r) => r.status === "completed");
  const totalBatchAmount = pendingRows.reduce((sum, r) => sum + r.amount, 0);
  const totalBatchCycles = pendingRows.reduce((sum, r) => sum + r.periodCount, 0);

  // Signing & Batch Commit State
  const [isProcessing, setIsProcessing] = useState(false);
  const [batchProgress, setBatchProgress] = useState<{
    current: number;
    total: number;
  }>({ current: 0, total: 0 });

  // 3-second hold to commit
  const [holdProgress, setHoldProgress] = useState(0);
  const [isHolding, setIsHolding] = useState(false);
  const holdTimerRef = useRef<number | null>(null);
  const holdStartTimeRef = useRef<number | null>(null);

  const markDuesPaid = useMutation(api.treasury.dues.markDuesPaid);

  const stopHold = () => {
    setIsHolding(false);
    setHoldProgress(0);
    holdStartTimeRef.current = null;
    if (holdTimerRef.current !== null) {
      cancelAnimationFrame(holdTimerRef.current);
      holdTimerRef.current = null;
    }
  };

  // Sequential batch cryptographic execution
  const executeBatchCommit = async () => {
    if (!selectedFundId || !selectedKeyId || pendingRows.length === 0 || !isKeyAvailableOnDevice) {
      return;
    }

    setIsProcessing(true);
    setBatchProgress({ current: 0, total: pendingRows.length });

    try {
      const storedKey = await loadKeypair(selectedKeyId);
      if (!storedKey) {
        throw new Error(
          `Private key for (${selectedKeyId.slice(0, 8)}...) not found in this browser's IndexedDB.`
        );
      }

      let processedCount = 0;

      for (const row of pendingRows) {
        // Mark row as signing
        setStagedItems((prev) =>
          prev.map((i) => (i.id === row.id ? { ...i, status: "signing", errorMessage: undefined } : i))
        );

        try {
          // Query latest block HEAD for each transaction to maintain unbroken CLE chain
          const latestEntry = await convex.query(api.treasury.ledger.getLatestEntry, {
            fundId: selectedFundId,
          });

          const sequenceNumber = latestEntry.nextSequenceNumber;
          const previousHash = latestEntry.nextPreviousHash;

          const payload: SigningPayload = {
            fundId: selectedFundId,
            sequenceNumber,
            previousHash,
            direction: "credit",
            amount: row.amount,
            memo: row.effectiveMemo,
            keyId: selectedKeyId,
          };

          const { signature } = await signLedgerPayload(storedKey.privateKey, payload);

          const result = await markDuesPaid({
            organizationId,
            userId: row.userId,
            fundId: selectedFundId,
            periodCount: row.periodCount,
            keyId: selectedKeyId,
            previousHash,
            signature,
            memo: row.effectiveMemo,
          });

          // Mark row as completed
          setStagedItems((prev) =>
            prev.map((i) =>
              i.id === row.id
                ? {
                    ...i,
                    status: "completed",
                    entryHash: result.entryHash,
                    entryId: result.entryId,
                  }
                : i
            )
          );

          processedCount++;
          setBatchProgress({ current: processedCount, total: pendingRows.length });
        } catch (err: unknown) {
          const errMsg = err instanceof Error ? err.message : "Failed to record payment.";
          setStagedItems((prev) =>
            prev.map((i) => (i.id === row.id ? { ...i, status: "error", errorMessage: errMsg } : i))
          );
          // Stop sequential batch on failure to prevent chain mismatch
          break;
        }
      }
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Unexpected batch signing error.");
    } finally {
      setIsProcessing(false);
    }
  };

  const startHold = (e: React.SyntheticEvent) => {
    if (isSubmitDisabled) return;
    e.preventDefault();

    setIsHolding(true);
    holdStartTimeRef.current = null;

    const update = (now: DOMHighResTimeStamp) => {
      if (holdStartTimeRef.current === null) {
        holdStartTimeRef.current = now;
      }
      const elapsed = now - holdStartTimeRef.current;
      const progress = Math.min(1, elapsed / HOLD_DURATION_MS);
      setHoldProgress(progress);

      if (progress >= 1) {
        stopHold();
        void executeBatchCommit();
      } else {
        holdTimerRef.current = requestAnimationFrame(update);
      }
    };

    holdTimerRef.current = requestAnimationFrame(update);
  };

  // Filtered members for Add Member dropdown
  const candidateMembers = useMemo(() => {
    if (!spreadsheet?.members) return [];
    const alreadyStaged = new Set(
      stagedItems.filter((i) => i.status !== "completed").map((i) => i.userId)
    );

    return spreadsheet.members
      .filter((m) => {
        if (alreadyStaged.has(m.userId)) return false;
        const unpaid = getMemberUnpaidEvents(m._id);
        if (unpaid.length === 0) return false;

        if (!searchMemberQuery.trim()) return true;
        const q = searchMemberQuery.toLowerCase();
        return (
          m.name.toLowerCase().includes(q) ||
          (m.nickname && m.nickname.toLowerCase().includes(q)) ||
          (m.email && m.email.toLowerCase().includes(q))
        );
      })
      .slice(0, 15);
  }, [spreadsheet, stagedItems, searchMemberQuery, getMemberUnpaidEvents]);

  // Filter staged rows for searching inside table
  const displayedStagedRows = useMemo(() => {
    if (!searchStagedQuery.trim()) return resolvedStagedRows;
    const q = searchStagedQuery.toLowerCase();
    return resolvedStagedRows.filter((r) => {
      const name = r.member?.name?.toLowerCase() || "";
      const nickname = r.member?.nickname?.toLowerCase() || "";
      const memo = r.effectiveMemo.toLowerCase();
      return name.includes(q) || nickname.includes(q) || memo.includes(q);
    });
  }, [resolvedStagedRows, searchStagedQuery]);

  const isSubmitDisabled = Boolean(
    isProcessing ||
    !selectedFundId ||
    !selectedKeyId ||
    !isKeyAvailableOnDevice ||
    pendingRows.length === 0 ||
    totalBatchAmount <= 0
  );

  return (
    <div className="space-y-6">
      {/* Top Header & Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            chamfer="dual"
            onClick={onNavigateBack}
            className="h-8 text-xs flex items-center gap-1.5 cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Dues</span>
          </Button>

          <div>
            <h1 className="text-lg font-bold text-foreground flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" />
              <span>Bulk Dues Entry</span>
              <span className="text-[10px] font-mono px-2 py-0.5 bg-primary/10 border border-primary/30 text-primary uppercase tracking-wider">
                Full-View Workspace
              </span>
            </h1>
            <p className="text-xs text-muted-foreground">
              Stage and cryptographically batch-commit member dues payments with auto-saved progress.
            </p>
          </div>
        </div>

        {/* Draft Auto-Save Indicator */}
        <div className="flex items-center gap-3 self-start sm:self-auto">
          {pendingRows.length > 0 && (
            <div className="flex items-center gap-1.5 text-[11px] font-mono text-muted-foreground bg-muted/30 px-2.5 py-1 border border-border/80">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>Draft auto-saved ({pendingRows.length} staged)</span>
            </div>
          )}

          {stagedItems.length > 0 && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              chamfer="dual"
              disabled={isProcessing}
              onClick={handleDiscardDraft}
              className="h-8 text-xs text-destructive hover:bg-destructive/15 hover:border-destructive cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5 mr-1" />
              <span>Discard Draft</span>
            </Button>
          )}
        </div>
      </div>

      {/* Context Selection Bar (Destination Fund & Device Signing Key) */}
      <Card telemetry="TREASURY.BULK_CONTEXT" cornerLines className="bg-card/90 border-border shadow-md">
        <CardContent className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Destination Fund Selector */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-foreground">
                Destination Fund *
              </label>
              {selectedFundId === initialFundId && initialFundId && (
                <span className="text-[10px] font-mono text-primary px-1.5 py-0.2 bg-primary/10 border border-primary/20">
                  Auto-selected from active view
                </span>
              )}
            </div>
            {funds && funds.length > 0 ? (
              <select
                value={selectedFundId ?? ""}
                onChange={(e) => handleSelectFund(e.target.value as Id<"funds">)}
                disabled={isProcessing}
                className="w-full h-9 px-2.5 bg-background border border-border text-xs text-foreground font-mono focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
              >
                {funds.map((f) => (
                  <option key={f._id} value={f._id}>
                    {f.name} ({f.currency})
                  </option>
                ))}
              </select>
            ) : (
              <div className="text-xs text-muted-foreground italic py-1">No active funds available.</div>
            )}
          </div>

          {/* Treasurer Signing Key Selector */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-foreground">
                Treasurer Signing Key *
              </label>
              <span className="text-[10px] text-muted-foreground font-mono">
                Browser ECDSA P-256
              </span>
            </div>

            {availableKeysOnDevice.length === 0 && !isLoadingLocalKeys ? (
              <div className="p-2.5 bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>No signing key found on this browser.</span>
                </div>
                {onOpenKeyGen && (
                  <Button
                    type="button"
                    variant="cyber"
                    size="sm"
                    chamfer="dual"
                    onClick={onOpenKeyGen}
                    className="h-6 text-[10px] px-2 cursor-pointer"
                  >
                    Generate Key
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-1">
                <select
                  value={selectedKeyId}
                  onChange={(e) => setSelectedKeyIdState(e.target.value)}
                  disabled={isProcessing}
                  className="w-full h-9 px-2.5 bg-background border border-border text-xs text-foreground font-mono focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
                >
                  {availableKeysOnDevice.length > 0 && (
                    <optgroup label="Available on this device">
                      {availableKeysOnDevice.map((k) => (
                        <option key={k.keyId} value={k.keyId}>
                          ● {k.label ? `${k.label} (${k.keyId.slice(0, 10)}...)` : `Key (${k.keyId.slice(0, 10)}...)`} [Ready]
                        </option>
                      ))}
                    </optgroup>
                  )}
                  {otherDeviceKeys.length > 0 && (
                    <optgroup label="Other devices (Missing private key)">
                      {otherDeviceKeys.map((k) => (
                        <option key={k.keyId} value={k.keyId} disabled>
                          ⚠ {k.label ? `${k.label} (${k.keyId.slice(0, 10)}...)` : `Key (${k.keyId.slice(0, 10)}...)`} [No private key]
                        </option>
                      ))}
                    </optgroup>
                  )}
                </select>

                {isKeyAvailableOnDevice ? (
                  <div className="flex items-center gap-1.5 text-emerald-400 text-[11px] font-mono">
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                    <span>Signing key ready in browser storage</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 text-amber-400 text-[11px] font-mono">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    <span>Selected key is not stored in this browser.</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Aggregate Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card telemetry="TREASURY.BULK_COUNT" cornerLines className="bg-card/90 border-border shadow-sm">
          <CardContent className="p-4 space-y-1">
            <div className="text-[11px] font-mono text-muted-foreground uppercase tracking-wider">
              Staged Members
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold font-mono text-foreground">
                {pendingRows.length}
              </span>
              {completedRows.length > 0 && (
                <span className="text-xs font-mono text-emerald-400">
                  (+{completedRows.length} completed)
                </span>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground font-mono">
              Ready to be signed & recorded
            </p>
          </CardContent>
        </Card>

        <Card telemetry="TREASURY.BULK_CYCLES" cornerLines className="bg-card/90 border-border shadow-sm">
          <CardContent className="p-4 space-y-1">
            <div className="text-[11px] font-mono text-muted-foreground uppercase tracking-wider">
              Total Cycles Covered
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold font-mono text-primary">
                {totalBatchCycles}
              </span>
              <span className="text-xs text-muted-foreground font-mono">dues cycles</span>
            </div>
            <p className="text-[11px] text-muted-foreground font-mono">
              Across all staged member rows
            </p>
          </CardContent>
        </Card>

        <Card telemetry="TREASURY.BULK_AMOUNT" cornerLines className="bg-card/90 border-border shadow-sm">
          <CardContent className="p-4 space-y-1">
            <div className="text-[11px] font-mono text-muted-foreground uppercase tracking-wider">
              Total Collection Value
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold font-mono text-emerald-400">
                {currentFund?.currency ?? "IDR"} {totalBatchAmount.toLocaleString("id-ID")}
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground font-mono">
              Will be credited into {currentFund?.name ?? "fund"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Workspace Table & Staging Actions */}
      <Card telemetry="TREASURY.BULK_QUEUE" cornerLines className="bg-card border-border shadow-xl">
        <CardHeader className="pb-4 border-b border-border/80">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <CardTitle className="text-base font-semibold">
                Staged Member Dues ({resolvedStagedRows.length})
              </CardTitle>
              {pendingRows.length > 0 && (
                <Badge variant="outline" className="text-[10px] font-mono text-amber-400 border-amber-500/40 bg-amber-500/10">
                  {pendingRows.length} PENDING
                </Badge>
              )}
            </div>

            {/* Quick Actions & Member Staging Bar */}
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="cyber"
                size="sm"
                chamfer="dual"
                disabled={isProcessing || !spreadsheet?.members}
                onClick={handleStageAllUnpaid}
                className="h-8 text-xs flex items-center gap-1.5 cursor-pointer font-semibold shadow-sm"
                title="Add all organization members who currently have unpaid dues"
              >
                <Users className="w-3.5 h-3.5" />
                <span>Quick-Add All Members with Unpaid Dues</span>
              </Button>

              {/* Cycle bulk adjustment buttons */}
              {pendingRows.length > 0 && (
                <div className="flex items-center gap-1 bg-muted/40 border border-border p-0.5">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    chamfer="dual"
                    disabled={isProcessing}
                    onClick={() => handleSetAllPeriods("one")}
                    className="h-7 text-[11px] px-2 cursor-pointer text-muted-foreground hover:text-foreground"
                    title="Set all rows to 1 cycle"
                  >
                    All 1x
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    chamfer="dual"
                    disabled={isProcessing}
                    onClick={() => handleSetAllPeriods("max")}
                    className="h-7 text-[11px] px-2 cursor-pointer text-muted-foreground hover:text-foreground"
                    title="Set all rows to max unpaid cycles"
                  >
                    All Max
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* Search Staged & Add Member Combobox */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-3">
            {/* Add Member Combobox */}
            <div className="relative">
              <div className="flex items-center border border-border bg-background px-2.5 h-8">
                <Plus className="w-3.5 h-3.5 text-primary shrink-0 mr-2" />
                <input
                  type="text"
                  placeholder="Search & add member by name/nickname..."
                  value={searchMemberQuery}
                  onChange={(e) => setSearchMemberQuery(e.target.value)}
                  disabled={isProcessing}
                  className="w-full bg-transparent text-xs text-foreground focus:outline-none font-mono"
                />
              </div>

              {/* Dropdown candidates */}
              {searchMemberQuery.trim() && candidateMembers.length > 0 && (
                <div className="absolute z-20 left-0 right-0 mt-1 max-h-56 overflow-y-auto bg-card border border-border shadow-xl">
                  {candidateMembers.map((m) => {
                    const unpaid = getMemberUnpaidEvents(m._id);
                    return (
                      <button
                        key={m._id}
                        type="button"
                        onClick={() => handleAddMember(m.userId)}
                        className="w-full px-3 py-2 text-left hover:bg-primary/10 flex items-center justify-between text-xs border-b border-border/40 last:border-none cursor-pointer transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-foreground">
                            {m.nickname || m.name}
                          </span>
                          {m.nickname && (
                            <span className="text-[10px] text-muted-foreground font-mono">
                              ({m.name})
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] font-mono text-amber-400 bg-amber-500/15 border border-amber-500/30 px-1.5 py-0.5">
                          {unpaid.length} unpaid cycle{unpaid.length > 1 ? "s" : ""}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Filter Staged Rows Search */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-2.5 top-2.5 shrink-0" />
              <input
                type="text"
                placeholder="Filter staged members..."
                value={searchStagedQuery}
                onChange={(e) => setSearchStagedQuery(e.target.value)}
                className="w-full h-8 pl-8 pr-3 bg-background border border-border text-xs text-foreground focus:outline-none font-mono"
              />
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {displayedStagedRows.length === 0 ? (
            <div className="py-16 text-center space-y-3">
              <div className="p-3 bg-primary/10 border border-primary/20 text-primary w-12 h-12 rounded-full mx-auto flex items-center justify-center">
                <Users className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-semibold text-foreground">No members staged yet</p>
                <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                  Click <span className="text-primary font-medium">"Quick-Add All Members with Unpaid Dues"</span> above, or search for a member to start staging.
                </p>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-border/80 bg-muted/30 text-[11px] font-mono text-muted-foreground uppercase tracking-wider">
                    <th className="py-2.5 px-4">Member</th>
                    <th className="py-2.5 px-3 text-center">Cycles to Pay</th>
                    <th className="py-2.5 px-3">Covered Period(s)</th>
                    <th className="py-2.5 px-3 text-right">Amount</th>
                    <th className="py-2.5 px-3">Ledger Memo</th>
                    <th className="py-2.5 px-3 text-center">Status</th>
                    <th className="py-2.5 px-3 text-center w-12">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40 font-mono">
                  {displayedStagedRows.map((row) => {
                    const isCompleted = row.status === "completed";
                    const isRowSigning = row.status === "signing";
                    const isRowError = row.status === "error";

                    return (
                      <tr
                        key={row.id}
                        className={`transition-colors ${
                          isCompleted
                            ? "bg-emerald-500/5 opacity-80"
                            : isRowError
                            ? "bg-destructive/10"
                            : "hover:bg-muted/20"
                        }`}
                      >
                        {/* Member Info */}
                        <td className="py-2.5 px-4 font-sans">
                          <div className="flex items-center gap-2">
                            <div>
                              <div className="font-semibold text-foreground flex items-center gap-1.5">
                                <span>{row.member?.nickname || row.member?.name || "Member"}</span>
                                {row.unpaidEvents.length > 0 && (
                                  <span className="text-[10px] font-mono text-amber-400 bg-amber-500/10 px-1 border border-amber-500/30">
                                    {row.unpaidEvents.length} due
                                  </span>
                                )}
                              </div>
                              {row.member?.nickname && (
                                <div className="text-[11px] text-muted-foreground font-mono">
                                  {row.member.name}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Cycles Stepper */}
                        <td className="py-2.5 px-3 text-center">
                          {isCompleted ? (
                            <span className="text-xs font-bold text-emerald-400">
                              {row.periodCount} cycle{row.periodCount > 1 ? "s" : ""}
                            </span>
                          ) : (
                            <div className="flex items-center justify-center gap-1">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                chamfer="dual"
                                disabled={isProcessing || row.periodCount <= 1}
                                onClick={() =>
                                  handleUpdatePeriodCount(
                                    row.id,
                                    row.periodCount - 1,
                                    row.unpaidEvents.length
                                  )
                                }
                                className="h-6 w-6 p-0 flex items-center justify-center cursor-pointer shrink-0 disabled:opacity-40"
                              >
                                <Minus className="w-3 h-3" />
                              </Button>

                              <span className="w-8 text-center font-bold text-sm text-primary">
                                {row.periodCount}
                              </span>

                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                chamfer="dual"
                                disabled={
                                  isProcessing || row.periodCount >= row.unpaidEvents.length
                                }
                                onClick={() =>
                                  handleUpdatePeriodCount(
                                    row.id,
                                    row.periodCount + 1,
                                    row.unpaidEvents.length
                                  )
                                }
                                className="h-6 w-6 p-0 flex items-center justify-center cursor-pointer shrink-0 disabled:opacity-40"
                              >
                                <Plus className="w-3 h-3" />
                              </Button>
                            </div>
                          )}
                        </td>

                        {/* Covered Cycles */}
                        <td className="py-2.5 px-3 text-[11px] text-muted-foreground">
                          {row.periodRange || "—"}
                        </td>

                        {/* Calculated Amount */}
                        <td className="py-2.5 px-3 text-right font-bold text-emerald-400">
                          {currentFund?.currency ?? "IDR"} {row.amount.toLocaleString("id-ID")}
                        </td>

                        {/* Memo Input */}
                        <td className="py-2.5 px-3 font-sans">
                          {isCompleted ? (
                            <span className="text-xs text-muted-foreground truncate block max-w-xs">
                              {row.effectiveMemo}
                            </span>
                          ) : (
                            <input
                              type="text"
                              value={row.customMemo}
                              placeholder={row.defaultMemo}
                              disabled={isProcessing}
                              onChange={(e) => {
                                const val = e.target.value;
                                setStagedItems((prev) =>
                                  prev.map((i) =>
                                    i.id === row.id ? { ...i, customMemo: val } : i
                                  )
                                );
                              }}
                              className="w-full h-7 px-2 bg-background border border-border text-xs text-foreground focus:outline-none focus:border-primary font-mono"
                            />
                          )}
                        </td>

                        {/* Status Column */}
                        <td className="py-2.5 px-3 text-center">
                          {isCompleted ? (
                            <div className="inline-flex items-center gap-1 text-emerald-400 text-[11px] font-semibold">
                              <CheckCheck className="w-3.5 h-3.5" />
                              {row.entryId && onInspectEntry ? (
                                <button
                                  type="button"
                                  onClick={() => onInspectEntry(row.entryId!)}
                                  className="underline hover:text-emerald-300 cursor-pointer"
                                >
                                  Recorded
                                </button>
                              ) : (
                                <span>Recorded</span>
                              )}
                            </div>
                          ) : isRowSigning ? (
                            <div className="inline-flex items-center gap-1 text-primary text-[11px] font-semibold animate-pulse">
                              <Sparkles className="w-3.5 h-3.5 animate-spin" />
                              <span>Signing...</span>
                            </div>
                          ) : isRowError ? (
                            <div
                              className="inline-flex items-center gap-1 text-destructive text-[11px] font-semibold"
                              title={row.errorMessage}
                            >
                              <AlertTriangle className="w-3.5 h-3.5" />
                              <span>Failed</span>
                            </div>
                          ) : (
                            <Badge variant="outline" className="text-[10px] text-muted-foreground border-border/80">
                              Staged
                            </Badge>
                          )}
                        </td>

                        {/* Action Column */}
                        <td className="py-2.5 px-3 text-center">
                          {!isCompleted && !isRowSigning && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              chamfer="dual"
                              disabled={isProcessing}
                              onClick={() => handleRemoveRow(row.id)}
                              className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive cursor-pointer"
                              title="Remove from batch"
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Batch Signing Control & Sticky Bottom Bar */}
          <div className="p-4 border-t border-border bg-card/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="text-xs font-semibold text-foreground flex items-center gap-2">
                <span>Batch Total:</span>
                <span className="font-mono text-emerald-400 text-sm font-bold">
                  {currentFund?.currency ?? "IDR"} {totalBatchAmount.toLocaleString("id-ID")}
                </span>
                <span className="text-muted-foreground font-mono text-[11px]">
                  ({pendingRows.length} member{pendingRows.length === 1 ? "" : "s"} • {totalBatchCycles} cycle{totalBatchCycles === 1 ? "" : "s"})
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground font-mono">
                {isProcessing
                  ? `Committing sequential blocks: ${batchProgress.current} / ${batchProgress.total} completed...`
                  : "All transactions are cryptographically signed sequentially using your local browser key."}
              </p>
            </div>

            <div className="flex items-center gap-3">
              <Button
                type="button"
                variant="cyber"
                chamfer="dual"
                size="sm"
                disabled={isSubmitDisabled}
                onPointerDown={startHold}
                onPointerUp={stopHold}
                onPointerLeave={stopHold}
                onPointerCancel={stopHold}
                onContextMenu={(e) => e.preventDefault()}
                className={`relative overflow-hidden text-xs flex items-center justify-center gap-1.5 cursor-pointer select-none px-6 py-2.5 min-w-[260px] transition-all ${
                  isHolding ? "border-emerald-400/80 shadow-[0_0_20px_rgba(52,211,153,0.35)]" : ""
                }`}
              >
                {/* Hold Progress Fill */}
                {isHolding && (
                  <div
                    className="absolute inset-0 bg-emerald-500/35 pointer-events-none transition-none"
                    style={{
                      width: `${Math.min(100, holdProgress * 100)}%`,
                    }}
                  />
                )}

                <span className="relative z-10 flex items-center gap-1.5 font-mono font-bold">
                  {isProcessing ? (
                    <>
                      <Sparkles className="w-3.5 h-3.5 animate-spin text-emerald-400" />
                      <span>
                        Processing {batchProgress.current + 1} of {batchProgress.total}...
                      </span>
                    </>
                  ) : isHolding ? (
                    <>
                      <Lock className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
                      <span>
                        Hold to Commit: {((HOLD_DURATION_MS * (1 - holdProgress)) / 1000).toFixed(1)}s
                      </span>
                    </>
                  ) : (
                    <>
                      <Lock className="w-3.5 h-3.5" />
                      <span>
                        Hold to Sign Batch ({currentFund?.currency ?? "IDR"} {totalBatchAmount.toLocaleString("id-ID")})
                      </span>
                    </>
                  )}
                </span>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
