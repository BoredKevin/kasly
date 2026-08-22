import { SignOutButton } from "../../features/auth";

export function Header() {
  return (
    <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-md p-4 border-b border-border flex justify-between items-center">
      <div className="font-semibold text-foreground tracking-tight">
        Convex + React + Convex Auth
      </div>
      <SignOutButton />
    </header>
  );
}
