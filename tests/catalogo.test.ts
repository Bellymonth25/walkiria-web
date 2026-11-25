import { describe, expect, it } from "vitest";
import { productos } from "../src/data/productos";
import { aplicarCatalogo, esFotoPropia, parsearCatalogo, type ProductoPublico } from "../src/lib/catalogo";

const pub = (p: Partial<ProductoPublico> & { nombre: string }): ProductoPublico => ({ precio: 0, imagen: "", grupo: "", unidad: "Kg", ...p });
const buscar = (lista: { id: string }[], id: string) => lista.find((p) => p.id === id) as (typeof productos)[number];
const STORAGE = "https://firebasestorage.googleapis.com/v0/b/x/o/productos%2FPROD_001%2F1.jpg?alt=media";

describe("catálogo desde Firestore", () => {
  it("lee el mapa productos del documento REST", () => {
    const doc = {
      fields: {
        productos: {
          mapValue: {
            fields: {
              PROD_001: { mapValue: { fields: { nombre: { stringValue: "Pavo Relleno" }, precio: { integerValue: "420" }, imagen: { stringValue: "" }, grupo: { stringValue: "AVES" }, unidad: { stringValue: "Kg" } } } },
              PROD_009: { mapValue: { fields: { nombre: { stringValue: "Romeritos" }, precio: { doubleValue: 299.5 } } } },
            },
          },
        },
      },
    };
    const c = parsearCatalogo(doc);
    expect(c.get("PROD_001")).toMatchObject({ nombre: "Pavo Relleno", precio: 420, grupo: "AVES" });
    expect(c.get("PROD_009")?.precio).toBe(299.5);
    expect(parsearCatalogo({}).size).toBe(0);
  });

  it("sin Firestore deja la lista de la web igual", () => {
    expect(aplicarCatalogo(productos, new Map())).toEqual([...productos]);
  });

  it("toma precio, nombre y foto propia de Firestore", () => {
    const c = new Map([
      ["PROD_001", pub({ nombre: "Pavo Relleno Tradicional", precio: 420, imagen: STORAGE })],
      ["PROD_017", pub({ nombre: "Pechuga Horneada", precio: 600 })],
      ["PROD_005", pub({ nombre: "Lomo Mechado (app)", precio: 450 })],
      ["PROD_008", pub({ nombre: "Bacalao", precio: 830, imagen: "https://otro-sitio.com/bacalao.jpg" })],
    ]);
    const l = aplicarCatalogo(productos, c);
    expect(buscar(l, "pavo-relleno")).toMatchObject({ nombre: "Pavo Relleno Tradicional", precio: 420, imagen: STORAGE, imagenMini: STORAGE });
    // Con versiones o familia se queda el nombre de la web, pero el precio sí cambia.
    expect(buscar(l, "pechuga-pavo")).toMatchObject({ nombre: "Pechuga de Pavo", precio: 600 });
    expect(buscar(l, "lomo-mechado")).toMatchObject({ nombre: "Lomo Mechado", precio: 450 });
    // Foto de relleno de otro sitio: se queda la de la web.
    expect(buscar(l, "bacalao").imagen).toBe(buscar([...productos], "bacalao").imagen);
  });

  it("liga por nombre un producto de la web sin id y agrega lo que la web no tiene", () => {
    const c = new Map([
      ["PROD_058", pub({ nombre: "Costilla de Cerdo Adobada", precio: 380, grupo: "CARNES" })],
      ["PROD_060", pub({ nombre: "combo pavo", precio: 1, grupo: "AVES", unidad: "Pza" })],
      ["PROD_026", pub({ nombre: "Gravy", precio: 75, grupo: "GUARNICIONES", unidad: "Lt" })],
      ["PROD_044", pub({ nombre: "Baguette", precio: 30, grupo: "OTROS", unidad: "Pza" })],
      ["PROD_099", pub({ nombre: "Sin precio", precio: 0 })],
    ]);
    const l = aplicarCatalogo(productos, c);
    expect(buscar(l, "costilla-adobada")).toMatchObject({ firebaseIds: ["PROD_058"], precio: 380 });
    expect(l.filter((p) => /costilla de cerdo adobada/i.test(p.nombre))).toHaveLength(1);
    // El combo se liga por nombre (sin importar mayúsculas) y su precio sigue saliendo de sus partes.
    expect(buscar(l, "combo-pavo")).toMatchObject({ firebaseIds: ["PROD_060"] });
    expect(l.find((p) => p.id === "fs-prod_060")).toBeUndefined();
    expect(buscar(l, "fs-prod_026")).toMatchObject({ nombre: "Gravy", categoria: "guarn", unidad: "pza", precio: 75, firebaseIds: ["PROD_026"] });
    expect(buscar(l, "fs-prod_044")).toMatchObject({ categoria: "otros", unidad: "pza" });
    expect(buscar(l, "fs-prod_099")).toBeUndefined();
  });

  it("solo acepta fotos subidas a Storage", () => {
    expect(esFotoPropia(STORAGE)).toBe(true);
    expect(esFotoPropia("https://www.cocinavital.mx/pavo.jpg")).toBe(false);
    expect(esFotoPropia("")).toBe(false);
  });
});

