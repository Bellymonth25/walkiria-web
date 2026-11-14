import { describe, expect, it } from "vitest";
import { productos } from "../src/data/productos";
import { agrupar, leerProducto, nombreEnWeb } from "../src/lib/admin";

describe("admin de disponibilidad", () => {
  it("lee un documento de products sin confiar en los tipos", () => {
    const p = leerProducto("PROD_001", { nombre: "Pavo Relleno", group: "aves", menudeo: 390, tipoVenta: "Kg", estaDisponible: true });
    expect(p).toEqual({ id: "PROD_001", nombre: "Pavo Relleno", grupo: "AVES", precio: 390, unidad: "Kg", disponible: true });
  });

  it("sin estaDisponible cuenta como no disponible, igual que la app", () => {
    expect(leerProducto("X", { nombre: "X" }).disponible).toBe(false);
    expect(leerProducto("X", { group: "raro" }).grupo).toBe("OTROS");
  });

  it("agrupa en el orden de la app y busca sin acentos", () => {
    const lista = [
      leerProducto("a", { nombre: "Romeritos", group: "GUARNICIONES" }),
      leerProducto("b", { nombre: "Pavo Relleno", group: "AVES" }),
      leerProducto("c", { nombre: "Jamón", group: "CARNES" }),
      leerProducto("d", { nombre: "Pato", group: "AVES", estaDisponible: true }),
    ];
    expect(agrupar(lista, "").map(([g, ps]) => [g, ps.map((p) => p.id)])).toEqual([
      ["AVES", ["d", "b"]],
      ["CARNES", ["c"]],
      ["GUARNICIONES", ["a"]],
    ]);
    expect(agrupar(lista, "jamon")[0]![1][0]!.id).toBe("c");
  });

  it("sabe con qué nombre sale en la web", () => {
    expect(nombreEnWeb("PROD_018", productos)).toBe("Pechuga de Pavo");
    expect(nombreEnWeb("PROD_999", productos)).toBeNull();
  });
});
