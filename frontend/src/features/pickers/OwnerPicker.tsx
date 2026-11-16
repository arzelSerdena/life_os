import { Folder, Inbox, Search, TextAlignStart } from "lucide-react";
import { type ReactNode, useState } from "react";
import type { LifeAreaRead, ProjectRead, SectionRead } from "../../client/types.gen";
import { areaDataAttribute } from "../life-areas/palette";
import { CrumbPicker, PickerRow, PickerSeparator, PopoverChip } from "./chips";

/** Who owns an item: a project (and its area), an area, or neither (the Inbox). */
export type Owner = { lifeAreaId: number | null; projectId: number | null };

type OwnerOptions = {
  value: Owner;
  /** Active areas, in their order. */
  lifeAreas: readonly LifeAreaRead[];
  /** Active projects. */
  projects: readonly ProjectRead[];
  allowInbox?: boolean;
};

/** The owner chip, as in New task. */
export function OwnerChip({
  value,
  lifeAreas,
  projects,
  allowInbox = true,
  onChange,
}: OwnerOptions & { onChange: (owner: Owner) => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const project = projects.find((p) => p.id === value.projectId);
  const area = lifeAreas.find((a) => a.id === (project?.life_area_id ?? value.lifeAreaId));
  return (
    <PopoverChip
      label="Owner"
      width={280}
      isOpen={isOpen}
      onOpenChange={setIsOpen}
      leading={
        project ? (
          <Folder
            aria-hidden
            data-area={areaDataAttribute(area?.color)}
            className="text-(--area-solid)!"
            strokeWidth={2}
          />
        ) : area ? (
          <span
            aria-hidden
            data-area={areaDataAttribute(area.color)}
            className="size-2 shrink-0 rounded-[2px] bg-(--area-solid)"
          />
        ) : (
          <Inbox aria-hidden strokeWidth={2} />
        )
      }
      chip={<span className="truncate">{project?.title ?? area?.title ?? "Inbox"}</span>}
    >
      <OwnerPanel
        value={value}
        lifeAreas={lifeAreas}
        projects={projects}
        allowInbox={allowInbox}
        onPick={(owner) => {
          setIsOpen(false);
          if (owner.lifeAreaId !== value.lifeAreaId || owner.projectId !== value.projectId) {
            onChange(owner);
          }
        }}
      />
    </PopoverChip>
  );
}

/** An area or project in the detail panel's breadcrumb, opening the owner picker. */
export function OwnerCrumb({
  value,
  lifeAreas,
  projects,
  allowInbox = true,
  label = "Owner",
  onChange,
  children,
}: OwnerOptions & { label?: string; onChange: (owner: Owner) => void; children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <CrumbPicker
      label={label}
      width={280}
      isOpen={isOpen}
      onOpenChange={setIsOpen}
      crumb={children}
    >
      <OwnerPanel
        value={value}
        lifeAreas={lifeAreas}
        projects={projects}
        allowInbox={allowInbox}
        onPick={(owner) => {
          setIsOpen(false);
          if (owner.lifeAreaId !== value.lifeAreaId || owner.projectId !== value.projectId) {
            onChange(owner);
          }
        }}
      />
    </CrumbPicker>
  );
}

/**
 * The owner picker: Search, Inbox (tasks only), then each life area with its active projects
 * indented under it. An area or a project can be picked.
 */
export function OwnerPanel({
  value,
  lifeAreas,
  projects,
  allowInbox = true,
  onPick,
}: OwnerOptions & { onPick: (owner: Owner) => void }) {
  const [query, setQuery] = useState("");
  const needle = query.trim().toLowerCase();
  const hit = (title: string) => !needle || title.toLowerCase().includes(needle);
  const projectsOf = (areaId: number) =>
    projects
      .filter((p) => p.life_area_id === areaId)
      .sort((a, b) => a.sort_order - b.sort_order || a.id - b.id);
  // An area stays listed while any of its projects match, so they keep their heading.
  const groups = lifeAreas
    .map((a) => ({
      area: a,
      areaHit: hit(a.title),
      projects: projectsOf(a.id).filter((p) => hit(p.title) || (needle !== "" && hit(a.title))),
    }))
    .filter((group) => group.areaHit || group.projects.length > 0);
  const showInbox = allowInbox && hit("Inbox");

  return (
    <>
      <div className="px-0.5 pt-0.5 pb-1.5">
        <label className="flex h-8 items-center gap-1.5 rounded-(--radius-6) border border-(--border-default) px-2.5 focus-within:border-(--color-brand-600) focus-within:shadow-[0_0_0_2px_var(--color-brand-200)]">
          <Search aria-hidden className="size-3.5 shrink-0 text-(--text-tertiary)" />
          <input
            // biome-ignore lint/a11y/noAutofocus: the picker opens to search
            autoFocus
            aria-label="Search"
            placeholder="Search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="min-w-0 flex-1 bg-transparent text-[13px] text-(--text-primary) outline-none placeholder:text-(--text-tertiary)"
          />
        </label>
      </div>
      <div className="flex max-h-80 flex-col overflow-y-auto">
        {showInbox && (
          <>
            <PickerRow
              leading={<Inbox aria-hidden className="size-3.5 text-(--text-tertiary)" />}
              selected={value.lifeAreaId === null && value.projectId === null}
              onPress={() => onPick({ lifeAreaId: null, projectId: null })}
            >
              Inbox
            </PickerRow>
            {groups.length > 0 && <PickerSeparator />}
          </>
        )}
        {groups.map((group) => (
          <div key={group.area.id} data-area={areaDataAttribute(group.area.color)}>
            <PickerRow
              leading={
                <span aria-hidden className="size-2 shrink-0 rounded-[2px] bg-(--area-solid)" />
              }
              selected={value.projectId === null && value.lifeAreaId === group.area.id}
              onPress={() => onPick({ lifeAreaId: group.area.id, projectId: null })}
            >
              {group.area.title}
            </PickerRow>
            {group.projects.map((p) => (
              <PickerRow
                key={p.id}
                indent
                leading={
                  <Folder aria-hidden className="size-3.5 text-(--area-solid)" strokeWidth={2} />
                }
                selected={value.projectId === p.id}
                onPress={() => onPick({ lifeAreaId: p.life_area_id, projectId: p.id })}
              >
                {p.title}
              </PickerRow>
            ))}
          </div>
        ))}
        {!showInbox && groups.length === 0 && (
          <p className="px-2 py-1.5 text-[13px] text-(--text-tertiary)">No matches.</p>
        )}
      </div>
    </>
  );
}

/** A section in the detail panel's breadcrumb: No section, then the project's sections. */
export function SectionCrumb({
  value,
  sections,
  onChange,
  children,
}: {
  value: number | null;
  sections: readonly SectionRead[];
  onChange: (sectionId: number | null) => void;
  children: ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const ordered = [...sections].sort((a, b) => a.sort_order - b.sort_order || a.id - b.id);
  const pick = (sectionId: number | null) => {
    setIsOpen(false);
    if (sectionId !== value) onChange(sectionId);
  };
  const icon = <TextAlignStart aria-hidden className="size-3.5 text-(--text-tertiary)" />;
  return (
    <CrumbPicker
      label="Section"
      width={200}
      isOpen={isOpen}
      onOpenChange={setIsOpen}
      crumb={children}
    >
      <PickerRow leading={icon} selected={value === null} onPress={() => pick(null)}>
        No section
      </PickerRow>
      {ordered.length > 0 && <PickerSeparator />}
      {ordered.map((section) => (
        <PickerRow
          key={section.id}
          leading={icon}
          selected={value === section.id}
          onPress={() => pick(section.id)}
        >
          {section.title}
        </PickerRow>
      ))}
    </CrumbPicker>
  );
}
