import { Button } from "@heroui/react";
import { useQuery } from "@tanstack/react-query";
import { healthOptions } from "./client/@tanstack/react-query.gen";

export function App() {
  const health = useQuery({ ...healthOptions(), retry: false });

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4">
      <h1 className="text-3xl font-semibold">Life OS</h1>
      <p role="status">{statusMessage(health.isPending, health.isError)}</p>
      <Button
        variant="secondary"
        isPending={health.isFetching}
        onPress={() => void health.refetch()}
      >
        Check again
      </Button>
    </main>
  );
}

function statusMessage(isPending: boolean, isError: boolean): string {
  if (isPending) {
    return "Checking the API…";
  }
  return isError ? "API unreachable" : "API connected";
}
