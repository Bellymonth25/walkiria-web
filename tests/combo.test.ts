import { describe, expect, it } from "vitest";
import { productos } from "../src/data/productos";
import { aplicarCatalogo, type ProductoPublico } from "../src/lib/catalogo";
import { comboSeVende, desgloseCombo, importeCombo, personasCombo } from "../src/lib/combo";
import { aumentar, disminuir, empaquesDe, importeLinea, mensaje, nuevaLinea, textoCantidad } from "../src/lib/pedido";
import type { Pedido, RecetaPublica } from "../src/types";

const catalogo = aplicarCatalogo(productos, new Map());
const combo = catalogo.find((p) => p.id === "combo-pavo")!;

// ---------- Sin receta publicada: la configuración de la página ----------

describe("Combo Pavo (sin receta publicada)", () => {
  it("lleva pechuga, relleno y 2 piernas de 700 g", () => {
    const kg = (personas: number, clave: string) => desgloseCombo(combo, { cantidad: personas }).partes.find((x) => x.clave === clave)!.cantidad;
    expect(kg(4, "pechuga")).toBe(0.5);
    expect(kg(4, "relleno")).toBe(0.5);
    expect(kg(4, "piernas")).toBe(2);
    expect(kg(5, "pechuga")).toBe(0.625);
    expect(kg(2, "pechuga")).toBe(0.25); // mínimo 250 g
    expect(kg(3, "pechuga")).toBe(0.375); // de 125 en 125 g
    expect(desgloseCombo(combo, { cantidad: 9 }).personas).toBe(5); // nunca más del máximo
  });
  it("precio con los precios por kilo de cada parte, más una charola mediana", () => {
    // 0.5 × 590 + 0.5 × 400 + 1.4 × 200
    expect(importeCombo(combo, { cantidad: 4 })).toBe(775);
    const l = nuevaLinea(combo);
    expect(l.cantidad).toBe(4);
    expect(empaquesDe(combo, l)).toEqual([{ tamano: "mediana", piezas: 1, precio: 35 }]);
    expect(importeLinea(combo, l)).toBe(810);
    expect(textoCantidad(combo, l)).toBe("para 4 personas");
  });
  it("el precio sigue a Firestore", () => {
    const c = aplicarCatalogo(productos, new Map([
      ["PROD_032", { nombre: "Pierna", precio: 250, imagen: "", grupo: "AVES", unidad: "kg" }],
      ["PROD_060", { nombre: "Combo Pavo", precio: 1, imagen: "", grupo: "AVES", unidad: "Pza" }],
    ]));
    expect(c.find((p) => p.id === "combo-pavo")!.combo!.pierna).toBe(250);
  });
  it("+ y − entre 2 y 5 personas", () => {
    expect(aumentar(combo, 5)).toBe(5);
    expect(aumentar(combo, 4)).toBe(5);
    expect(disminuir(combo, 3)).toBe(2);
    expect(disminuir(combo, 2)).toBe(0);
  });
  it("a producción le llega el desglose con el precio de cada parte", () => {
    const pedido: Pedido = { lineas: { "combo-pavo-1": nuevaLinea(combo) }, nombre: "Ana", modo: "tienda", alcaldia: "", direccion: "", referencias: "", nota: "", fecha: "2026-12-23" };
    const m = mensaje(pedido, { catalogo, zonas: [], nombreDia: "Miércoles 23", tardio: false });
    expect(m).toContain("• Combo Pavo, para 4 personas: $775");
    expect(m).toContain("- Pechuga de pavo horneada 0.5 kg: $295");
    expect(m).toContain("- Relleno tradicional 0.5 kg: $200");
    expect(m).toContain("- Piernas de pavo horneadas 2 pzas (aprox. 700 g c/u): $280");
    expect(m).toContain("charola de aluminio: 1 charola mediana (+$35)");
    expect(m).toContain("varía según el peso de las piernas");
  });
});

// ---------- Con la receta que publica la app ----------

const receta: RecetaPublica = {
  personas: { minimo: 2, alAgregar: 4, maximo: 5 },
  redondeoKg: 0.125,
  empaque: { alAgregar: "CHAROLA_MEDIANA", permitidos: ["CHAROLA_CHICA", "CHAROLA_MEDIANA"] },
  instrucciones: "Todo el combo va en una sola charola.",
  componentes: [
    { clave: "pechuga", nombre: "Pechuga de pavo", opciones: ["PROD_019", "PROD_018"], alAgregar: "PROD_019", modo: "POR_PERSONA", cantidad: 0.125, unidad: "GRANEL", minimo: 0.25 },
    { clave: "relleno", nombre: "Relleno", opciones: ["PROD_012"], alAgregar: "PROD_012", modo: "POR_PERSONA", cantidad: 0.1, unidad: "GRANEL", minimo: 0.25 },
    { clave: "piernas", nombre: "Piernas de pavo", opciones: ["PROD_032"], alAgregar: "PROD_032", modo: "FIJA", cantidad: 2, unidad: "PIEZA", minimo: 0, kgPorPieza: 0.7, opcional: true },
  ],
};

const fs = (nombre: string, precio: number, extra: Partial<ProductoPublico> = {}): ProductoPublico => ({ nombre, precio, imagen: "", grupo: "AVES", unidad: "kg", ...extra });

