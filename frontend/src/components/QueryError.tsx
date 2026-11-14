import { Alert, Button } from "@heroui/react";
import { errorMessage } from "../errors";

type QueryErrorProps = {
  error: unknown;
  /** Shows a "Try again" button when given. */
  onRetry?: () => unknown;
};

export function QueryError({ error, onRetry }: QueryErrorProps) {
  return (
    <div className="flex flex-col items-start gap-3">
      <Alert status="danger">
        <Alert.Indicator />
        <Alert.Content>
          <Alert.Description>{errorMessage(error)}</Alert.Description>
        </Alert.Content>
      </Alert>
      {onRetry && (
        <Button variant="secondary" size="sm" onPress={() => void onRetry()}>
          Try again
        </Button>
      )}
    </div>
  );
}
