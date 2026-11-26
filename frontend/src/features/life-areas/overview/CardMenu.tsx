import { Button, Dropdown, Header, Label } from "@heroui/react";
import { Check, SlidersHorizontal } from "lucide-react";
import { Fragment } from "react";
import { FiltersOnDot } from "../../tasks/FilterMenu";
import { areaDataAttribute } from "../palette";

export type MenuOption = {
  /** Options are grouped under their section's caps heading ("" for no heading). */
  section: string;
  id: string;
  label: string;
  selected: boolean;
  /** A checkbox (an independent toggle) rather than a check mark (one of a set). */
  check?: boolean;
  /** An area color, shown as a dot before the label. */
  area?: string | null;
};

type CardMenuProps = {
  /** The card's title, for the button's accessible name. */
  label: string;
  options: MenuOption[];
  /** Called with the option that was clicked. */
  onSelect: (id: string) => void;
  /** Shows a subtle indicator dot when filters are active. */
  hasActiveFilters?: boolean;
};

/** A card's one corner icon: sort and filter. The menu stays open while you change things. */
export function CardMenu({ label, options, onSelect, hasActiveFilters = false }: CardMenuProps) {
  const sections = [...new Set(options.map((option) => option.section))];
  const selected = new Set(options.filter((option) => option.selected).map((option) => option.id));

  return (
    <Dropdown>
      <Button
        isIconOnly
        variant="ghost"
        aria-label={`Sort and filter ${label}`}
        className="relative size-6 min-w-0 rounded-(--radius-6) text-(--text-tertiary) hover:bg-(--bg-hover) [&_svg]:size-4"
      >
        <SlidersHorizontal aria-hidden strokeWidth={2} />
        {hasActiveFilters && <FiltersOnDot />}
      </Button>
      <Dropdown.Popover
        placement="bottom end"
        className="min-w-[220px] rounded-(--radius-12) border border-(--border-default) bg-(--bg-surface)"
      >
        <Dropdown.Menu
          aria-label={`Sort and filter ${label}`}
          selectionMode="multiple"
          selectedKeys={selected}
          onSelectionChange={(keys) => {
            if (keys === "all") return;
            const next = new Set([...keys].map(String));
            const changed =
              [...next].find((id) => !selected.has(id)) ??
              [...selected].find((id) => !next.has(id));
            if (changed) onSelect(changed);
          }}
        >
          {sections.map((section) => (
            <Fragment key={section || "rest"}>
              <Dropdown.Section className="border-(--border-default) not-first:mt-1 not-first:border-t not-first:pt-1">
                {section && (
                  <Header className="px-2 pt-1 pb-0.5 type-label text-(--text-tertiary)">
                    {section}
                  </Header>
                )}
                {options
                  .filter((option) => option.section === section)
                  .map((option) => (
                    <Dropdown.Item
                      key={option.id}
                      id={option.id}
                      textValue={option.label}
                      className="group"
                    >
                      {option.check && (
                        <span
                          aria-hidden
                          data-area={
                            option.area === undefined ? undefined : areaDataAttribute(option.area)
                          }
                          className={`grid size-[15px] shrink-0 place-items-center rounded-[4px] border-[1.5px] border-(--border-strong) text-white ${
                            option.area === undefined
                              ? "group-data-[selected=true]:border-brand-600 group-data-[selected=true]:bg-brand-600"
                              : option.area === null
                                ? "group-data-[selected=true]:border-(--color-neutral-400) group-data-[selected=true]:bg-(--color-neutral-400)"
                                : "group-data-[selected=true]:border-(--area-solid) group-data-[selected=true]:bg-(--area-solid)"
                          }`}
                        >
                          <Check
                            className="hidden size-2.5 group-data-[selected=true]:block"
                            strokeWidth={3}
                          />
                        </span>
                      )}
                      {!option.check && option.area !== undefined && (
                        <span
                          aria-hidden
                          data-area={areaDataAttribute(option.area)}
                          className="size-2 shrink-0 rounded-[2px] bg-(--area-solid)"
                        />
                      )}
                      <Label className="flex-1">{option.label}</Label>
                      {!option.check && (
                        <Check
                          aria-hidden
                          className="invisible size-3.5 text-(--text-tertiary) group-data-[selected=true]:visible"
                          strokeWidth={2}
                        />
                      )}
                    </Dropdown.Item>
                  ))}
              </Dropdown.Section>
            </Fragment>
          ))}
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown>
  );
}
