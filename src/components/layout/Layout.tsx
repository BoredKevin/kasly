import { ReactNode } from "react";
import { ConstellationsBackground } from "@boredkevin/ui";
import { Header } from "./Header";

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  return (
    <div className="relative min-h-screen bg-background text-foreground flex flex-col">
      <ConstellationsBackground
        particleCount={35}
        interactive
        lineOpacity={0.15}
        starSize={1.5}
      />
      <Header />
      <main className="p-8 flex flex-col gap-16 relative z-10 w-full max-w-4xl mx-auto flex-1">
        <h1 className="text-4xl font-bold text-center tracking-tight">
          Convex + React + Convex Auth
        </h1>
        {children}
      </main>
    </div>
  );
}
