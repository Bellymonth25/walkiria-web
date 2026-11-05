import { describe, expect, it } from "vitest";
import type { Pedido } from "../src/types";
import { productos } from "../src/data/productos";
import { temporada } from "../src/data/temporada";
import { aumentar, disminuir, faltantes, mensaje, total } from "../src/lib/pedido";
import { esPedidoTardio, nombreDia } from "../src/lib/fechas";

const base: Pedido = { cantidades: {}, nombre: "", modo: "tienda", zona: 0, direccion: "", referencias: "", dia: 3 };
const ctx = { catalogo: productos, zonas: temporada.zonas, nombreDia: "Miércoles 23 de diciembre", tardio: false };

describe("cantidades", () => {
  it("el primer toque agrega 1 y luego sube de medio kilo", () => {
    expect(aumentar(0, "kg")).toBe(1);
    expect(aumentar(1, "kg")).toBe(1.5);
    expect(aumentar(2, "pza")).toBe(3);
  });
  it("al llegar a 0 el producto sale del pedido", () => {
    expect(disminuir(0.5, "kg")).toBe(0);
    expect(disminuir(1, "pza")).toBe(0);
  });
});

describe("total", () => {
  it("suma productos y envío solo si es a domicilio", () => {
    const p: Pedido = { ...base, cantidades: { "pavo-relleno": 3, romeritos: 1 } };
    expect(total(p, productos, temporada.zonas)).toBe(3 * 390 + 280);
    expect(total({ ...p, modo: "domicilio", zona: 2 }, productos, temporada.zonas)).toBe(3 * 390 + 280 + 200);
  });
});

describe("faltantes", () => {
  it("pide dirección solo a domicilio", () => {
    const p: Pedido = { ...base, cantidades: { bacalao: 1 }, nombre: "Ana" };
    expect(faltantes(p, productos)).toEqual([]);
    expect(faltantes({ ...p, modo: "domicilio" }, productos)).toEqual(["la dirección de entrega"]);
  });
  it("un pedido vacío pide producto y nombre", () => {
    expect(faltantes(base, productos)).toEqual(["al menos un producto", "tu nombre"]);
  });
});

describe("mensaje de WhatsApp", () => {
  it("pone el nombre primero e incluye la dirección a domicilio", () => {
    const m = mensaje(
      { ...base, cantidades: { "pavo-relleno": 1.5 }, nombre: " Ana López ", modo: "domicilio", zona: 0, direccion: "Calle 1", referencias: "" },
      ctx,
    );
    expect(m.split("\n")[1]).toBe("Nombre: Ana López");
    expect(m).toContain("• 1,5 kg de Pavo Relleno ($585)");
    expect(m).toContain("Dirección: Calle 1");
    expect(m).not.toContain("Referencias");
    expect(m).toContain("Total estimado: $685 (incluye envío $100)");
  });
});

describe("fechas", () => {
  it("calcula el día de la semana del año", () => {
    expect(nombreDia(2026, 24)).toBe("Jueves 24 de diciembre");
  });
  it("marca como tardío solo después del día límite y antes de Navidad", () => {
    expect(esPedidoTardio(new Date(2026, 11, 22, 18), 2026, 22)).toBe(false);
    expect(esPedidoTardio(new Date(2026, 11, 23, 9), 2026, 22)).toBe(true);
    expect(esPedidoTardio(new Date(2026, 11, 26), 2026, 22)).toBe(false);
  });
});
