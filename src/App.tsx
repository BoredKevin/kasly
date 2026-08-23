import { Authenticated, Unauthenticated } from "convex/react";
import { Route, Switch, Redirect } from "wouter";
import { Layout } from "./components/layout";
import { SignInForm } from "./features/auth";
import { UserProfileView, OrganizationView } from "./features/profile";

export default function App() {
  return (
    <Layout>
      <Authenticated>
        <Switch>
          <Route path="/">
            <Redirect to="/profile" />
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
          <Route>
            <Redirect to="/profile" />
          </Route>
        </Switch>
      </Authenticated>

      <Unauthenticated>
        <div className="space-y-8 max-w-sm mx-auto w-full">
          <div className="text-center space-y-2">
            <h1 className="text-3xl font-bold tracking-tight text-foreground">
              Kasly Platform
            </h1>
            <p className="text-xs text-muted-foreground">
              RBAC & Organization Management Platform
            </p>
          </div>
          <SignInForm />
        </div>
      </Unauthenticated>
    </Layout>
  );
}

