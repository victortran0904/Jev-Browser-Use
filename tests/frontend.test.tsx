// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import App from "../src/App";

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("agent console", () => {
  it("shows only the chat composer, browser view, and chronological action log", () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => [] }));
    render(<App />);
    expect(screen.getByRole("textbox", { name: /message/i })).toBeVisible();
    expect(screen.getByText("Browser view")).toBeVisible();
    expect(screen.getByText("Action log")).toBeVisible();
    expect(screen.queryByText("Runs")).not.toBeInTheDocument();
  });

  it("allows partial start URL editing without crashing", () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => [] }));
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: /Context/ }));
    const input = screen.getByLabelText("Start URL");
    fireEvent.change(input, { target: { value: "h" } });
    expect(input).toHaveValue("h");
  });
});
