import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useNavigate, useParams } from "react-router";
import {
  archiveLifeAreaMutation,
  getLifeAreaOptions,
  unarchiveLifeAreaMutation,
} from "../../client/@tanstack/react-query.gen";
import { PageHeader } from "../../components/PageHeader";
import { PeriodSwitch } from "../../components/PeriodSwitch";
import { QueryError } from "../../components/QueryError";
import { AreaMenu } from "./AreaMenu";
import { useAreasContext } from "./AreasLayout";
import { DeleteLifeAreaDialog } from "./DeleteLifeAreaDialog";
import { areaDataAttribute } from "./palette";

/** One life area's page. Its section cards come with the area page slice. */
export function AreaPage() {
  const lifeAreaId = Number(useParams().areaId);
  const navigate = useNavigate();
  const { openEditForm } = useAreasContext();
  const [isDeleting, setIsDeleting] = useState(false);

  const lifeArea = useQuery(getLifeAreaOptions({ path: { life_area_id: lifeAreaId } }));
  const archive = useMutation(archiveLifeAreaMutation());
  const restore = useMutation(unarchiveLifeAreaMutation());
  const actionError = archive.error ?? restore.error;

  if (lifeArea.isPending) {
    return null;
  }
  if (lifeArea.isError) {
    return (
      <div className="p-(--page-gutter)">
        <QueryError error={lifeArea.error} />
      </div>
    );
  }

  const area = lifeArea.data;
  const path = { path: { life_area_id: area.id } };
  return (
    <>
      <PageHeader
        title={area.title}
        description={area.vision}
        marker={
          <span
            aria-hidden
            data-area={areaDataAttribute(area.color)}
            className="size-3 shrink-0 rounded-[3px] bg-(--area-solid)"
          />
        }
        actions={
          <>
            {area.archived_at === null && <PeriodSwitch />}
            <AreaMenu
              lifeArea={area}
              onEdit={() => openEditForm(area)}
              onArchive={() => archive.mutate(path, { onSuccess: () => navigate("/areas") })}
              onRestore={() => restore.mutate(path)}
              onDelete={() => setIsDeleting(true)}
            />
          </>
        }
      />
      <div className="flex flex-col gap-4 px-(--page-gutter) pt-4">
        {area.archived_at !== null && (
          <p className="type-body text-(--text-tertiary)">
            This area is archived. Restore it to plan in it again.
          </p>
        )}
        {actionError && <QueryError error={actionError} />}
      </div>
      {isDeleting && (
        <DeleteLifeAreaDialog
          lifeArea={area}
          onClose={() => setIsDeleting(false)}
          onDeleted={() => navigate("/areas", { replace: true })}
        />
      )}
    </>
  );
}
