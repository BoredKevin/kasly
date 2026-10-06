import { useEffect } from "react";
import { useConvexAuth } from "convex/react";
import { Route, Switch, Redirect, useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { Layout } from "./components/layout";
import {
  SignInForm,
  ClaimRegistrationView,
  ResetPasswordPage,
  getSafeRedirectUrl,
} from "./features/auth";
import { UserProfileView, OrganizationView } from "./features/profile";
import {
  TreasuryView,
  TreasuryErrorBoundary,
  SharedEntryPage,
  InvoicePaymentPage,
} from "./features/treasury";
import { ConstellationsBackground } from "@boredkevin/ui";

const RESERVED_ROOT_PATHS = new Set([
  "",
  "profile",
  "organization",
  "treasury",
  "claim",
  "register",
  "reset-password",
  "login",
  "auth",
  "api",
  "settings",
  "docs",
  "invoice",
]);

function FullScreenLoading() {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center p-4">
      <div className="w-10 h-10 rounded-[var(--fintech-radius-sm)] bg-primary/10 border border-primary/30 flex items-center justify-center text-primary font-bold font-mono text-base animate-pulse">
        K
      </div>
    </div>
  );
}

function UnauthenticatedEntryView({ identifier }: { identifier: string }) {
  return (
    <div className="relative min-h-screen bg-background text-foreground flex items-center justify-center p-4 selection:bg-primary/20">
      <ConstellationsBackground
        particleCount={30}
        lineOpacity={0.12}
        starSize={1.5}
      />
      <div className="relative z-10 w-full max-w-xl">
        <SharedEntryPage identifier={identifier} isAuthenticated={false} />
      </div>
    </div>
  );
}

function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const [location] = useLocation();

  if (isLoading) {
    return <FullScreenLoading />;
  }

  if (!isAuthenticated) {
    const search = typeof window !== "undefined" ? window.location.search : "";
    const currentPath = `${location}${search}`;
    const target = `/login?redirectTo=${encodeURIComponent(currentPath)}`;
    return <Redirect to={target} replace />;
  }

  return <Layout>{children}</Layout>;
}

function LoginPage() {
  const { t } = useTranslation();
  const { isAuthenticated, isLoading } = useConvexAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      const target = getSafeRedirectUrl(
        typeof window !== "undefined" ? window.location.search : ""
      );
      setLocation(target, { replace: true });
    }
  }, [isLoading, isAuthenticated, setLocation]);

  if (isLoading) {
    return <FullScreenLoading />;
  }

  if (isAuthenticated) {
    const target = getSafeRedirectUrl(
      typeof window !== "undefined" ? window.location.search : ""
    );
    return <Redirect to={target} replace />;
  }

  const handleSuccess = () => {
    const target = getSafeRedirectUrl(
      typeof window !== "undefined" ? window.location.search : ""
    );
    setLocation(target, { replace: true });
  };

  return (
    <Layout>
      <div className="space-y-8 max-w-sm mx-auto w-full">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            {t("auth.welcomeTitle")}
          </h1>
          <p className="text-xs text-muted-foreground">
            {t("auth.welcomeSubtitle")}
          </p>
        </div>
        <SignInForm onSuccess={handleSuccess} />
      </div>
    </Layout>
  );
}

function RootRoute() {
  const { isAuthenticated, isLoading } = useConvexAuth();

  if (isLoading) {
    return <FullScreenLoading />;
  }

  if (isAuthenticated) {
    return <Redirect to="/treasury" replace />;
  }

  return <Redirect to="/login" replace />;
}

function TransactionRoute({ hash }: { hash: string }) {
  const { isAuthenticated, isLoading } = useConvexAuth();

  if (isLoading) {
    return <FullScreenLoading />;
  }

  if (isAuthenticated) {
    return (
      <Layout>
        <TreasuryErrorBoundary>
          <TreasuryView activeTab="entry" entryIdentifier={hash} />
        </TreasuryErrorBoundary>
      </Layout>
    );
  }

  return <UnauthenticatedEntryView identifier={hash} />;
}

function IdentifierRoute({ identifier }: { identifier: string }) {
  const lower = identifier.toLowerCase();
  const { isAuthenticated, isLoading } = useConvexAuth();

  if (isLoading) {
    return <FullScreenLoading />;
  }

  if (lower === "login") {
    return <Redirect to="/login" replace />;
  }

  if (lower === "claim" || lower === "register") {
    return <Redirect to={`/${lower}`} replace />;
  }

  if (lower === "reset-password") {
    return <Redirect to="/reset-password" replace />;
  }

  if (RESERVED_ROOT_PATHS.has(lower)) {
    if (isAuthenticated) {
      return <Redirect to={`/${lower}`} replace />;
    }
    return (
      <Redirect
        to={`/login?redirectTo=${encodeURIComponent(`/${lower}`)}`}
        replace
      />
    );
  }

  if (isAuthenticated) {
    return (
      <Layout>
        <TreasuryErrorBoundary>
          <TreasuryView activeTab="entry" entryIdentifier={identifier} />
        </TreasuryErrorBoundary>
      </Layout>
    );
  }

  return <UnauthenticatedEntryView identifier={identifier} />;
}

