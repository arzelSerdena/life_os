import { Button } from "@heroui/react";
import { useQuery } from "@tanstack/react-query";
import { Database, Info, type LucideIcon, SlidersHorizontal } from "lucide-react";
import { type ReactNode, useRef, useState } from "react";
import { getAboutOptions, getSettingsOptions } from "../../client/@tanstack/react-query.gen";
import type { SettingsRead } from "../../client/types.gen";
import { PageHeader } from "../../components/PageHeader";
import { QueryError } from "../../components/QueryError";
import { Scroll } from "../../components/Scroll";
import { SectionCard } from "../../components/SectionCard";
import { SegmentSwitch } from "../../components/SegmentSwitch";
import { SIDEBAR_ROW, SIDEBAR_ROW_ACTIVE, Sidebar } from "../../components/Sidebar";
import { useChangeToast } from "../../stores/changeToastStore";
import { PANEL_DEFAULT_WIDTH, useDetailPanel } from "../../stores/detailPanelStore";
import { SIDEBAR_DEFAULT_WIDTH, useSidebarStore } from "../../stores/sidebarStore";
import {
  OpenFolderButton,
  SECONDARY_BUTTON,
  SelectMenu,
  SettingRow,
  useUpdateSettings,
} from "./controls";
import { DataSection } from "./DataSection";
import {
  DAY_ENDS_AT,
  hourLabel,
  type LayoutState,
  layoutChanges,
  OPEN_ON_START,
  SECTIONS,
  type SectionId,
  THEMES,
  TIME_FORMATS,
} from "./settings";

const SECTION_ICONS: Record<SectionId, LucideIcon> = {
  general: SlidersHorizontal,
  data: Database,
  about: Info,
};

const DEFAULT_LAYOUT: LayoutState = {
  sidebarWidth: SIDEBAR_DEFAULT_WIDTH,
  sidebarHidden: false,
  panelWidth: PANEL_DEFAULT_WIDTH,
};

/** Settings (approved-settings.html, with Restore from backup from the Nov 16 decisions):
 * the sections in the sidebar, then a 720 px column of section cards. */
export function SettingsPage() {
  const settings = useQuery(getSettingsOptions());
  const scroller = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState<SectionId>("general");

  const scrollTo = (id: SectionId) => {
    const container = scroller.current;
    const section = container?.querySelector<HTMLElement>(`#settings-${id}`);
    if (!container || !section) return;
    container.scrollTo?.({ top: section.offsetTop - container.offsetTop - 16, behavior: "smooth" });
    setActive(id);
  };

  // The sidebar row follows the scroll: the last section whose top has passed the header.
  const onScroll = () => {
    const container = scroller.current;
    if (!container) return;
    const atEnd = container.scrollTop + container.clientHeight >= container.scrollHeight - 2;
    let current: SectionId = SECTIONS[0].id;
    for (const { id } of SECTIONS) {
      const section = container.querySelector<HTMLElement>(`#settings-${id}`);
      if (section && section.offsetTop - container.offsetTop - container.scrollTop <= 24) {
        current = id;
      }
    }
    setActive(atEnd ? SECTIONS[SECTIONS.length - 1].id : current);
  };

  return (
    <>
      <Sidebar label="Settings">
        <nav aria-label="Settings sections" className="flex flex-col gap-(--sidebar-item-gap)">
          {SECTIONS.map(({ id, label }) => {
            const Icon = SECTION_ICONS[id];
            const isActive = id === active;
            return (
              <button
                key={id}
                type="button"
                aria-current={isActive ? "true" : undefined}
                onClick={() => scrollTo(id)}
                className={`${SIDEBAR_ROW} w-full text-left ${isActive ? SIDEBAR_ROW_ACTIVE : "text-(--sidebar-item-text)"}`}
              >
                <Icon
                  aria-hidden
                  className={`size-4 shrink-0 ${isActive ? "text-(--color-brand-600)" : "text-(--text-tertiary)"}`}
                />
                {label}
              </button>
            );
          })}
        </nav>
      </Sidebar>
      <main className="flex min-h-0 min-w-0 flex-1 flex-col">
        <PageHeader title="Settings" />
        <Scroll
          ref={scroller}
          direction="both"
          onScroll={onScroll}
          className="min-h-0 flex-1 px-(--page-gutter) pt-4 pb-[120px]"
        >
          {settings.isError ? (
            <QueryError error={settings.error} onRetry={settings.refetch} />
          ) : settings.data ? (
            <div className="mx-auto flex w-full max-w-[720px] flex-col gap-4">
              <Section id="general" title="General">
                <GeneralRows settings={settings.data} />
              </Section>
              <Section id="data" title="Data">
                <DataSection settings={settings.data} />
              </Section>
              <Section id="about" title="About">
                <AboutRows />
              </Section>
            </div>
          ) : null}
        </Scroll>
      </main>
    </>
  );
}

