import { useMutation, useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Button } from "@boredkevin/ui";
import { ResourcesGrid } from "../../resources";

export function NumberGenerator() {
  const { viewer, numbers } =
    useQuery(api.myFunctions.listNumbers, {
      count: 10,
    }) ?? {};
  const addNumber = useMutation(api.myFunctions.addNumber);

  if (viewer === undefined || numbers === undefined) {
    return (
      <div className="mx-auto">
        <p>loading... (consider a loading skeleton)</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8 max-w-lg mx-auto w-full">
      <p>Welcome {viewer ?? "Anonymous"}!</p>
      <p>
        Click the button below and open this page in another window - this data
        is persisted in the Convex cloud database!
      </p>
      <p>
        <Button
          variant="cyber"
          chamfer="dual"
          className="text-sm px-4 py-2"
          onClick={() => {
            void addNumber({ value: Math.floor(Math.random() * 10) });
          }}
        >
          Add a random number
        </Button>
      </p>
      <p>
        Numbers:{" "}
        {numbers?.length === 0
          ? "Click the button!"
          : (numbers?.join(", ") ?? "...")}
      </p>
      <p>
        Edit{" "}
        <code className="text-sm font-bold font-mono bg-muted px-1 py-0.5 rounded-none border border-border">
          convex/myFunctions.ts
        </code>{" "}
        to change your backend
      </p>
      <p>
        Edit{" "}
        <code className="text-sm font-bold font-mono bg-muted px-1 py-0.5 rounded-none border border-border">
          src/App.tsx
        </code>{" "}
        to change your frontend
      </p>
      <ResourcesGrid />
    </div>
  );
}
