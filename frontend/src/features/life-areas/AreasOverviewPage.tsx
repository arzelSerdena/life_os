import { Button } from "@heroui/react";
import { useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { listLifeAreasOptions } from "../../client/@tanstack/react-query.gen";
import { PageHeader } from "../../components/PageHeader";
import { PeriodSwitch } from "../../components/PeriodSwitch";
import { QueryError } from "../../components/QueryError";
import { useAreasContext } from "./AreasLayout";

/** The overview behind the LIFE AREAS heading: compares the areas over one period. */
export function AreasOverviewPage() {
  const { openCreateForm } = useAreasContext();
  const lifeAreas = useQuery(listLifeAreasOptions());

  return (
    <>
      <PageHeader
        title="Life areas"
        description="Are your areas moving toward what you set for them?"
        actions={
          <>
            <PeriodSwitch />
            <Button size="sm" onPress={openCreateForm}>
              <Plus aria-hidden />
              New area
            </Button>
          </>
        }
      />
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-auto px-(--page-gutter) pt-4 pb-(--page-gutter)">
        {lifeAreas.isError && <QueryError error={lifeAreas.error} onRetry={lifeAreas.refetch} />}
        {lifeAreas.isSuccess && lifeAreas.data.length === 0 && (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <p className="type-body text-(--text-tertiary)">No life areas yet.</p>
            <Button variant="secondary" size="sm" onPress={openCreateForm}>
              Create a life area
            </Button>
          </div>
        )}
      </div>
    </>
  );
}