const publico = (cambios: Record<string, Partial<ProductoPublico>> = {}, recetaUsada: RecetaPublica = receta): Map<string, ProductoPublico> =>
  new Map<string, ProductoPublico>([
    ["PROD_019", { ...fs("Pechuga de Pavo Horneada", 590), ...cambios.PROD_019 }],
    ["PROD_018", { ...fs("Pechuga de Pavo Adobada", 620), ...cambios.PROD_018 }],
    ["PROD_012", { ...fs("Relleno de Pavo", 400), ...cambios.PROD_012 }],
    ["PROD_032", { ...fs("Pierna de Pavo Horneada", 200), ...cambios.PROD_032 }],
    ["PROD_060", { ...fs("Combo Pavo", 0, { unidad: "Pza", receta: recetaUsada }), ...cambios.PROD_060 }],
  ]);

const conReceta = (cambios: Record<string, Partial<ProductoPublico>> = {}, agotados: string[] = []) => {
  const lista = aplicarCatalogo(productos, publico(cambios), new Set(agotados));
  return lista.find((p) => p.id === "combo-pavo")!;
};

describe("Combo Pavo con la receta de la app", () => {
  it("toma personas, cantidades y precios de la receta", () => {
    const p = conReceta();
    expect(p.receta!.partes.map((x) => x.clave)).toEqual(["pechuga", "relleno", "piernas"]);
    const d = desgloseCombo(p, { cantidad: 4 });
    expect(d.personas).toBe(4);
    expect(d.partes.map((x) => [x.nombre, x.cantidad, x.importe])).toEqual([
      ["Pechuga de Pavo Horneada", 0.5, 295],
      ["Relleno de Pavo", 0.5, 200],
      // Las piernas se cuentan por pieza pero se cobran por kilo: 2 × 700 g = 1.4 kg
      ["Pierna de Pavo Horneada", 2, 280],
    ]);
    expect(d.importe).toBe(775);
    expect(d.seVende).toBe(true);
  });

  it("respeta el mínimo y el máximo de personas de la receta", () => {
    const p = conReceta();
    expect(personasCombo(p, 1)).toBe(2);
    expect(personasCombo(p, 9)).toBe(5);
  });

  it("el cliente puede elegir otra versión de la pechuga", () => {
    const p = conReceta();
    const d = desgloseCombo(p, { cantidad: 4, comboVersiones: { pechuga: "PROD_018" } });
    expect(d.partes[0]!.nombre).toBe("Pechuga de Pavo Adobada");
    expect(d.partes[0]!.importe).toBe(310);
  });

  it("una versión agotada se marca y se usa la otra", () => {
    const p = conReceta({}, ["PROD_019"]);
    const pechuga = p.receta!.partes[0]!;
    expect(pechuga.opciones.map((o) => o.agotado ?? false)).toEqual([true, false]);
    const d = desgloseCombo(p, { cantidad: 4 });
    expect(d.partes[0]!.nombre).toBe("Pechuga de Pavo Adobada");
    expect(d.seVende).toBe(true);
    expect(comboSeVende(p)).toBe(true);
  });

  it("sin ninguna pechuga disponible el combo no se vende", () => {
    const p = conReceta({}, ["PROD_019", "PROD_018"]);
    expect(comboSeVende(p)).toBe(false);
    expect(desgloseCombo(p, { cantidad: 4 }).seVende).toBe(false);
  });

  it("sin piernas disponibles el combo se vende sin ellas", () => {
    const p = conReceta({}, ["PROD_032"]);
    expect(comboSeVende(p)).toBe(true);
    const d = desgloseCombo(p, { cantidad: 4 });
    expect(d.partes.filter((x) => x.incluida).length).toBe(2);
    expect(d.importe).toBe(495);
  });

  it("el cliente puede quitar las piernas", () => {
    const p = conReceta();
    const d = desgloseCombo(p, { cantidad: 4, comboQuitados: ["piernas"] });
    expect(d.partes.find((x) => x.clave === "piernas")!.incluida).toBe(false);
    expect(d.importe).toBe(495);
  });

  it("una receta incompleta se ignora y el combo sigue con la configuración de la página", () => {
    const p = conReceta({ PROD_060: { nombre: "Combo Pavo", precio: 0, imagen: "", grupo: "AVES", unidad: "Pza", receta: { ...receta, componentes: [] } } });
    expect(p.receta).toBeUndefined();
    // Sin receta, el precio de la pechuga sale del primer id del panel (la adobada, $620)
    expect(importeCombo(p, { cantidad: 4 })).toBe(790);
  });

  it("el mensaje lleva la versión elegida, lo que se quitó y las instrucciones", () => {
    const p = conReceta();
    const lista = aplicarCatalogo(productos, publico(), new Set());
    const linea = { ...nuevaLinea(p), comboVersiones: { pechuga: "PROD_018" }, comboQuitados: ["piernas"] };
    const pedido: Pedido = { lineas: { "combo-pavo-1": linea }, nombre: "Ana", modo: "tienda", alcaldia: "", direccion: "", referencias: "", nota: "", fecha: "2026-12-23" };
    const m = mensaje(pedido, { catalogo: lista, zonas: [], nombreDia: "Miércoles 23", tardio: false });
    expect(m).toContain("- Pechuga de Pavo Adobada 0.5 kg: $310");
    expect(m).toContain("- Sin pierna de pavo horneada");
    expect(m).toContain("Todo el combo va en una sola charola.");
    // Sin piernas ya no se avisa que el precio varía por su peso
    expect(m).not.toContain("varía según el peso");
  });
});
