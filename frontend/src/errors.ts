const FALLBACK_MESSAGE = "Something went wrong. Check that the app is running and try again.";

/** The API's explanation when it gave one, such as why a delete was refused. */
export function errorMessage(error: unknown): string {
  if (
    typeof error === "object" &&
    error !== null &&
    "detail" in error &&
    typeof error.detail === "string"
  ) {
    return error.detail;
  }
  return FALLBACK_MESSAGE;
}
