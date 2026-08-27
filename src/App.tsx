import { Authenticated, Unauthenticated } from "convex/react";
import { Route, Switch, Redirect } from "wouter";
import { useTranslation } from "react-i18next";
import { Layout } from "./components/layout";
import { SignInForm, ClaimRegistrationView } from "./features/auth";
import { UserProfileView, OrganizationView } from "./features/profile";
import {
  TreasuryView,
  TreasuryErrorBoundary,
  SharedEntryPage,
} from "./features/treasury";
import { ConstellationsBackground } from "@boredkevin/ui";

const RESERVED_ROOT_PATHS = new Set([
  "",
  "profile",
  "organization",
  "treasury",
  "claim",
  "register",
  "login",
  "auth",
  "api",
  "settings",
  "docs",
]);

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

export default function App() {
  const { t } = useTranslation();

  return (
    <>
      {/* Authenticated Workspace Flow (With Navbar & Treasury Sidebar) */}
      <Authenticated>
        <Layout>
          <Switch>
            <Route path="/">
              <Redirect to="/profile" />
            </Route>
            <Route path="/claim">
              <ClaimRegistrationView />
            </Route>
            <Route path="/register">
              <ClaimRegistrationView />
            </Route>
            <Route path="/profile">
              <UserProfileView />
            </Route>
            <Route path="/organization">
              <OrganizationView />
            </Route>
            <Route path="/organization/roles">
              <OrganizationView />
            </Route>
            <Route path="/organization/invites">
              <OrganizationView />
            </Route>
            <Route path="/organization/members">
              <OrganizationView />
            </Route>
            <Route path="/treasury">
              <TreasuryErrorBoundary>
                <TreasuryView />
              </TreasuryErrorBoundary>
            </Route>
            <Route path="/treasury/ledger">
              <TreasuryErrorBoundary>
                <TreasuryView />
              </TreasuryErrorBoundary>
            </Route>
            <Route path="/treasury/dues">
              <TreasuryErrorBoundary>
                <TreasuryView />
              </TreasuryErrorBoundary>
            </Route>
            <Route path="/treasury/keys">
              <TreasuryErrorBoundary>
                <TreasuryView />
              </TreasuryErrorBoundary>
            </Route>
            <Route path="/treasury/admin">
              <TreasuryErrorBoundary>
                <TreasuryView />
              </TreasuryErrorBoundary>
            </Route>
            {/* Canonical Transaction URL inside Workspace */}
            <Route path="/tx/:hash">
              {(params) => (
                <TreasuryErrorBoundary>
                  <TreasuryView activeTab="entry" entryIdentifier={params.hash} />
                </TreasuryErrorBoundary>
              )}
            </Route>
            {/* Root Short URL inside Workspace */}
            <Route path="/:identifier">
              {(params) => {
                if (RESERVED_ROOT_PATHS.has(params.identifier.toLowerCase())) {
                  return <Redirect to="/profile" />;
                }
                return (
                  <TreasuryErrorBoundary>
                    <TreasuryView
                      activeTab="entry"
                      entryIdentifier={params.identifier}
                    />
                  </TreasuryErrorBoundary>
                );
              }}
            </Route>
            <Route>
              <Redirect to="/profile" />
            </Route>
          </Switch>
        </Layout>
      </Authenticated>

      {/* Unauthenticated Flow (Centered Entry Card, No Navbar / Sidebar) */}
      <Unauthenticated>
        <Switch>
          {/* Canonical Transaction URL (Centered, No Navbar/Sidebar) */}
          <Route path="/tx/:hash">
            {(params) => <UnauthenticatedEntryView identifier={params.hash} />}
          </Route>

          {/* Root Short URL or Fallback (Centered, No Navbar/Sidebar) */}
          <Route path="/:identifier">
            {(params) => {
              if (
                params.identifier === "claim" ||
                params.identifier === "register"
              ) {
                return (
                  <Layout>
                    <ClaimRegistrationView />
                  </Layout>
                );
              }
              if (RESERVED_ROOT_PATHS.has(params.identifier.toLowerCase())) {
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
                      <SignInForm />
                    </div>
                  </Layout>
                );
              }
              return (
                <UnauthenticatedEntryView identifier={params.identifier} />
              );
            }}
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
          <Route>
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
                <SignInForm />
              </div>
            </Layout>
          </Route>
        </Switch>
      </Unauthenticated>
    </>
  );
}
