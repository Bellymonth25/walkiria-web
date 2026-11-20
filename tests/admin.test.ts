import { describe, expect, it } from "vitest";
import { productos } from "../src/data/productos";
import { fotosPlatillos } from "../src/data/galeria";
import { SITIO } from "../src/lib/galeria";
import {
  aDocumento,
  agrupar,
  cambios,
  fotosParaFicha,
  coincideNombre,
  evaluarSuperadmin,
  leerProducto,
  motivoDeError,
  nombreEnWeb,
  productoNuevo,
  siguienteId,
  textoModificacion,
  urlVista,
  validar,
} from "../src/lib/admin";

describe("súper panel", () => {
  it("lee un documento de products sin confiar en los tipos", () => {
    const p = leerProducto("PROD_001", { nombre: "Pavo Relleno", group: "aves", menudeo: 390, mayoreo: 375, tipoVenta: "Kg", categoria: "Comida", estaDisponible: true, isWeightAdjustable: true });
    expect(p).toMatchObject({ id: "PROD_001", nombre: "Pavo Relleno", grupo: "AVES", categoria: "Comida", menudeo: 390, mayoreo: 375, unidad: "Kg", disponible: true, oculto: false, pesoAjustable: true, maquila: false });
  });

  it("sin estaDisponible cuenta como agotado, igual que la app", () => {
    expect(leerProducto("X", { nombre: "X" }).disponible).toBe(false);
    expect(leerProducto("X", { group: "raro" }).grupo).toBe("OTROS");
    expect(leerProducto("X", { oculto: true }).oculto).toBe(true);
    expect(leerProducto("X", { menudeo: "caro" }).menudeo).toBe(0);
  });

  it("guarda con los nombres de campo de la app y solo lo que cambió", () => {
    const antes = leerProducto("PROD_001", { nombre: "Pavo", menudeo: 390, categoria: "Comida", group: "AVES", tipoVenta: "Kg", estaDisponible: true });
    const doc = aDocumento(antes);
    expect(doc).toMatchObject({ id: "PROD_001", nombre: "Pavo", menudeo: 390, group: "AVES", tipoVenta: "Kg", estaDisponible: true, oculto: false, isMaquila: false });
    expect(cambios(antes, { ...antes, menudeo: 400, oculto: true })).toEqual({ menudeo: 400, oculto: true });
    expect(cambios(antes, antes)).toEqual({});
  });

  it("agrupa comida por grupo y luego envíos y empaques", () => {
    const lista = [
      leerProducto("a", { nombre: "Romeritos", group: "GUARNICIONES" }),
      leerProducto("b", { nombre: "Pavo Relleno", group: "AVES" }),
      leerProducto("e", { nombre: "Envío Coyoacán", categoria: "Envio" }),
      leerProducto("c", { nombre: "Jamón", group: "CARNES" }),
      leerProducto("f", { nombre: "Charola chica", categoria: "Empaque" }),
      leerProducto("d", { nombre: "Pato", group: "AVES", estaDisponible: true }),
    ];
    expect(agrupar(lista, "").map(([g, ps]) => [g, ps.map((p) => p.id)])).toEqual([
      ["AVES", ["d", "b"]],
      ["CARNES", ["c"]],
      ["GUARNICIONES", ["a"]],
      ["ENVIO", ["e"]],
      ["EMPAQUE", ["f"]],
    ]);
    expect(agrupar(lista, "jamon")[0]![1][0]!.id).toBe("c");
  });

  it("da el siguiente id consecutivo", () => {
    expect(siguienteId(["PROD_001", "PROD_051", "PROD_009", "otro"])).toBe("PROD_052");
    expect(siguienteId([])).toBe("PROD_001");
  });

  it("valida la ficha antes de guardar", () => {
    const pavo = { ...productoNuevo("PROD_001"), nombre: "Pavo Relleno", menudeo: 390 };
    const nuevo = productoNuevo("PROD_052");
    expect(validar(nuevo, [pavo])).toContain("nombre");
    expect(validar({ ...nuevo, nombre: "pavo relleno ", menudeo: 1 }, [pavo])).toContain("Ya existe");
    expect(validar({ ...nuevo, nombre: "Costilla de Cerdo adobada" }, [pavo])).toContain("menudeo");
    expect(validar({ ...nuevo, nombre: "Costilla de Cerdo adobada", menudeo: 370, imagen: "http://x" }, [pavo])).toContain("https");
    expect(validar({ ...nuevo, nombre: "Costilla de Cerdo adobada", menudeo: 370 }, [pavo])).toBeNull();
    expect(validar(pavo, [pavo])).toBeNull();
  });

  it("sabe con qué nombre sale en la web", () => {
    expect(nombreEnWeb("PROD_018", productos)).toBe("Pechuga de Pavo");
    expect(nombreEnWeb("PROD_999", productos)).toBeNull();
  });

  it("solo entra el súper administrador y explica los errores", () => {
    expect(evaluarSuperadmin(true)).toEqual({ ok: true });
    expect(evaluarSuperadmin(false)).toMatchObject({ ok: false });
    expect(motivoDeError("permission-denied")).toContain("permission-denied");
    expect(motivoDeError("unavailable")).toContain("unavailable");
    expect(motivoDeError(undefined)).toContain("error desconocido");
  });
});

