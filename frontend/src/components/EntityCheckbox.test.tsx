import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { EntityCheckbox } from "./EntityCheckbox";

describe("EntityCheckbox", () => {
  it("renders a square task checkbox with 24px hit area and toggles on click", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<EntityCheckbox checked={false} onChange={onChange} label="Mark Write docs done" />);

    const box = screen.getByRole("checkbox", { name: "Mark Write docs done" });
    expect(box).not.toBeChecked();
    expect(box.className).toContain("rounded-[4px]");

    await user.click(box);
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("renders a round routine-step checkbox when shape is round", () => {
    render(
      <EntityCheckbox checked shape="round" onChange={() => {}} label="Mark Stretch not done" />,
    );
    const box = screen.getByRole("checkbox", { name: "Mark Stretch not done" });
    expect(box).toBeChecked();
    expect(box.className).toContain("rounded-full");
  });
});
