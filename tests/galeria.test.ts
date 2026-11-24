import { describe, expect, it } from "vitest";
import { productos } from "../src/data/productos";
import { fotosPlatillos } from "../src/data/galeria";
import { aplicarCatalogo, parsearCatalogo, type ProductoPublico } from "../src/lib/catalogo";
import { estaAgotado, estaOculto } from "../src/lib/disponibilidad";
import { armarGaleria, fotosDeLaPagina, mezclarSinRepetir, SITIO } from "../src/lib/galeria";

const STORAGE = (n: number) => `https://firebasestorage.googleapis.com/v0/b/x/o/productos%2FPROD_009%2F${n}.jpg?alt=media`;
const pub = (p: Partial<ProductoPublico>): ProductoPublico => ({ nombre: "x", precio: 100, imagen: "", grupo: "", unidad: "Kg", ...p });

function galeria(catalogo: Map<string, ProductoPublico>, agotados: string[] = [], ocultos: string[] = []) {
  const a = new Set(agotados);
  const o = new Set(ocultos);
  return armarGaleria(fotosPlatillos, aplicarCatalogo(productos, catalogo), { agotado: (p) => estaAgotado(p, a), oculto: (p) => estaOculto(p, o) });
}

describe("galería ligada a los productos", () => {
  it("sin cambios en el panel queda igual que la lista de la página", () => {
    const g = galeria(new Map());
    expect(g.map((f) => f.clave)).toEqual(fotosPlatillos.filter((f) => f.disponible !== false).map((f) => f.id));
    expect(g.every((f) => !f.agotado)).toBe(true);
  });

  it("producto oculto: sus fotos no salen", () => {
    const g = galeria(new Map(), [], ["PROD_001"]);
    expect(g.some((f) => f.clave === "pavo-relleno" || f.clave === "medio-pavo-relleno")).toBe(false);
    // Las de otros productos siguen.
    expect(g.some((f) => f.clave === "lomo-horneado")).toBe(true);
    expect(galeria(new Map(), [], ["PROD_055"]).some((f) => f.clave === "lomo-horneado")).toBe(false);
  });

  it("platillos que solo están en el panel (lechón): se ocultan y se marcan por su id de Firestore", () => {
    expect(galeria(new Map(), [], ["PROD_024"]).some((f) => f.clave === "lechon")).toBe(false);
    expect(galeria(new Map(), ["PROD_031"]).find((f) => f.clave === "codornices")?.agotado).toBe(true);
    // Ya con Firestore: el lechón llega como producto del panel y sigue ligado.
    const c = new Map([["PROD_024", pub({ nombre: "Lechón al Horno", precio: 2200 })]]);
    expect(galeria(c, [], ["PROD_024"]).some((f) => f.clave === "lechon")).toBe(false);
    expect(galeria(c).find((f) => f.clave === "lechon")?.agotado).toBe(false);
    expect(fotosDeLaPagina(fotosPlatillos, { firebaseId: "PROD_024" })).toEqual([{ url: `${SITIO}/img/galeria/lechon.jpg`, forma: "h" }]);
  });

  it("pechuga: se oculta solo si todas sus versiones están ocultas", () => {
    expect(galeria(new Map(), [], ["PROD_017"]).some((f) => f.clave === "pechuga-pavo-adobada")).toBe(true);
    expect(galeria(new Map(), [], ["PROD_017", "PROD_018", "PROD_019"]).some((f) => f.clave === "pechuga-pavo-adobada")).toBe(false);
  });

  it("producto agotado: sus fotos llevan la marca", () => {
    const g = galeria(new Map(), ["PROD_009"]);
    expect(g.find((f) => f.clave === "romeritos")?.agotado).toBe(true);
    expect(g.find((f) => f.clave === "bacalao")?.agotado).toBe(false);
  });

  it("fotos del panel reemplazan a las de la página, en el mismo lugar", () => {
    const c = new Map([["PROD_009", pub({ nombre: "Romeritos", imagen: STORAGE(2), fotos: [{ url: STORAGE(1), forma: "h" }, { url: STORAGE(2), forma: "v" }] })]]);
    const g = galeria(c);
    const i = g.findIndex((f) => f.url === STORAGE(1));
    const antes = fotosPlatillos.filter((f) => f.disponible !== false).findIndex((f) => f.id === "romeritos");
    expect(i).toBe(antes);
    expect(g[i + 1]).toMatchObject({ url: STORAGE(2), forma: "v", nombre: "Romeritos" });
    expect(g.some((f) => f.clave === "romeritos")).toBe(false);
  });

  it("si en el panel se quitaron todas, la foto de la página tampoco sale", () => {
    const g = galeria(new Map([["PROD_009", pub({ nombre: "Romeritos", fotos: [] })]]));
    expect(g.some((f) => f.nombre === "Romeritos")).toBe(false);
  });

  it("fotos de la página guardadas desde el panel se usan como ruta del sitio", () => {
    const url = `${SITIO}/img/galeria/romeritos.jpg`;
    const g = galeria(new Map([["PROD_009", pub({ nombre: "Romeritos", imagen: url, fotos: [{ url, forma: "h", ancha: true }] })]]));
    expect(g.find((f) => f.nombre === "Romeritos")).toMatchObject({ url: "img/galeria/romeritos.jpg", ancha: true });
  });

  it("un producto nuevo del panel con fotos se agrega al final", () => {
    const c = new Map([["PROD_044", pub({ nombre: "Baguette", grupo: "OTROS", fotos: [{ url: STORAGE(7), forma: "h" }] })]]);
    const g = galeria(c);
    expect(g.at(-1)).toMatchObject({ nombre: "Baguette", url: STORAGE(7) });
    expect(galeria(c, [], ["PROD_044"]).some((f) => f.nombre === "Baguette")).toBe(false);
  });

  it("la foto principal del panel es la del pedido; si es la de la página conserva su miniatura", () => {
    const url = `${SITIO}/img/galeria/romeritos.jpg`;
    const l = aplicarCatalogo(productos, new Map([["PROD_009", pub({ nombre: "Romeritos", imagen: url, fotos: [{ url, forma: "h" }] })]]));
    expect(l.find((p) => p.id === "romeritos")).toMatchObject({ imagen: "img/galeria/romeritos.jpg", imagenMini: "img/productos/romeritos-mini.webp" });
    const l2 = aplicarCatalogo(productos, new Map([["PROD_009", pub({ nombre: "Romeritos", imagen: "", fotos: [] })]]));
    expect(l2.find((p) => p.id === "romeritos")?.imagen).toBeUndefined();
  });

  it("lee fotos del documento REST y descarta las de otros sitios", () => {
    const doc = {
      fields: {
        productos: {
          mapValue: {
            fields: {
              PROD_009: {
                mapValue: {
                  fields: {
                    nombre: { stringValue: "Romeritos" },
                    fotos: {
                      arrayValue: {
                        values: [
                          { mapValue: { fields: { url: { stringValue: STORAGE(1) }, forma: { stringValue: "v" }, carrusel: { booleanValue: false } } } },
                          { mapValue: { fields: { url: { stringValue: "https://otro.com/a.jpg" } } } },
                        ],
                      },
                    },
                  },
                },
              },
              PROD_001: { mapValue: { fields: { nombre: { stringValue: "Pavo" }, fotos: { arrayValue: {} } } } },
              PROD_008: { mapValue: { fields: { nombre: { stringValue: "Bacalao" } } } },
            },
          },
        },
      },
    };
    const c = parsearCatalogo(doc);
    expect(c.get("PROD_009")?.fotos).toEqual([{ url: STORAGE(1), forma: "v", carrusel: false }]);
    expect(c.get("PROD_001")?.fotos).toEqual([]);
    expect(c.get("PROD_008")?.fotos).toBeUndefined();
  });

  it("fotos de la página para un producto, con dirección completa", () => {
    expect(fotosDeLaPagina(fotosPlatillos, { productoWeb: "pavo-relleno", firebaseId: "PROD_001" })).toEqual([
      { url: `${SITIO}/img/galeria/pavo-relleno.jpg`, forma: "h", ancha: true },
      { url: `${SITIO}/img/galeria/medio-pavo-relleno.jpg`, forma: "v" },
    ]);
  });
});

