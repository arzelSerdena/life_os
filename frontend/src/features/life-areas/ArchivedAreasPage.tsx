import { Button } from "@heroui/react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router";
import {
  listLifeAreasOptions,
  listRoutinesOptions,
  unarchiveLifeAreaMutation,
} from "../../client/@tanstack/react-query.gen";
import type { LifeAreaRead } from "../../client/types.gen";
import { PageHeader } from "../../components/PageHeader";
import { QueryError } from "../../components/QueryError";
import { DeleteLifeAreaDialog } from "./DeleteLifeAreaDialog";
import { areaDataAttribute } from "./palette";

const archivedDate = new Intl.DateTimeFormat(undefined, { dateStyle: "medium" });

/** Archived areas, where they can be restored or deleted for good. */
export function ArchivedAreasPage() {
  const [deleteTarget, setDeleteTarget] = useState<LifeAreaRead | null>(null);
  const lifeAreas = useQuery(listLifeAreasOptions({ query: { include_archived: true } }));
  const restore = useMutation(unarchiveLifeAreaMutation());
  const archived = (lifeAreas.data ?? []).filter((area) => area.archived_at !== null);

  return (
    <>
      <PageHeader
        title="Finished & archived"
        description="Archived areas and everything in them are hidden from the rest of the app."
      />
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-auto px-(--page-gutter) pt-4 pb-(--page-gutter)">
        {lifeAreas.isError && <QueryError error={lifeAreas.error} onRetry={lifeAreas.refetch} />}
        {restore.isError && <QueryError error={restore.error} />}
        {lifeAreas.isSuccess && archived.length === 0 && (
          <p className="py-16 text-center type-body text-(--text-tertiary)">No archived areas.</p>
        )}
        {archived.length > 0 && (
          <ul className="max-w-[760px] divide-y divide-(--border-default) rounded-(--radius-12) border border-(--border-default)">
            {archived.map((area) => (
              <li key={area.id} className="flex h-12 items-center gap-3 px-4">
                <span
                  aria-hidden
                  data-area={areaDataAttribute(area.color)}
                  className="size-2 shrink-0 rounded-[2px] bg-(--area-solid)"
                />
                <Link
                  to={`/areas/${area.id}`}
                  className="truncate type-card-title text-(--text-primary) hover:underline"
                >
                  {area.title}
                </Link>
                <span className="type-meta text-(--text-tertiary)">
                  Archived {archivedDate.format(new Date(area.archived_at as string))}
                </span>
                <div className="ml-auto flex gap-2">
                  <Button
                    size="sm"
                    isDisabled={restore.isPending}
                    onPress={() => restore.mutate({ path: { life_area_id: area.id } })}
                  >
                    Restore
                  </Button>
                  <Button size="sm" variant="danger-soft" onPress={() => setDeleteTarget(area)}>
                    Delete
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
        <ArchivedRoutines />
      </div>
      {deleteTarget && (
        <DeleteLifeAreaDialog lifeArea={deleteTarget} onClose={() => setDeleteTarget(null)} />
      )}
    </>
  );
}

/** Archived routines; each opens its page, read-only, where it can be restored. */
function ArchivedRoutines() {
  const routines = useQuery(listRoutinesOptions({ query: { include_archived: true } }));
  const archived = (routines.data ?? []).filter((routine) => routine.archived_at !== null);
  return (
    <section id="archived-routines" aria-label="Archived routines" className="flex flex-col gap-2">
      <h2 className="type-column-title text-(--text-primary)">Routines</h2>
      {routines.isError && <QueryError error={routines.error} onRetry={routines.refetch} />}
      {routines.isSuccess && archived.length === 0 && (
        <p className="type-body text-(--text-tertiary)">No archived routines.</p>
      )}
      {archived.length > 0 && (
        <ul className="max-w-[760px] divide-y divide-(--border-default) rounded-(--radius-12) border border-(--border-default)">
          {archived.map((routine) => (
            <li key={routine.id} className="flex h-12 items-center gap-3 px-4">
              <Link
                to={`/areas/routines/${routine.id}`}
                className="truncate type-card-title text-(--text-primary) hover:underline"
              >
                {routine.title}
              </Link>
              <span className="type-meta text-(--text-tertiary)">
                Archived {archivedDate.format(new Date(routine.archived_at as string))}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
