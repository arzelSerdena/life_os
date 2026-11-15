import { Button } from "@heroui/react";
import type { ReactNode } from "react";

type IconButtonProps = {
  /** Read by screen readers; icon buttons have no visible text. */
  label: string;
  children: ReactNode;
  onPress?: () => void;
  isDisabled?: boolean;
  /** sm = 24 px (sidebar), md = 28 px (headers). 24 px is the smallest hit area. */
  size?: "sm" | "md";
};

/** A borderless icon button with a grey hover, as in the mock-ups. */
export function IconButton({ label, children, onPress, isDisabled, size = "sm" }: IconButtonProps) {
  return (
    <Button
      isIconOnly
      variant="ghost"
      aria-label={label}
      onPress={onPress}
      isDisabled={isDisabled}
      className={`${size === "sm" ? "size-6 [&_svg]:size-3.5" : "size-7 [&_svg]:size-4"} min-w-0 rounded-(--icon-button-bg-radius) text-(--text-tertiary) hover:bg-(--icon-button-hover) [&_svg]:stroke-2`}
    >
      {children}
    </Button>
  );
}