describe("mezclar la galería", () => {
  // Azar repetible para que la prueba no dependa de la suerte.
  const semilla = (n: number) => () => ((n = (n * 16807) % 2147483647) - 1) / 2147483646;
  const fotos = ["a", "a", "a", "b", "b", "b", "c", "c", "d", "d", "e", "f"].map((nombre, i) => ({ nombre, i }));

  it("no deja dos fotos seguidas del mismo producto (tampoco al dar la vuelta)", () => {
    for (let s = 1; s <= 200; s++) {
      const m = mezclarSinRepetir(fotos, (f) => f.nombre, semilla(s));
      expect(m).toHaveLength(fotos.length);
      expect(new Set(m.map((f) => f.i)).size).toBe(fotos.length);
      m.forEach((f, i) => expect(f.nombre).not.toBe(m[(i + 1) % m.length]!.nombre));
    }
  });

  it("cambia el orden entre visitas", () => {
    const ordenes = new Set([1, 2, 3, 4, 5].map((s) => mezclarSinRepetir(fotos, (f) => f.nombre, semilla(s)).map((f) => f.i).join(",")));
    expect(ordenes.size).toBeGreaterThan(1);
  });

  it("si un producto tiene casi todas las fotos, las separa lo más posible", () => {
    const m = mezclarSinRepetir(["a", "a", "a", "b"].map((nombre, i) => ({ nombre, i })), (f) => f.nombre, semilla(7));
    expect(m).toHaveLength(4);
  });
});
