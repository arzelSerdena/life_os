import { type ComponentPropsWithRef, useCallback, useEffect, useRef } from "react";

type ScrollElement = "div" | "main" | "ul" | "nav" | "section" | "fieldset";
type ScrollDirection = "vertical" | "horizontal" | "both";

type ScrollProps<T extends ScrollElement = "div"> = {
  as?: T;
  direction?: ScrollDirection;
  fade?: boolean;
} & Omit<ComponentPropsWithRef<T>, "as">;

const OVERFLOW_CLASS: Record<ScrollDirection, string> = {
  vertical: "overflow-y-auto",
  horizontal: "overflow-x-auto",
  both: "overflow-auto",
};

/**
 * Shared scrolling container (STYLE_GUIDE.md): scrollbars stay hidden globally, and a 16 px
 * CSS mask fade appears on any edge that has more content past it.
 */
export function Scroll<T extends ScrollElement = "div">({
  as,
  direction = "vertical",
  fade = true,
  className = "",
  ref,
  onScroll,
  children,
  ...rest
}: ScrollProps<T>) {
  const Tag = (as ?? "div") as "div";
  const localRef = useRef<HTMLDivElement | null>(null);

  const setRefs = useCallback(
    (node: HTMLDivElement | null) => {
      localRef.current = node;
      if (typeof ref === "function") {
        (ref as (el: HTMLDivElement | null) => void)(node);
      } else if (ref && typeof ref === "object" && "current" in ref) {
        (ref as { current: HTMLDivElement | null }).current = node;
      }
    },
    [ref],
  );

  const updateFades = useCallback(
    (el: HTMLElement | null) => {
      if (!el) return;
      const checkY = direction === "vertical" || direction === "both";
      const checkX = direction === "horizontal" || direction === "both";

      const fadeTop = checkY && el.scrollTop > 1;
      const fadeBottom = checkY && el.scrollTop + el.clientHeight < el.scrollHeight - 1;
      const fadeLeft = checkX && el.scrollLeft > 1;
      const fadeRight = checkX && el.scrollLeft + el.clientWidth < el.scrollWidth - 1;

      el.dataset.fadeTop = fadeTop ? "true" : "false";
      el.dataset.fadeBottom = fadeBottom ? "true" : "false";
      el.dataset.fadeLeft = fadeLeft ? "true" : "false";
      el.dataset.fadeRight = fadeRight ? "true" : "false";
    },
    [direction],
  );

  useEffect(() => {
    const el = localRef.current;
    if (!el) return;
    updateFades(el);

    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => updateFades(el));
    ro.observe(el);
    for (const child of Array.from(el.children)) {
      ro.observe(child);
    }

    const mo =
      typeof MutationObserver !== "undefined"
        ? new MutationObserver(() => {
            ro.disconnect();
            ro.observe(el);
            for (const child of Array.from(el.children)) {
              ro.observe(child);
            }
            updateFades(el);
          })
        : null;
    mo?.observe(el, { childList: true });

    return () => {
      ro.disconnect();
      mo?.disconnect();
    };
  }, [updateFades]);

  const handleScroll: React.UIEventHandler<HTMLDivElement> = (event) => {
    updateFades(event.currentTarget);
    (onScroll as React.UIEventHandler<HTMLDivElement> | undefined)?.(event);
  };

  return (
    <Tag
      ref={setRefs}
      onScroll={handleScroll}
      className={`${fade ? "scroll-fade " : ""}${OVERFLOW_CLASS[direction]} ${className}`}
      {...(rest as ComponentPropsWithRef<"div">)}
    >
      {children}
    </Tag>
  );
}