function Section({ id, title, children }: { id: SectionId; title: string; children: ReactNode }) {
  return (
    <div id={`settings-${id}`}>
      <SectionCard title={title}>
        <div className="-mt-1 -mb-3 flex flex-col">{children}</div>
      </SectionCard>
    </div>
  );
}

function GeneralRows({ settings }: { settings: SettingsRead }) {
  const { save } = useUpdateSettings();
  const format = settings.time_format;
  return (
    <>
      <SettingRow label="Theme">
        <SegmentSwitch
          label="Theme"
          value={settings.theme}
          options={THEMES}
          onChange={(theme) => save({ theme })}
        />
      </SettingRow>
      <SettingRow label="Open on start">
        <SegmentSwitch
          label="Open on start"
          value={settings.open_on_start}
          options={OPEN_ON_START}
          onChange={(open_on_start) => save({ open_on_start })}
        />
      </SettingRow>
      <SettingRow label="Time format">
        <SegmentSwitch
          label="Time format"
          value={format}
          options={TIME_FORMATS}
          onChange={(time_format) => save({ time_format })}
        />
      </SettingRow>
      <SettingRow label="Day ends at">
        <SelectMenu
          label="Day ends at"
          value={settings.day_ends_at}
          options={DAY_ENDS_AT}
          format={(hour) => hourLabel(hour, format)}
          onChange={(day_ends_at) => save({ day_ends_at })}
        />
      </SettingRow>
      <ResetLayoutRow />
    </>
  );
}

/** Puts the sidebar and the detail panel back to their default sizes, with Undo. */
function ResetLayoutRow() {
  const sidebar = useSidebarStore();
  const panelWidth = useDetailPanel((state) => state.width);
  const setPanelWidth = useDetailPanel((state) => state.setWidth);
  const showLocal = useChangeToast((state) => state.showLocal);
  const layout: LayoutState = {
    sidebarWidth: sidebar.width,
    sidebarHidden: sidebar.collapsed,
    panelWidth,
  };
  const changes = layoutChanges(layout, DEFAULT_LAYOUT);

  const apply = (to: LayoutState) => {
    const store = useSidebarStore.getState();
    store.setWidth(to.sidebarWidth);
    store.setCollapsed(to.sidebarHidden);
    setPanelWidth(to.panelWidth);
  };
  const reset = () => {
    const before = layout;
    apply(DEFAULT_LAYOUT);
    showLocal("Layout reset", () => apply(before));
  };

  return (
    <SettingRow label="Reset layout" data={changes || null}>
      <Button className={SECONDARY_BUTTON} isDisabled={!changes} onPress={reset}>
        Reset
      </Button>
    </SettingRow>
  );
}

function AboutRows() {
  const about = useQuery(getAboutOptions());
  return (
    <>
      <SettingRow label="Version">
        <span className="type-body text-(--text-secondary) tabular-nums">
          {about.data?.version}
        </span>
      </SettingRow>
      <SettingRow label="Database" data={about.data?.database_path}>
        <OpenFolderButton folder="database" isDisabled={!about.data} />
      </SettingRow>
    </>
  );
}
