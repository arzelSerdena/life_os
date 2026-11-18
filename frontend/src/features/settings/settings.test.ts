import { expect, test } from "vitest";
import type { BackupsRead } from "../../client/types.gen";
import {
  attachmentName,
  hourLabel,
  lastBackupLine,
  layoutChanges,
  sizeLabel,
  whenLabel,
} from "./settings";

const TODAY = "2026-11-18";

function status(overrides: Partial<BackupsRead> = {}): BackupsRead {
  return {
    folder: "C:/Life OS/backups",
    folder_found: true,
    backups: [],
    last_failure: null,
    auto_backup_hour: 3,
    ...overrides,
  };
}

test("hours follow the time format, 12 AM included", () => {
  expect([0, 3].map((hour) => hourLabel(hour, "12h"))).toEqual(["12 AM", "3 AM"]);
  expect([0, 3].map((hour) => hourLabel(hour, "24h"))).toEqual(["00:00", "03:00"]);
});

test("a backup's time says today, yesterday or the date", () => {
  expect(whenLabel("2026-11-18T03:00:00", TODAY, "12h")).toBe("Today, 3 AM");
  expect(whenLabel("2026-11-17T14:05:00", TODAY, "12h")).toBe("Yesterday, 2:05 PM");
  expect(whenLabel("2026-11-14T03:00:00", TODAY, "24h")).toBe("Nov 14, 03:00");
});

test("sizes are in KB under a megabyte, MB above", () => {
  expect(sizeLabel(2_516_582)).toBe("2.4 MB");
  expect(sizeLabel(839_680)).toBe("820 KB");
  expect(sizeLabel(10)).toBe("1 KB");
});

test("Last backup shows the newest backup, nothing yet, or a failure since", () => {
  const backup = { name: "b.db", created_at: "2026-11-18T03:00:00", size: 2_516_582 };

  expect(lastBackupLine(status(), TODAY, "12h")).toEqual({
    text: "No backups yet",
    failed: false,
  });
  expect(lastBackupLine(status({ backups: [backup] }), TODAY, "12h")).toEqual({
    text: "Today, 3 AM · 2.4 MB",
    failed: false,
  });
  const failure = { at: "2026-11-18T14:12:00", message: "couldn't write to the backup folder" };
  expect(
    lastBackupLine(status({ backups: [backup], last_failure: failure }), TODAY, "12h"),
  ).toEqual({ text: "Failed today, 2:12 PM · couldn't write to the backup folder", failed: true });
});

test("Reset layout lists what differs from the defaults", () => {
  const defaults = { sidebarWidth: 240, sidebarHidden: false, panelWidth: 400 };

  expect(layoutChanges(defaults, defaults)).toBe("");
  expect(layoutChanges({ ...defaults, sidebarWidth: 280, panelWidth: 480 }, defaults)).toBe(
    "Sidebar 280 px · Panel 480 px",
  );
  expect(layoutChanges({ ...defaults, sidebarWidth: 280, sidebarHidden: true }, defaults)).toBe(
    "Sidebar hidden",
  );
});

test("the export's file name comes from its header", () => {
  expect(attachmentName('attachment; filename="life-os-2026-11-18.zip"', "x.zip")).toBe(
    "life-os-2026-11-18.zip",
  );
  expect(attachmentName(null, "x.zip")).toBe("x.zip");
});
