import { describe, expect, it } from "vitest";
import { productos } from "../src/data/productos";
import { aplicarCatalogo, parsearCatalogo, type ProductoPublico } from "../src/lib/catalogo";
import { estiloEncuadre, normalizarEncuadre } from "../src/lib/encuadre";
import { cambios, leerProducto } from "../src/lib/admin";
import { SITIO } from "../src/lib/galeria";

const ST = "https://firebasestorage.googleapis.com/v0/b/x/o/a.jpg";
const STG = "https://firebasestorage.googleapis.com/v0/b/x/o/a-grande.jpg";
const pub = (p: Partial<ProductoPublico>): ProductoPublico => ({ nombre: "x", precio: 100, imagen: "", grupo: "", unidad: "Kg", ...p });

describe("encuadre de la foto principal", () => {
  it("normaliza: rangos, redondeo y el centro no se guarda", () => {
    expect(normalizarEncuadre({ x: 120, y: -4, zoom: 9 })).toEqual({ x: 100, y: 0, zoom: 3 });
    expect(normalizarEncuadre({ x: 33.333, y: 70, zoom: 1.234 })).toEqual({ x: 33.3, y: 70, zoom: 1.23 });
    expect(normalizarEncuadre({ x: 50, y: 50, zoom: 1 })).toBeUndefined();
    expect(normalizarEncuadre(undefined)).toBeUndefined();
  });

  it("estilo para la miniatura", () => {
    expect(estiloEncuadre(undefined)).toBe("");
    expect(estiloEncuadre({ x: 20, y: 80, zoom: 1 })).toBe("object-position:20% 80%;");
    expect(estiloEncuadre({ x: 20, y: 80, zoom: 2 })).toBe("object-position:20% 80%;transform:scale(2);transform-origin:20% 80%;");
  });

  it("la web toma encuadre y tamaño real de la foto principal", () => {
    const fotos = [{ url: ST, forma: "h" as const, grande: STG, encuadre: { x: 30, y: 60, zoom: 1.5 } }];
    const p = aplicarCatalogo(productos, new Map([["PROD_009", pub({ nombre: "Romeritos", imagen: ST, fotos })]])).find((x) => x.id === "romeritos")!;
    expect(p).toMatchObject({ imagen: ST, imagenMini: ST, imagenGrande: STG, encuadre: { x: 30, y: 60, zoom: 1.5 } });
  });

  it("con encuadre, la foto de la página deja su miniatura ya recortada", () => {
    const url = `${SITIO}/img/galeria/romeritos.jpg`;
    const p = aplicarCatalogo(productos, new Map([["PROD_009", pub({ nombre: "Romeritos", imagen: url, fotos: [{ url, forma: "h", encuadre: { x: 10, y: 50, zoom: 1 } }] })]])).find((x) => x.id === "romeritos")!;
    expect(p.imagenMini).toBe("img/galeria/romeritos.jpg");
  });

  it("lee encuadre y grande del documento REST", () => {
    const doc = { fields: { productos: { mapValue: { fields: { PROD_009: { mapValue: { fields: { nombre: { stringValue: "Romeritos" }, fotos: { arrayValue: { values: [
      { mapValue: { fields: { url: { stringValue: ST }, grande: { stringValue: STG }, encuadre: { mapValue: { fields: { x: { integerValue: "25" }, y: { doubleValue: 40.5 }, zoom: { doubleValue: 2 } } } } } } },
    ] } } } } } } } } } };
    expect(parsearCatalogo(doc).get("PROD_009")?.fotos).toEqual([{ url: ST, forma: "h", grande: STG, encuadre: { x: 25, y: 40.5, zoom: 2 } }]);
  });

  it("el panel lee el encuadre y lo manda solo si cambió", () => {
    const a = leerProducto("PROD_009", { imagen: ST, fotos: [{ url: ST, forma: "h", grande: STG, encuadre: { x: 30, y: 60, zoom: 1.5 } }] });
    expect(a.fotos[0]).toEqual({ url: ST, forma: "h", grande: STG, encuadre: { x: 30, y: 60, zoom: 1.5 } });
    expect(cambios(a, { ...a, fotos: [{ ...a.fotos[0]!, encuadre: { x: 30, y: 60, zoom: 1.5 } }] })).toEqual({});
    expect(Object.keys(cambios(a, { ...a, fotos: [{ url: ST, forma: "h", grande: STG }] }))).toEqual(["fotos"]);
  });
});