function FallbackRoute() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const [location] = useLocation();

  if (isLoading) {
    return <FullScreenLoading />;
  }

  if (isAuthenticated) {
    return <Redirect to="/treasury" replace />;
  }

  const search = typeof window !== "undefined" ? window.location.search : "";
  const currentPath = `${location}${search}`;
  return (
    <Redirect
      to={`/login?redirectTo=${encodeURIComponent(currentPath)}`}
      replace
    />
  );
}

export default function App() {
  const { t } = useTranslation();

  return (
    <Switch>
      {/* Isolated Standalone Invoice Checkout & Payment Routes (No Workspace Layout contamination) */}
      <Route path="/invoice/:invoiceNumber/pay">
        {(params) => (
          <InvoicePaymentPage
            invoiceNumber={params.invoiceNumber}
            initialView="payment"
          />
        )}
      </Route>
      <Route path="/invoice/:invoiceNumber">
        {(params) => <InvoicePaymentPage invoiceNumber={params.invoiceNumber} />}
      </Route>

      {/* Root Route: Redirects to /treasury if logged in, /login if not logged in */}
      <Route path="/">
        <RootRoute />
      </Route>

      {/* Public Authentication & Registration Routes */}
      <Route path="/login">
        <LoginPage />
      </Route>

      <Route path="/claim">
        <Layout>
          <ClaimRegistrationView />
        </Layout>
      </Route>

      <Route path="/register">
        <Layout>
          <ClaimRegistrationView />
        </Layout>
      </Route>

      <Route path="/reset-password">
        <Layout>
          <div className="space-y-8 max-w-sm mx-auto w-full">
            <div className="text-center space-y-2">
              <h1 className="text-3xl font-bold tracking-tight text-foreground">
                {t("auth.welcomeTitle")}
              </h1>
              <p className="text-xs text-muted-foreground">
                {t("auth.welcomeSubtitle")}
              </p>
            </div>
            <ResetPasswordPage />
          </div>
        </Layout>
      </Route>

      {/* Canonical Transaction URL (Auth-aware: in workspace if logged in, standalone card if not) */}
      <Route path="/tx/:hash">
        {(params) => <TransactionRoute hash={params.hash} />}
      </Route>

      {/* Protected Profile & Organization Workspace Routes */}
      <Route path="/profile">
        <ProtectedLayout>
          <UserProfileView />
        </ProtectedLayout>
      </Route>
      <Route path="/organization">
        <ProtectedLayout>
          <OrganizationView />
        </ProtectedLayout>
      </Route>
      <Route path="/organization/roles">
        <ProtectedLayout>
          <OrganizationView />
        </ProtectedLayout>
      </Route>
      <Route path="/organization/invites">
        <ProtectedLayout>
          <OrganizationView />
        </ProtectedLayout>
      </Route>
      <Route path="/organization/members">
        <ProtectedLayout>
          <OrganizationView />
        </ProtectedLayout>
      </Route>

      {/* Protected Treasury Workspace Routes */}
      <Route path="/treasury">
        <ProtectedLayout>
          <TreasuryErrorBoundary>
            <TreasuryView />
          </TreasuryErrorBoundary>
        </ProtectedLayout>
      </Route>
      <Route path="/treasury/ledger">
        <ProtectedLayout>
          <TreasuryErrorBoundary>
            <TreasuryView />
          </TreasuryErrorBoundary>
        </ProtectedLayout>
      </Route>
      <Route path="/treasury/dues">
        <ProtectedLayout>
          <TreasuryErrorBoundary>
            <TreasuryView />
          </TreasuryErrorBoundary>
        </ProtectedLayout>
      </Route>
      <Route path="/treasury/bulk-dues">
        <ProtectedLayout>
          <TreasuryErrorBoundary>
            <TreasuryView />
          </TreasuryErrorBoundary>
        </ProtectedLayout>
      </Route>
      <Route path="/treasury/dues/bulk">
        <ProtectedLayout>
          <TreasuryErrorBoundary>
            <TreasuryView />
          </TreasuryErrorBoundary>
        </ProtectedLayout>
      </Route>
      <Route path="/treasury/keys">
        <ProtectedLayout>
          <TreasuryErrorBoundary>
            <TreasuryView />
          </TreasuryErrorBoundary>
        </ProtectedLayout>
      </Route>
      <Route path="/treasury/admin">
        <ProtectedLayout>
          <TreasuryErrorBoundary>
            <TreasuryView />
          </TreasuryErrorBoundary>
        </ProtectedLayout>
      </Route>
      <Route path="/treasury/invoices">
        <ProtectedLayout>
          <TreasuryErrorBoundary>
            <TreasuryView />
          </TreasuryErrorBoundary>
        </ProtectedLayout>
      </Route>

      {/* Root Short URL / Identifier */}
      <Route path="/:identifier">
        {(params) => <IdentifierRoute identifier={params.identifier} />}
      </Route>

      {/* Fallback Unmatched Route */}
      <Route>
        <FallbackRoute />
      </Route>
    </Switch>
  );
}
