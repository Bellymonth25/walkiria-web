import { describe, expect, it } from "vitest";
import { productos } from "../src/data/productos";
import { aplicarCatalogo } from "../src/lib/catalogo";
import { desgloseCombo, importeCombo } from "../src/lib/combo";
import { aumentar, disminuir, empaquesDe, importeLinea, mensaje, nuevaLinea, textoCantidad } from "../src/lib/pedido";
import type { Pedido } from "../src/types";

const catalogo = aplicarCatalogo(productos, new Map());
const combo = catalogo.find((p) => p.id === "combo-pavo")!;

describe("Combo Pavo", () => {
  it("lleva pechuga, relleno y 2 piernas de 700 g", () => {
    expect(desgloseCombo(4)).toEqual({ personas: 4, kgPechuga: 0.5, kgRelleno: 0.5, piernas: 2, kgPierna: 0.7 });
    expect(desgloseCombo(5)).toMatchObject({ kgPechuga: 0.625, kgRelleno: 0.5 });
    expect(desgloseCombo(2)).toMatchObject({ kgPechuga: 0.25, kgRelleno: 0.25 }); // mínimo 250 g
    expect(desgloseCombo(3)).toMatchObject({ kgPechuga: 0.375, kgRelleno: 0.375 }); // de 125 en 125 g
    expect(desgloseCombo(9).personas).toBe(5); // nunca más del máximo
  });
  it("precio con los precios por kilo de cada parte, más una charola mediana", () => {
    // 0.5 × 590 + 0.5 × 400 + 1.4 × 200
    expect(importeCombo(combo, 4)).toBe(775);
    const l = nuevaLinea(combo);
    expect(l.cantidad).toBe(4);
    expect(empaquesDe(combo, l)).toEqual([{ tamano: "mediana", piezas: 1, precio: 35 }]);
    expect(importeLinea(combo, l)).toBe(810);
    expect(textoCantidad(combo, l)).toBe("para 4 personas");
  });
  it("el precio sigue a Firestore", () => {
    const c = aplicarCatalogo(productos, new Map([["PROD_032", { nombre: "Pierna", precio: 250, imagen: "", grupo: "AVES", unidad: "kg", }]]));
    expect(c.find((p) => p.id === "combo-pavo")!.combo!.pierna).toBe(250);
  });
  it("+ y − entre 2 y 5 personas", () => {
    expect(aumentar(combo, 5)).toBe(5);
    expect(aumentar(combo, 4)).toBe(5);
    expect(disminuir(combo, 3)).toBe(2);
    expect(disminuir(combo, 2)).toBe(0);
  });
  it("a producción le llega el desglose", () => {
    const pedido: Pedido = { lineas: { "combo-pavo-1": nuevaLinea(combo) }, nombre: "Ana", modo: "tienda", alcaldia: "", direccion: "", referencias: "", nota: "", fecha: "2026-12-23" };
    const m = mensaje(pedido, { catalogo, zonas: [], nombreDia: "Miércoles 23", tardio: false });
    expect(m).toContain("• Combo Pavo, para 4 personas: $775");
    expect(m).toContain("Lleva: Pechuga de pavo horneada 0.5 kg, relleno tradicional 0.5 kg y 2 piernas de pavo horneadas (aprox. 700 g c/u)");
    expect(m).toContain("charola de aluminio: 1 charola mediana (+$35)");
    expect(m).toContain("varía según el peso de las piernas");
  });
});
