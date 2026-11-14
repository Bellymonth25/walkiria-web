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
      ["PROD_052", pub({ nombre: "Costilla de Cerdo adobada", precio: 380, grupo: "CARNES" })],
      ["PROD_026", pub({ nombre: "Gravy", precio: 75, grupo: "GUARNICIONES", unidad: "Lt" })],
      ["PROD_044", pub({ nombre: "Baguette", precio: 30, grupo: "OTROS", unidad: "Pza" })],
      ["PROD_099", pub({ nombre: "Sin precio", precio: 0 })],
    ]);
    const l = aplicarCatalogo(productos, c);
    expect(buscar(l, "costilla-adobada")).toMatchObject({ firebaseIds: ["PROD_052"], precio: 380 });
    expect(l.filter((p) => p.nombre === "Costilla de Cerdo adobada")).toHaveLength(1);
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
