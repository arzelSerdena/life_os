import { Alert, Button, Spinner, Switch } from "@heroui/react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { useState } from "react";
import {
  archiveLifeAreaMutation,
  listLifeAreasOptions,
  unarchiveLifeAreaMutation,
} from "../../client/@tanstack/react-query.gen";
import type { LifeAreaRead } from "../../client/types.gen";
import { errorMessage } from "../../errors";
import { DeleteLifeAreaDialog } from "./DeleteLifeAreaDialog";
import { LifeAreaCard } from "./LifeAreaCard";
import { LifeAreaFormModal } from "./LifeAreaFormModal";

type FormTarget = { lifeArea: LifeAreaRead | null };

export function LifeAreasPage() {
  const [showArchived, setShowArchived] = useState(false);
  const [formTarget, setFormTarget] = useState<FormTarget | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<LifeAreaRead | null>(null);

  const lifeAreas = useQuery({
    ...listLifeAreasOptions({ query: { include_archived: showArchived } }),
    retry: false,
  });
  const archive = useMutation(archiveLifeAreaMutation());
  const restore = useMutation(unarchiveLifeAreaMutation());
  const actionError = archive.error ?? restore.error;
  const openCreateForm = () => setFormTarget({ lifeArea: null });

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">Life areas</h1>
        <div className="flex items-center gap-4">
          <Switch isSelected={showArchived} onChange={setShowArchived}>
            <Switch.Content>
              <Switch.Control>
                <Switch.Thumb />
              </Switch.Control>
              Show archived
            </Switch.Content>
          </Switch>
          <Button onPress={openCreateForm}>
            <Plus aria-hidden className="size-4" />
            New life area
          </Button>
        </div>
      </header>

      {actionError && <ErrorAlert message={errorMessage(actionError)} />}

      {lifeAreas.isPending && (
        <div className="flex justify-center py-16">
          <Spinner aria-label="Loading life areas" />
        </div>
      )}

      {lifeAreas.isError && (
        <div className="flex flex-col items-start gap-3">
          <ErrorAlert message={errorMessage(lifeAreas.error)} />
          <Button variant="secondary" onPress={() => void lifeAreas.refetch()}>
            Try again
          </Button>
        </div>
      )}

      {lifeAreas.isSuccess && lifeAreas.data.length === 0 && (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <p className="text-muted">
            {showArchived ? "No life areas yet." : "No active life areas."}
          </p>
          <Button variant="secondary" onPress={openCreateForm}>
            Create a life area
          </Button>
        </div>
      )}

      {lifeAreas.isSuccess && lifeAreas.data.length > 0 && (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {lifeAreas.data.map((lifeArea) => (
            <li key={lifeArea.id} className="grid">
              <LifeAreaCard
                lifeArea={lifeArea}
                isBusy={archive.isPending || restore.isPending}
                onEdit={() => setFormTarget({ lifeArea })}
                onArchive={() => archive.mutate({ path: { life_area_id: lifeArea.id } })}
                onRestore={() => restore.mutate({ path: { life_area_id: lifeArea.id } })}
                onDelete={() => setDeleteTarget(lifeArea)}
              />
            </li>
          ))}
        </ul>
      )}

      {formTarget && (
        <LifeAreaFormModal lifeArea={formTarget.lifeArea} onClose={() => setFormTarget(null)} />
      )}
      {deleteTarget && (
        <DeleteLifeAreaDialog lifeArea={deleteTarget} onClose={() => setDeleteTarget(null)} />
      )}
    </div>
  );
}

function ErrorAlert({ message }: { message: string }) {
  return (
    <Alert status="danger">
      <Alert.Indicator />
      <Alert.Content>
        <Alert.Description>{message}</Alert.Description>
      </Alert.Content>
    </Alert>
  );
}
