"use client";

import { Authenticated, Unauthenticated } from "convex/react";
import { Layout } from "./components/layout";
import { SignInForm } from "./features/auth";
import { NumberGenerator } from "./features/numbers";

export default function App() {
  return (
    <Layout>
      <Authenticated>
        <NumberGenerator />
      </Authenticated>
      <Unauthenticated>
        <SignInForm />
      </Unauthenticated>
    </Layout>
  );
}