describe("última modificación", () => {
  it("lee el Timestamp de Firestore y arma el texto", () => {
    const f = new Date("2026-11-14T16:41:00Z");
    const p = leerProducto("PROD_001", { nombre: "Pavo", actualizadoEn: { toDate: () => f }, actualizadoPor: "carlos.belmont@lawalkiria.com.mx" });
    expect(p.actualizadoEn).toEqual(f);
    expect(textoModificacion(p)).toBe("Última modificación: 14 nov 2026, 10:41 por carlos.belmont@lawalkiria.com.mx.");
    expect(textoModificacion(leerProducto("X", {}))).toContain("Sin cambios");
    expect(leerProducto("X", { actualizadoEn: "ayer" }).actualizadoEn).toBeNull();
  });

  it("los sellos no cuentan como cambios de la ficha", () => {
    const a = leerProducto("X", { nombre: "X", menudeo: 1 });
    expect(cambios(a, { ...a, actualizadoEn: new Date(), actualizadoPor: "x" })).toEqual({});
  });
});

describe("eliminar", () => {
  it("pide escribir el nombre exacto", () => {
    expect(coincideNombre("Pavo Relleno", "Pavo Relleno")).toBe(true);
    expect(coincideNombre("  Pavo Relleno ", "Pavo Relleno")).toBe(true);
    expect(coincideNombre("pavo relleno", "Pavo Relleno")).toBe(false);
    expect(coincideNombre("Pavo", "Pavo Relleno")).toBe(false);
    expect(coincideNombre("", "")).toBe(false);
  });
});

describe("fotos en el súper panel", () => {
  const ST = "https://firebasestorage.googleapis.com/v0/b/x/o/a.jpg";

  it("sin fotos en Firestore, la ficha ofrece las de la página con la principal del pedido", () => {
    const p = leerProducto("PROD_001", { nombre: "Pavo Relleno", imagen: "https://otro-sitio.com/x.jpg" });
    const r = fotosParaFicha(p, productos, fotosPlatillos);
    expect(r.dePagina).toBe(true);
    expect(r.fotos.map((f) => f.url)).toEqual([`${SITIO}/img/galeria/pavo-relleno.jpg`, `${SITIO}/img/galeria/medio-pavo-relleno.jpg`]);
    expect(r.imagen).toBe(`${SITIO}/img/galeria/pavo-relleno.jpg`);
    // Solo en el primer id de la pechuga, para no repetirlas.
    expect(fotosParaFicha(leerProducto("PROD_018", {}), productos, fotosPlatillos).fotos).toEqual([]);
    expect(fotosParaFicha(leerProducto("PROD_017", {}), productos, fotosPlatillos).fotos).toHaveLength(2);
  });

  it("con fotos en Firestore manda el panel, aunque la lista esté vacía", () => {
    const p = leerProducto("PROD_009", { imagen: ST, fotos: [{ url: ST, forma: "v" }, { forma: "h" }] });
    expect(p.fotos).toEqual([{ url: ST, forma: "v" }]);
    expect(fotosParaFicha(p, productos, fotosPlatillos)).toEqual({ fotos: [{ url: ST, forma: "v" }], imagen: ST, dePagina: false });
    expect(fotosParaFicha(leerProducto("PROD_009", { fotos: [] }), productos, fotosPlatillos).fotos).toEqual([]);
  });

  it("solo manda las fotos a Firestore si cambiaron", () => {
    const a = leerProducto("PROD_009", { nombre: "Romeritos", menudeo: 290, imagen: ST, fotos: [{ url: ST, forma: "h" }] });
    expect(cambios(a, { ...a, fotos: [{ url: ST, forma: "h" }] })).toEqual({});
    expect(cambios(a, { ...a, fotos: [] })).toEqual({ fotos: [] });
  });

  it("pide marcar una principal cuando hay fotos", () => {
    const a = leerProducto("PROD_009", { nombre: "Romeritos", menudeo: 290, imagen: "", fotos: [{ url: ST, forma: "h" }] });
    expect(validar(a, [])).toMatch(/principal/);
    expect(validar({ ...a, imagen: ST }, [])).toBeNull();
  });

  it("las fotos de la página se ven desde el mismo sitio", () => {
    expect(urlVista(`${SITIO}/img/galeria/bacalao.jpg`)).toBe("/img/galeria/bacalao.jpg");
    expect(urlVista(ST)).toBe(ST);
  });
});
