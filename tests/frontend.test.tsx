// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "../src/App";

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
beforeEach(() => {
  vi.stubGlobal("matchMedia", vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })));
});

describe("agent console", () => {
  it("shows the centered task composer without status or log headings", () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => [] }));
    render(<App />);
    expect(screen.getByRole("textbox", { name: /message/i })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Give Jev a task" })).toBeVisible();
    expect(screen.queryByText("Browser view")).not.toBeInTheDocument();
    expect(screen.queryByText("Action log")).not.toBeInTheDocument();
    expect(screen.queryByText("Complete")).not.toBeInTheDocument();
  });

  it("clears displayed actions without deleting the backend run", async () => {
    const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => [{ id: "run-1", goal: "Browse", status: "complete", events: [{ id: 1, type: "plan", at: "2026-09-16T12:00:00Z", message: "Open the page" }] }] });
    vi.stubGlobal("fetch", fetch);
    render(<App />);
    expect(await screen.findByText("Open the page")).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "Clear action log" }));

    await waitFor(() => expect(screen.queryByText("Open the page")).not.toBeInTheDocument());
    expect(screen.queryByText("Actions will appear here.")).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Task activity" })).not.toBeInTheDocument();
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("uses the prompt alone instead of a hardcoded start URL", () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => [] }));
    render(<App />);
    expect(screen.queryByLabelText("Start URL")).not.toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Ask Jev/)).toBeVisible();
  });

  it("sends the InputBar content to the existing run endpoint", async () => {
    const fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => [] })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: "run-2", goal: "Open Amazon", status: "complete", events: [] }) });
    vi.stubGlobal("fetch", fetch);
    render(<App />);

    const input = screen.getByRole("textbox", { name: /message/i });
    fireEvent.change(input, { target: { value: "Open Amazon" } });
    fireEvent.keyDown(input, { key: "Enter" });

    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
    expect(fetch).toHaveBeenLastCalledWith("/api/runs", expect.objectContaining({
      method: "POST",
      body: JSON.stringify({ goal: "Open Amazon" }),
    }));
  });

  it("updates events from SSE without refetching the full run", async () => {
    let messageListener: ((e: { data: string }) => void) | undefined;
    class MockEventSource {
      url: string;
      constructor(url: string) {
        this.url = url;
      }
      set onmessage(fn: (e: { data: string }) => void) {
        messageListener = fn;
      }
      close() {}
    }
    vi.stubGlobal("EventSource", MockEventSource);

    const fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [{ id: "run-live", goal: "Live stream", status: "running", events: [] }],
    });
    vi.stubGlobal("fetch", fetch);

    render(<App />);
    expect(await screen.findByRole("status", { name: /solving/i })).toBeVisible();
    expect(fetch).toHaveBeenCalledTimes(1); // initial mount refresh only

    act(() => {
      messageListener?.({
        data: JSON.stringify({
          id: 1,
          type: "action",
          at: new Date().toISOString(),
          message: "Navigated directly to flights",
        }),
      });
    });

    expect(await screen.findByText("Navigated directly to flights")).toBeVisible();
    // Verify fetch was NOT called again to refresh
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
