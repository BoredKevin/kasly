import { Component, ReactNode, ErrorInfo } from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Button,
} from "@boredkevin/ui";
import { ShieldAlert, RefreshCw } from "lucide-react";

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

function checkIntegrityError(err: Error | null): boolean {
  if (!err) return false;
  return (
    err.message.includes("Ledger integrity failure") ||
    err.message.includes("hash mismatch") ||
    err.message.includes("tampered") ||
    err.message.includes("frozen")
  );
}

export class TreasuryErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Treasury Error caught by boundary:", error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      const isTampered = checkIntegrityError(this.state.error);

      return (
        <Card telemetry="TREASURY.INTEGRITY_ALERT" cornerLines className="bg-destructive/10 border-destructive/50 shadow-2xl animate-in fade-in duration-200">
          <CardHeader className="pb-4 border-b border-destructive/30">
            <div className="flex items-center gap-2.5 text-destructive-foreground">
              <div className="p-2 bg-destructive/20 border border-destructive/40 text-destructive-foreground">
                <ShieldAlert className="w-6 h-6 animate-pulse text-red-400" />
              </div>
              <div>
                <CardTitle className="text-base font-bold text-red-400">
                  {isTampered
                    ? "🚨 CRITICAL: Ledger Tamper Detected — Chain Frozen"
                    : this.props.fallbackTitle || "Treasury Operation Error"}
                </CardTitle>
                <CardDescription className="text-xs text-red-300/80">
                  {isTampered
                    ? "Cryptographic verification failed during ledger replay. Access to this fund is locked."
                    : "An unexpected error occurred while loading treasury data."}
                </CardDescription>
              </div>
            </div>
          </CardHeader>

          <CardContent className="pt-5 space-y-4">
            <div className="p-3 bg-black/40 border border-destructive/40 space-y-1.5 font-mono text-xs text-red-300">
              <p className="font-bold uppercase tracking-wider text-[10px] text-red-400">
                Integrity Diagnostic Log
              </p>
              <p className="leading-relaxed break-words">
                {this.state.error?.message || "Cryptographic hash mismatch detected in ledger history."}
              </p>
            </div>

            {isTampered && (
              <div className="p-3 bg-muted/20 border border-border/60 text-xs text-muted-foreground space-y-1">
                <p className="font-semibold text-foreground font-mono text-[11px] uppercase">
                  Security Protocol Active
                </p>
                <p className="text-[11px] leading-relaxed">
                  The ledger detected that an entry was modified or inserted without a valid cryptographic signature matching the hash chain. All subsequent commits and balance replays are prohibited.
                </p>
              </div>
            )}

            <div className="pt-2 flex items-center justify-end">
              <Button
                type="button"
                variant="outline"
                size="sm"
                chamfer="dual"
                onClick={this.handleRetry}
                className="text-xs flex items-center gap-1.5 cursor-pointer border-destructive/40 text-red-300 hover:bg-destructive/20"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Retry Verification</span>
              </Button>
            </div>
          </CardContent>
        </Card>
      );
    }

    return this.props.children;
  }
}
