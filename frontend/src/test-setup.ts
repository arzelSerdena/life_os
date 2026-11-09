import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";
import { client } from "./client/client.gen";

// Node's fetch can't use the relative URLs that the browser accepts.
client.setConfig({ baseUrl: "http://localhost" });

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
