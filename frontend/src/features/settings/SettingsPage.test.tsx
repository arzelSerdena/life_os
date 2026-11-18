import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, test, vi } from "vitest";
import type { BackupsRead, SettingsRead } from "../../client/types.gen";
import { today } from "../../period";
import { PANEL_DEFAULT_WIDTH, useDetailPanel } from "../../stores/detailPanelStore";
import { SIDEBAR_DEFAULT_WIDTH, useSidebarStore } from "../../stores/sidebarStore";
import { renderApp } from "../../test-utils";

let settings: SettingsRead;
let backups: BackupsRead;
let requests: { method: string; path: string; body: unknown }[];

const TODAY = today();

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function backup(time: string, size = 2_516_582, day = TODAY) {
  return {
    name: `life_os-${day}-${time.replaceAll(":", "")}.db`,
    created_at: `${day}T${time}`,
    size,
  };
}

beforeEach(() => {
  useSidebarStore.setState({ collapsed: false, width: SIDEBAR_DEFAULT_WIDTH });
  useDetailPanel.setState({ width: PANEL_DEFAULT_WIDTH });
  requests = [];
  settings = {
    open_on_start: "home",
    time_format: "12h",
    day_ends_at: 0,
    auto_backup: true,
    keep_backups: 14,
    backup_folder: null,
    updated_at: "2026-11-18T00:00:00Z",
  };
  backups = {
    folder: "C:\\Life OS\\backups",
    folder_found: true,
    backups: [backup("03:00:00")],
    last_failure: null,
    auto_backup_hour: 3,
  };
  vi.stubGlobal(
    "fetch",
    vi.fn(async (request: Request) => {
      const path = new URL(request.url).pathname;
      if (request.method !== "GET") {
        const text = await request.text();
        requests.push({ method: request.method, path, body: text ? JSON.parse(text) : null });
      }
      if (path === "/api/settings" && request.method === "PATCH") {
        settings = { ...settings, ...(requests.at(-1)?.body as Partial<SettingsRead>) };
        return json(settings);
      }
      if (path === "/api/backups/restore") {
        return json({ restored: backups.backups[0], current_data_backup: backup("14:00:00") });
      }
      switch (path) {
        case "/api/settings":
          return json(settings);
        case "/api/backups":
          return json(backups);
        case "/api/about":
          return json({ version: "0.1.0", database_path: "C:\\Life OS\\life_os.db" });
        default:
          return json([]);
      }
    }),
  );
});

function row(name: string) {
  return screen.findByRole("group", { name });
}

test("the rail opens Settings with its sections", async () => {
  const user = userEvent.setup();
  renderApp("/areas");

  await user.click(await screen.findByRole("link", { name: "Settings" }));

  expect(await screen.findByRole("heading", { name: "Settings" })).toBeInTheDocument();
  const nav = screen.getByRole("navigation", { name: "Settings sections" });
  expect(
    within(nav)
      .getAllByRole("button")
      .map((item) => item.textContent),
  ).toEqual(["General", "Data", "About"]);
  expect(within(nav).getByRole("button", { name: "General" })).toHaveAttribute(
    "aria-current",
    "true",
  );
});

test("changes save at once", async () => {
  const user = userEvent.setup();
  renderApp("/settings");

  await user.click(await screen.findByRole("radio", { name: "Calendar" }));
  await user.click(screen.getByRole("radio", { name: "24-hour" }));

  await waitFor(() =>
    expect(requests.map((request) => request.body)).toEqual([
      { open_on_start: "calendar" },
      { time_format: "24h" },
    ]),
  );
  // Every time on the page follows the format.
  expect(
    await within(await row("Last backup")).findByText("Today, 03:00 · 2.4 MB"),
  ).toBeInTheDocument();
  expect(within(await row("Automatic backups")).getByText("Daily, 03:00")).toBeInTheDocument();
});

test("the Data rows show the folder, the last backup and the version", async () => {
  renderApp("/settings");

  expect(
    await within(await row("Last backup")).findByText("Today, 3 AM · 2.4 MB"),
  ).toBeInTheDocument();
  expect(within(await row("Backup folder")).getByText("C:\\Life OS\\backups")).toBeInTheDocument();
  expect(within(await row("Automatic backups")).getByText("Daily, 3 AM")).toBeInTheDocument();
  expect(await within(await row("Version")).findByText("0.1.0")).toBeInTheDocument();
  expect(within(await row("Database")).getByText("C:\\Life OS\\life_os.db")).toBeInTheDocument();
});

