import { expect, test } from "vitest";
import { formatTime } from "./format";

test("12-hour times drop :00 on the hour; 24-hour times keep it", () => {
  expect(formatTime("18:00:00", "12h")).toBe("6 PM");
  expect(formatTime("09:30:00", "12h")).toBe("9:30 AM");
  expect(formatTime("00:00:00", "12h")).toBe("12 AM");
  expect(formatTime("12:05:00", "12h")).toBe("12:05 PM");
  expect(formatTime("18:00:00", "24h")).toBe("18:00");
  expect(formatTime("07:05:00", "24h")).toBe("07:05");
});
