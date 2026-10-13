import { Id } from "../../../../../convex/_generated/dataModel";
import {
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Button,
  Badge,
} from "@boredkevin/ui";
import { Panel } from "../../../../ui";
import { Landmark, Plus, Archive, ArchiveRestore } from "lucide-react";

export interface FundItem {
  _id: Id<"funds">;
  _creationTime: number;
  name: string;
  currency: string;
  description?: string;
  isArchived: boolean;
}

export interface FundManagementSectionProps {
  funds: FundItem[] | undefined;
  processingId: string | null;
  onOpenCreateFund: () => void;
  onArchiveFund: (fundId: Id<"funds">) => Promise<void>;
  onUnarchiveFund: (fundId: Id<"funds">) => Promise<void>;
}

export function FundManagementSection({
  funds,
  processingId,
  onOpenCreateFund,
  onArchiveFund,
  onUnarchiveFund,
}: FundManagementSectionProps) {
  return (
    <Panel className="shadow-lg">
      <CardHeader className="pb-4 border-b border-border/80">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-primary/10 border border-primary/20 text-primary">
              <Landmark className="w-5 h-5" />
            </div>
            <div>
              <CardTitle className="text-base font-semibold">
                Fund Management
              </CardTitle>
              <CardDescription className="text-xs">
                Create, configure, and archive organization treasury fund accounts
              </CardDescription>
            </div>
          </div>

          <Button
            type="button"
            variant="cyber"
            size="sm"
            chamfer="none"
            onClick={onOpenCreateFund}
            className="text-xs flex items-center gap-1.5 cursor-pointer self-start sm:self-auto"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Create New Fund</span>
          </Button>
        </div>
      </CardHeader>

      <CardContent className="pt-6 pb-6">
        {funds === undefined ? (
          <div className="py-8 text-center text-xs font-mono text-muted-foreground animate-pulse">
            Loading funds...
          </div>
        ) : funds.length === 0 ? (
          <div className="py-6 text-center space-y-1.5">
            <Landmark className="w-6 h-6 text-muted-foreground mx-auto opacity-60" />
            <p className="text-xs font-mono text-muted-foreground">
              No treasury funds found. Click &quot;Create New Fund&quot; to establish the first fund.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {funds.map((fund) => {
              return (
                <div
                  key={fund._id}
                  className={`p-4 border transition-all space-y-3 ${
                    fund.isArchived
                      ? "bg-muted/10 border-border/40 opacity-70"
                      : "bg-background border-border/80 hover:border-border shadow-sm"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="p-1 bg-primary/10 border border-primary/20 text-primary">
                        <Landmark className="w-3.5 h-3.5" />
                      </div>
                      <span className="text-xs font-bold text-foreground">
                        {fund.name}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <Badge
                        variant="outline"
                        className="text-[10px] font-mono px-1.5 py-0.5 border-primary/40 text-primary bg-primary/10 font-bold"
                      >
                        {fund.currency}
                      </Badge>
                      {fund.isArchived && (
                        <Badge
                          variant="secondary"
                          className="text-[10px] font-mono px-1.5 py-0.5 border-amber-500/40 text-amber-400 bg-amber-500/10 font-bold"
                        >
                          ARCHIVED
                        </Badge>
                      )}
                    </div>
                  </div>

                  <p className="text-xs text-muted-foreground">
                    {fund.description || "No description provided."}
                  </p>

                  <div className="pt-2 flex items-center justify-between border-t border-border/40 text-[10px] font-mono text-muted-foreground">
                    <span>Created: {new Date(fund._creationTime).toLocaleDateString()}</span>

                    {fund.isArchived ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        chamfer="none"
                        disabled={processingId === fund._id}
                        onClick={() => {
                          void onUnarchiveFund(fund._id);
                        }}
                        className="h-6 text-[10px] px-2 text-primary hover:bg-primary/15 cursor-pointer"
                      >
                        <ArchiveRestore className="w-3.5 h-3.5 mr-1" />
                        <span>Unarchive</span>
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        chamfer="none"
                        disabled={processingId === fund._id}
                        onClick={() => {
                          void onArchiveFund(fund._id);
                        }}
                        className="h-6 text-[10px] px-2 text-amber-400 hover:bg-amber-500/15 hover:border-amber-500/40 cursor-pointer"
                      >
                        <Archive className="w-3.5 h-3.5 mr-1" />
                        <span>Archive</span>
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Panel>
  );
}