test("Keep last is disabled while automatic backups are off", async () => {
  settings.auto_backup = false;
  renderApp("/settings");

  expect(await screen.findByRole("button", { name: "Keep last" })).toBeDisabled();
  expect(within(await row("Automatic backups")).queryByText("Daily, 3 AM")).not.toBeInTheDocument();
});

test("a missing folder is red and blocks Back up now, Open folder and Restore", async () => {
  backups = { ...backups, folder: "D:\\Backups\\Life OS", folder_found: false };
  renderApp("/settings");

  const folder = await screen.findByText("Folder not found: D:\\Backups\\Life OS");
  expect(folder).toHaveClass("text-(--text-danger)");
  expect(
    within(await row("Backup folder")).getByRole("button", { name: "Open folder" }),
  ).toBeDisabled();
  expect(screen.getByRole("button", { name: "Back up now" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Restore…" })).toBeDisabled();
});

test("a failed backup is red, and the button becomes Retry", async () => {
  backups = {
    ...backups,
    last_failure: { at: `${TODAY}T14:12:00`, message: "couldn't write to the backup folder" },
  };
  renderApp("/settings");

  expect(
    await screen.findByText("Failed today, 2:12 PM · couldn't write to the backup folder"),
  ).toHaveClass("text-(--text-danger)");
  expect(screen.getByRole("button", { name: "Retry" })).toBeEnabled();
});

test("Back up now posts a backup", async () => {
  const user = userEvent.setup();
  renderApp("/settings");

  await user.click(await screen.findByRole("button", { name: "Back up now" }));

  await waitFor(() =>
    expect(requests).toEqual([{ method: "POST", path: "/api/backups", body: null }]),
  );
});

test("Change edits the folder in place", async () => {
  const user = userEvent.setup();
  renderApp("/settings");

  await user.click(
    await within(await row("Backup folder")).findByRole("button", { name: "Change" }),
  );
  const field = screen.getByRole("textbox", { name: "Backup folder path" });
  await user.clear(field);
  await user.type(field, "D:\\Backups{Enter}");

  await waitFor(() => expect(requests.at(-1)?.body).toEqual({ backup_folder: "D:\\Backups" }));
});

test("Restore picks a backup, confirms its date and size, then restores", async () => {
  backups.backups = [backup("14:00:00", 839_680), backup("03:00:00")];
  const user = userEvent.setup();
  renderApp("/settings");

  await user.click(await screen.findByRole("button", { name: "Restore…" }));
  const dialog = await screen.findByRole("alertdialog");
  expect(within(dialog).getByRole("radio", { name: /Today, 2 PM/ })).toBeChecked();
  await user.click(within(dialog).getByRole("radio", { name: /Today, 3 AM/ }));
  await user.click(within(dialog).getByRole("button", { name: "Restore…" }));

  expect(
    within(dialog).getByRole("heading", { name: "Restore the backup from Today, 3 AM?" }),
  ).toBeInTheDocument();
  expect(within(dialog).getByText("2.4 MB")).toBeInTheDocument();
  expect(within(dialog).getByText("Your current data is backed up first")).toBeInTheDocument();
  await user.click(within(dialog).getByRole("button", { name: "Restore backup" }));

  await waitFor(() =>
    expect(requests).toEqual([
      {
        method: "POST",
        path: "/api/backups/restore",
        body: { name: `life_os-${TODAY}-030000.db` },
      },
    ]),
  );
  expect(
    await screen.findByText("Restored the backup from Today, 3 AM · current data backed up"),
  ).toBeInTheDocument();
  expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
});

test("Reset layout puts the sizes back, and Undo restores them", async () => {
  useSidebarStore.setState({ width: 280 });
  useDetailPanel.setState({ width: 480 });
  const user = userEvent.setup();
  renderApp("/settings");

  expect(
    await within(await row("Reset layout")).findByText("Sidebar 280 px · Panel 480 px"),
  ).toBeInTheDocument();
  await user.click(within(await row("Reset layout")).getByRole("button", { name: "Reset" }));

  expect(useSidebarStore.getState().width).toBe(SIDEBAR_DEFAULT_WIDTH);
  expect(useDetailPanel.getState().width).toBe(PANEL_DEFAULT_WIDTH);
  expect(within(await row("Reset layout")).getByRole("button", { name: "Reset" })).toBeDisabled();
  expect(screen.getByText("Layout reset")).toBeInTheDocument();

  await user.click(screen.getByRole("button", { name: "Undo" }));
  expect(useSidebarStore.getState().width).toBe(280);
  expect(useDetailPanel.getState().width).toBe(480);
});

test("opening the app goes where Open on start says", async () => {
  settings.open_on_start = "tasks";
  renderApp("/");

  expect(await screen.findByRole("complementary", { name: "Tasks" })).toBeInTheDocument();
});