describe("productos eliminados en el panel", () => {
  it("un producto de la web cuyo id ya no está en Firestore no sale", () => {
    const c = new Map([["PROD_025", pub({ nombre: "Strudel de Manzana", precio: 520 })]]);
    const l = aplicarCatalogo(productos, c);
    expect(l.find((p) => p.id === "chapata")).toBeUndefined();
    expect(l.find((p) => p.id === "strudel")).toBeDefined();
  });

  it("un producto de la web que no está en Firestore no sale (el combo, si no se ha dado de alta)", () => {
    const l = aplicarCatalogo(productos, new Map([["PROD_025", pub({ nombre: "Strudel de Manzana", precio: 520 })]]));
    expect(l.find((p) => p.id === "combo-pavo")).toBeUndefined();
    expect(l.find((p) => p.id === "costilla-adobada")).toBeUndefined();
    expect(l.map((p) => p.id)).toEqual(["strudel"]);
  });

  it("sin datos de Firestore se usa la lista de la web completa", () => {
    expect(aplicarCatalogo(productos, new Map()).find((p) => p.id === "combo-pavo")).toBeDefined();
  });

  it("con versiones, basta con que quede uno de sus ids y solo salen sus versiones", () => {
    const l = aplicarCatalogo(productos, new Map([["PROD_030", pub({ nombre: "Espagueti a las Finas Hierbas", precio: 250 })]]));
    expect(buscar(l, "espagueti")).toMatchObject({ versiones: ["A las finas hierbas"], descripcion: "A las finas hierbas." });
  });

  it("versiones de la pechuga: cada una sigue a su id; la oculta no sale", () => {
    const c = new Map([
      ["PROD_017", pub({ nombre: "Pechuga de Pavo Mechada", precio: 590 })],
      ["PROD_018", pub({ nombre: "Pechuga de Pavo Adobada", precio: 590, oculto: true })],
      ["PROD_019", pub({ nombre: "Pechuga de Pavo Horneada", precio: 590 })],
      ["PROD_020", pub({ nombre: "Pechuga de Pavo Ahumada", precio: 590, grupo: "CARNES" })],
    ]);
    const l = aplicarCatalogo(productos, c);
    expect(buscar(l, "pechuga-pavo")).toMatchObject({ versiones: ["Horneada", "Mechada", "Ahumada"], descripcion: "Horneada, mechada o ahumada." });
    // La ahumada ya no sale suelta (antes caía en Cerdo).
    expect(l.find((p) => p.id === "fs-prod_020")).toBeUndefined();
  });

  it("lee oculto del documento publicado", () => {
    const doc = { fields: { productos: { mapValue: { fields: { PROD_018: { mapValue: { fields: { nombre: { stringValue: "X" }, oculto: { booleanValue: true } } } } } } } } };
    expect(parsearCatalogo(doc).get("PROD_018")?.oculto).toBe(true);
  });
});
