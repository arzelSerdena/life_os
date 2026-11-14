import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Alert, Button, Modal } from "@heroui/react";
import { useMutation } from "@tanstack/react-query";
import { GripVertical, X } from "lucide-react";
import { useState } from "react";
import { reorderLifeAreasMutation } from "../../client/@tanstack/react-query.gen";
import type { LifeAreaRead } from "../../client/types.gen";
import { IconButton } from "../../components/IconButton";
import { errorMessage } from "../../errors";
import { areaDataAttribute } from "./palette";

type ReorderAreasModalProps = {
  lifeAreas: readonly LifeAreaRead[];
  onClose: () => void;
};

/** Drag the areas into a new order, used by the sidebar and every overview. */
export function ReorderAreasModal({ lifeAreas, onClose }: ReorderAreasModalProps) {
  const [order, setOrder] = useState(() => [...lifeAreas]);
  const reorder = useMutation(reorderLifeAreasMutation());
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    setOrder((current) => {
      const from = current.findIndex((area) => area.id === active.id);
      const to = current.findIndex((area) => area.id === over.id);
      return arrayMove(current, from, to);
    });
  };

  const save = () =>
    reorder.mutate(
      { body: { life_area_ids: order.map((area) => area.id) } },
      { onSuccess: onClose },
    );

  return (
    <Modal.Backdrop
      isOpen
      onOpenChange={(isOpen) => !isOpen && onClose()}
      className="bg-[rgb(17_24_39/0.32)]"
    >
      <Modal.Container>
        <Modal.Dialog className="w-[360px] max-w-[calc(100vw-32px)] gap-0 rounded-(--radius-12) p-0 shadow-(--effect-overlay)">
          <Modal.Header className="flex h-[52px] flex-row items-center justify-between border-b border-(--border-default) py-0 pr-3 pl-5">
            <Modal.Heading className="type-panel-title text-(--text-primary)">
              Reorder areas
            </Modal.Heading>
            <IconButton label="Close" size="md" onPress={onClose}>
              <X />
            </IconButton>
          </Modal.Header>
          <Modal.Body className="m-0 flex flex-col gap-3 px-5 py-4">
            <p className="type-meta text-(--text-tertiary)">
              Drag to change the order. It is used in the sidebar and on every overview.
            </p>
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
              <SortableContext items={order} strategy={verticalListSortingStrategy}>
                <ul aria-label="Life areas in order" className="flex flex-col gap-1">
                  {order.map((area) => (
                    <SortableArea key={area.id} lifeArea={area} />
                  ))}
                </ul>
              </SortableContext>
            </DndContext>
            {reorder.isError && (
              <Alert status="danger">
                <Alert.Indicator />
                <Alert.Content>
                  <Alert.Description>{errorMessage(reorder.error)}</Alert.Description>
                </Alert.Content>
              </Alert>
            )}
          </Modal.Body>
          <Modal.Footer className="m-0 flex justify-end gap-2 border-t border-(--border-default) px-5 py-3">
            <Button
              variant="secondary"
              onPress={onClose}
              className="border border-(--button-secondary-border) bg-(--bg-surface) text-(--button-secondary-text)"
            >
              Cancel
            </Button>
            <Button onPress={save} isPending={reorder.isPending}>
              Save order
            </Button>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}

function SortableArea({ lifeArea }: { lifeArea: LifeAreaRead }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: lifeArea.id,
  });
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`flex h-9 items-center gap-2 rounded-(--radius-8) border border-(--border-default) bg-(--bg-surface) pr-3 pl-1 type-sidebar-item text-(--text-primary) ${
        isDragging ? "relative z-10 shadow-(--effect-overlay)" : ""
      }`}
    >
      <button
        type="button"
        aria-label={`Move ${lifeArea.title}`}
        className="grid size-7 cursor-grab place-items-center rounded-(--radius-6) text-(--text-tertiary) outline-none hover:bg-(--bg-hover) focus-visible:ring-2 focus-visible:ring-(--focus-ring) active:cursor-grabbing"
        {...attributes}
        {...listeners}
      >
        <GripVertical aria-hidden className="size-4" strokeWidth={2} />
      </button>
      <span
        aria-hidden
        data-area={areaDataAttribute(lifeArea.color)}
        className="size-2 shrink-0 rounded-[2px] bg-(--area-solid)"
      />
      <span className="truncate">{lifeArea.title}</span>
    </li>
  );
}
