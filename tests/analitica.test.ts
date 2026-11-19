import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllGlobals();
});

function navegadorFalso() {
  const agregados: { src: string; async: boolean }[] = [];
  const doc = {
    createElement: () => ({ src: "", async: false }),
    head: { appendChild: (s: { src: string; async: boolean }) => agregados.push(s) },
    addEventListener: () => {},
  };
  const win: { clarity?: ((...a: unknown[]) => void) & { q?: unknown[][] } } = {};
  vi.stubGlobal("document", doc);
  vi.stubGlobal("window", win);
  return { agregados, win };
}

describe("analítica (Clarity)", () => {
  it("sin ID no carga nada", async () => {
    const { agregados, win } = navegadorFalso();
    const { iniciarAnalitica, evento } = await import("../src/lib/analitica");
    iniciarAnalitica("", true);
    expect(agregados).toHaveLength(0);
    expect(() => evento("producto_agregado")).not.toThrow();
    expect(win.clarity).toBeUndefined();
  });

  it("en desarrollo no carga aunque haya ID", async () => {
    const { agregados } = navegadorFalso();
    const { iniciarAnalitica } = await import("../src/lib/analitica");
    iniciarAnalitica("abc123", false);
    expect(agregados).toHaveLength(0);
  });

  it("con ID carga el script una vez y encola los eventos", async () => {
    const { agregados, win } = navegadorFalso();
    const { iniciarAnalitica, evento } = await import("../src/lib/analitica");
    iniciarAnalitica("abc123", true);
    iniciarAnalitica("abc123", true);
    expect(agregados).toEqual([{ src: "https://www.clarity.ms/tag/abc123", async: true }]);
    evento("pedido_whatsapp");
    expect(win.clarity?.q).toEqual([["event", "pedido_whatsapp"]]);
  });
});
