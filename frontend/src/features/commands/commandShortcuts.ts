import { useEffect } from "react";
import { canUsePageKey, isModKey, isOverlayOpen } from "../../keyboard";
import { useCommands } from "../../stores/commandStore";

/**
 * Ctrl K (⌘ K) opens the command palette on every screen, even while typing, and closes it
 * again; it waits while another pop-up, picker or menu is open. `?` lists the shortcuts
 * outside text fields.
 */
export function useCommandShortcuts(): void {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const commands = useCommands.getState();
      if (isModKey(event, "k")) {
        // The browser would otherwise focus its own search.
        event.preventDefault();
        if (event.repeat) return;
        if (commands.open === "palette") commands.close();
        else if (commands.open === null && !isOverlayOpen()) commands.show("palette");
        return;
      }
      if (event.key === "?" && commands.open === null && canUsePageKey(event)) {
        event.preventDefault();
        commands.show("shortcuts");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}
