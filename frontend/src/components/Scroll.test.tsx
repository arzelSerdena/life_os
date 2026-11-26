import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Scroll } from "./Scroll";

describe("Scroll", () => {
  it("sets vertical fade attributes based on scroll position", () => {
    render(
      <Scroll data-testid="scroller" direction="vertical">
        <div>Content</div>
      </Scroll>,
    );
    const el = screen.getByTestId("scroller");
    Object.defineProperty(el, "scrollHeight", { value: 400, configurable: true });
    Object.defineProperty(el, "clientHeight", { value: 200, configurable: true });
    Object.defineProperty(el, "scrollTop", { value: 0, writable: true, configurable: true });

    fireEvent.scroll(el);
    expect(el.dataset.fadeTop).toBe("false");
    expect(el.dataset.fadeBottom).toBe("true");
    expect(el.dataset.fadeLeft).toBe("false");
    expect(el.dataset.fadeRight).toBe("false");

    el.scrollTop = 100;
    fireEvent.scroll(el);
    expect(el.dataset.fadeTop).toBe("true");
    expect(el.dataset.fadeBottom).toBe("true");

    el.scrollTop = 200;
    fireEvent.scroll(el);
    expect(el.dataset.fadeTop).toBe("true");
    expect(el.dataset.fadeBottom).toBe("false");
  });

  it("sets horizontal fade attributes when direction is horizontal", () => {
    render(
      <Scroll data-testid="scroller" direction="horizontal">
        <div>Wide content</div>
      </Scroll>,
    );
    const el = screen.getByTestId("scroller");
    Object.defineProperty(el, "scrollWidth", { value: 600, configurable: true });
    Object.defineProperty(el, "clientWidth", { value: 300, configurable: true });
    Object.defineProperty(el, "scrollLeft", { value: 0, writable: true, configurable: true });

    fireEvent.scroll(el);
    expect(el.dataset.fadeLeft).toBe("false");
    expect(el.dataset.fadeRight).toBe("true");

    el.scrollLeft = 150;
    fireEvent.scroll(el);
    expect(el.dataset.fadeLeft).toBe("true");
    expect(el.dataset.fadeRight).toBe("true");

    el.scrollLeft = 300;
    fireEvent.scroll(el);
    expect(el.dataset.fadeLeft).toBe("true");
    expect(el.dataset.fadeRight).toBe("false");
  });

  it("supports rendering as a semantic element", () => {
    render(
      <Scroll as="main" aria-label="Content">
        <p>Hello</p>
      </Scroll>,
    );
    expect(screen.getByRole("main", { name: "Content" })).toBeInTheDocument();
  });
});
