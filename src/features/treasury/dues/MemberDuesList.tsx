import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { DuesMemberItem, DuesEventItem, DuesCellItem } from "../types/dues";
import { FilterBar } from "../../../ui/FilterBar";
import { StatusPill } from "../../../ui/StatusPill";
import { EmptyState } from "../../../ui/EmptyState";
import { Users, ChevronRight, Receipt } from "lucide-react";
import { useFormat } from "../../../hooks/useFormat";
import { Id } from "../../../../convex/_generated/dataModel";

interface MemberDuesListProps {
  members: DuesMemberItem[];
  events: DuesEventItem[];
  cellMap: Map<string, DuesCellItem>;
  currency?: string;
  canManage?: boolean;
  onSelectMember: (member: DuesMemberItem) => void;
  onOpenCreateInvoice?: (prefill: { userId: Id<"users">; periodCount: number }) => void;
}

export function MemberDuesList({
  members,
  events,
  cellMap,
  currency = "IDR",
  canManage = false,
  onSelectMember,
  onOpenCreateInvoice,
}: MemberDuesListProps) {
  const { t } = useTranslation();
  const { money: formatMoney } = useFormat();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const filterOptions = [
    {
      key: "all",
      label: `${t("common.all", "All")} (${members.length})`,
    },
    {
      key: "has_unpaid",
      label: `${t("treasury.dues.unpaid", "Unpaid")} (${members.filter((m) => m.unpaidPeriodsCount > 0).length})`,
    },
    {
      key: "fully_paid",
      label: `${t("treasury.dues.paid", "Paid up")} (${members.filter((m) => m.unpaidPeriodsCount === 0).length})`,
    },
  ];

  const filteredMembers = useMemo(() => {
    return members.filter((member) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        member.name.toLowerCase().includes(q) ||
        (member.nickname && member.nickname.toLowerCase().includes(q)) ||
        (member.email && member.email.toLowerCase().includes(q));

      if (!matchesSearch) return false;

      if (statusFilter === "has_unpaid") return member.unpaidPeriodsCount > 0;
      if (statusFilter === "fully_paid") return member.unpaidPeriodsCount === 0;
      return true;
    });
  }, [members, searchQuery, statusFilter]);

  // Compute total unpaid money for a specific member
  const getMemberUnpaidTotal = (member: DuesMemberItem) => {
    let sum = 0;
    for (const event of events) {
      const cell = cellMap.get(`${member._id}_${event._id}`);
      if (cell && !cell.hasPaid && !cell.isWaived) {
        sum += event.amount;
      }
    }
    return sum;
  };

  return (
    <div className="space-y-4">
      {/* Search and Filter Chips */}
      <FilterBar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder={t("organization.searchMembers", "Search members by name or handle...")}
        filters={filterOptions}
        activeFilter={statusFilter}
        onFilterChange={setStatusFilter}
      />

      {/* Members List */}
      {filteredMembers.length === 0 ? (
        <EmptyState
          icon={<Users className="w-8 h-8" />}
          title={t("organization.noMembers", "No members found")}
          description={
            searchQuery
              ? t("organization.noMembersMatching", "No members match your search criteria.")
              : t("organization.emptyMembersList", "No organization members registered yet.")
          }
        />
      ) : (
        <div className="divide-y divide-border/60 border border-border/80 rounded-[var(--fintech-radius-md)] bg-card overflow-hidden">
          {filteredMembers.map((member) => {
            const hasUnpaid = member.unpaidPeriodsCount > 0;
            const unpaidAmount = hasUnpaid ? getMemberUnpaidTotal(member) : 0;

            return (
              <div
                key={member._id}
                onClick={() => onSelectMember(member)}
                className="p-3.5 hover:bg-muted/30 transition-colors flex items-center justify-between gap-3 cursor-pointer group"
              >
                {/* Member Avatar & Details */}
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-bold text-xs shrink-0 overflow-hidden">
                    {member.image ? (
                      <img src={member.image} alt={member.name} className="w-full h-full object-cover" />
                    ) : (
                      <span>{(member.nickname || member.name).charAt(0).toUpperCase()}</span>
                    )}
                  </div>
                  <div className="min-w-0 space-y-0.5">
                    <p className="font-semibold text-xs text-foreground truncate group-hover:text-primary transition-colors">
                      {member.nickname || member.name}
                    </p>
                    <p className="text-[11px] text-muted-foreground truncate">
                      {member.nickname ? member.name : member.email || ""}
                    </p>
                  </div>
                </div>

                {/* Status & Quick Actions */}
                <div className="flex items-center gap-2 shrink-0">
                  {hasUnpaid ? (
                    <StatusPill tone="warning">
                      {formatMoney(unpaidAmount, currency)}
                    </StatusPill>
                  ) : (
                    <StatusPill tone="success">
                      ✓ {t("treasury.dues.paid", "Paid up")}
                    </StatusPill>
                  )}

                  {canManage && hasUnpaid && onOpenCreateInvoice && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenCreateInvoice({
                          userId: member.userId,
                          periodCount: member.unpaidPeriodsCount,
                        });
                      }}
                      className="p-1.5 rounded-[var(--fintech-radius-sm)] text-amber-300 hover:text-amber-200 hover:bg-amber-500/15 border border-amber-500/30 transition-colors cursor-pointer"
                      title={t("treasury.invoices.createDuesBtn", "Create Invoice")}
                      aria-label={t("treasury.invoices.createDuesBtn", "Create Invoice")}
                    >
                      <Receipt className="w-3.5 h-3.5" />
                    </button>
                  )}

                  <ChevronRight className="w-4 h-4 text-muted-foreground/60 group-hover:text-foreground group-hover:translate-x-0.5 transition-all" />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
