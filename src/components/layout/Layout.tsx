import { ReactNode, useState } from "react";
import { Authenticated } from "convex/react";
import { Footer } from "./Footer";
import { NavDrawerProvider } from "./NavDrawerContext";
import { ActiveWorkspaceProvider } from "../../contexts";
import { TopBar, BottomTabs, MoreSheet } from "../../shell";

export type OrgTab = "overview" | "roles" | "invites" | "members";
export type TreasuryTab = "overview" | "ledger" | "dues" | "invoices" | "keys" | "admin" | "bulk-dues";

interface LayoutProps {
  children: ReactNode;
}

function LayoutInner({ children }: LayoutProps) {
  const [isMoreOpen, setIsMoreOpen] = useState(false);

  return (
    <div className="relative min-h-screen bg-background text-foreground flex flex-col selection:bg-primary/20">
      <TopBar />

      <main className="p-4 sm:p-6 md:p-8 flex flex-col gap-6 relative z-10 w-full max-w-6xl mx-auto flex-1 pb-32 md:pb-12">
        {children}
      </main>

      <Authenticated>
        <BottomTabs onOpenMore={() => setIsMoreOpen(true)} isMoreOpen={isMoreOpen} />
        <MoreSheet isOpen={isMoreOpen} onClose={() => setIsMoreOpen(false)} />
      </Authenticated>

      <Footer />
    </div>
  );
}

export function Layout(props: LayoutProps) {
  return (
    <ActiveWorkspaceProvider>
      <NavDrawerProvider>
        <LayoutInner {...props} />
      </NavDrawerProvider>
    </ActiveWorkspaceProvider>
  );
}
