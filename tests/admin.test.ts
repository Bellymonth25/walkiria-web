import { describe, expect, it } from "vitest";
import { productos } from "../src/data/productos";
import { fotosPlatillos } from "../src/data/galeria";
import { SITIO } from "../src/lib/galeria";
import {
  aDocumento,
  cambiarVisibilidad,
  visibilidad,
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
  componenteNuevo,
  asignarClaves,
  leerReceta,
  recetaNueva,
  validarReceta,
  vistaPreviaReceta,
  type ProductoFirestore,
  type RecetaAdmin,
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
    expect(urlVista(`${SITIO}/img/galeria/bacalao.jpg`)).toBe("img/galeria/bacalao.jpg");
    expect(urlVista(ST)).toBe(ST);
  });
});

describe("dónde sale cada foto", () => {
  const url = "https://firebasestorage.googleapis.com/v0/b/x/o/a.jpg";
  it("un toque pasa de visible a solo galería, a oculta y de vuelta a visible", () => {
    const a = { url, forma: "h" as const, ancha: true };
    const b = cambiarVisibilidad(a);
    const c = cambiarVisibilidad(b);
    const d = cambiarVisibilidad(c);
    expect([a, b, c, d].map(visibilidad)).toEqual(["todo", "galeria", "nada", "todo"]);
    expect(c).toEqual({ url, forma: "h", ancha: true, carrusel: false, galeria: false });
    expect(d).toEqual(a);
  });

  it("se guarda y se vuelve a leer igual", () => {
    expect(leerProducto("PROD_009", { fotos: [{ url, forma: "h", galeria: false, carrusel: false }] }).fotos).toEqual([{ url, forma: "h", carrusel: false, galeria: false }]);
  });
});

// ---------- Recetas (combos) ----------

const prod = (id: string, nombre: string, menudeo: number, unidad = "kg"): ProductoFirestore => ({
  ...productoNuevo(id),
  nombre,
  menudeo,
  mayoreo: Math.max(0, menudeo - 40),
  unidad,
});

const catalogoCombo: ProductoFirestore[] = [
  prod("PROD_019", "Pechuga de Pavo Horneada", 590),
  prod("PROD_018", "Pechuga de Pavo Adobada", 620),
  prod("PROD_012", "Relleno de Pavo", 400),
  prod("PROD_032", "Pierna de Pavo Horneada", 200),
];

const recetaCombo = (): RecetaAdmin => ({
  ...recetaNueva(),
  instrucciones: "Todo el combo va en una sola charola.",
  componentes: [
    { ...componenteNuevo(), clave: "pechuga", nombre: "Pechuga de pavo", opciones: ["PROD_019", "PROD_018"], alAgregar: "PROD_019" },
    { ...componenteNuevo(), clave: "relleno", nombre: "Relleno", opciones: ["PROD_012"], alAgregar: "PROD_012", cantidad: 0.1 },
    { ...componenteNuevo(), clave: "piernas", nombre: "Piernas de pavo", opciones: ["PROD_032"], alAgregar: "PROD_032", modo: "FIJA", cantidad: 2, unidad: "PIEZA", minimo: 0, kgPorPieza: 0.7, opcional: true },
  ],
});

describe("receta en el súper panel", () => {
  it("lee la receta de Firestore y descarta lo que no sirve", () => {
    const r = leerReceta({
      personas: { minimo: 2, alAgregar: 4, maximo: 5 },
      redondeoKg: 0.125,
      empaque: { alAgregar: "CHAROLA_MEDIANA", permitidos: ["CHAROLA_CHICA", "CHAROLA_MEDIANA", 7] },
      instrucciones: "Una sola charola.",
      componentes: [{ clave: "pechuga", nombre: "Pechuga", opciones: ["PROD_019", 5], alAgregar: "PROD_999", modo: "RARO", cantidad: 0.125, unidad: "KILOS", minimo: 0.25 }],
    });
    expect(r!.empaque.permitidos).toEqual(["CHAROLA_CHICA", "CHAROLA_MEDIANA"]);
    expect(r!.componentes[0]!.opciones).toEqual(["PROD_019"]);
    // Si el que entra ya no está entre las opciones, se usa la primera
    expect(r!.componentes[0]!.alAgregar).toBe("PROD_019");
    expect(r!.componentes[0]!.modo).toBe("POR_PERSONA");
    expect(r!.componentes[0]!.unidad).toBe("GRANEL");
    expect(leerReceta(null)).toBeNull();
    expect(leerReceta("combo")).toBeNull();
  });

  it("un producto normal no tiene receta y se guarda como null", () => {
    const p = productoNuevo("PROD_061");
    expect(p.receta).toBeNull();
    expect(aDocumento(p).receta).toBeNull();
  });

  it("la receta se guarda y el diff la detecta", () => {
    const antes = { ...prod("PROD_060", "Combo Pavo", 0, "Pza") };
    const despues = { ...antes, receta: recetaCombo() };
    expect(Object.keys(cambios(antes, despues))).toEqual(["receta"]);
    expect((aDocumento(despues).receta as RecetaAdmin).componentes).toHaveLength(3);
    // Y al dejar de ser combo se limpia
    expect(cambios(despues, antes).receta).toBeNull();
  });

  it("avisa lo que falta antes de guardar", () => {
    const base = recetaCombo();
    expect(validarReceta(base, catalogoCombo)).toBeNull();
    expect(validarReceta({ ...base, componentes: [] }, catalogoCombo)).toMatch(/al menos una parte/);
    expect(validarReceta({ ...base, personas: { minimo: 4, alAgregar: 4, maximo: 2 } }, catalogoCombo)).toMatch(/máximo/);
    expect(validarReceta({ ...base, personas: { minimo: 2, alAgregar: 9, maximo: 5 } }, catalogoCombo)).toMatch(/entre el mínimo y el máximo/);
    expect(validarReceta({ ...base, redondeoKg: 0 }, catalogoCombo)).toMatch(/redondeo/);
    expect(validarReceta({ ...base, empaque: { alAgregar: "ACRILICO", permitidos: ["CHAROLA_CHICA"] } }, catalogoCombo)).toMatch(/empaque con el que entra/);
    expect(validarReceta({ ...base, empaque: { alAgregar: "ACRILICO", permitidos: [] } }, catalogoCombo)).toMatch(/al menos un empaque/);
    const sinNombre = { ...base, componentes: [{ ...base.componentes[0]!, nombre: " " }] };
    expect(validarReceta(sinNombre, catalogoCombo)).toMatch(/Ponle nombre a la parte 1/);
    const sinOpciones = { ...base, componentes: [{ ...base.componentes[0]!, opciones: [], alAgregar: "" }] };
    expect(validarReceta(sinOpciones, catalogoCombo)).toMatch(/Elige los productos/);
    const productoBorrado = { ...base, componentes: [{ ...base.componentes[0]!, opciones: ["PROD_777"] }] };
    expect(validarReceta(productoBorrado, catalogoCombo)).toMatch(/PROD_777 ya no existe/);
    const sinCantidad = { ...base, componentes: [{ ...base.componentes[0]!, cantidad: 0 }] };
    expect(validarReceta(sinCantidad, catalogoCombo)).toMatch(/cantidad/);
    const piezasAMedias = { ...base, componentes: [{ ...base.componentes[2]!, cantidad: 1.5 }] };
    expect(validarReceta(piezasAMedias, catalogoCombo)).toMatch(/número entero/);
  });

  it("un combo se puede guardar sin precio propio", () => {
    const combo = { ...prod("PROD_060", "Combo Pavo", 0, "Pza"), receta: recetaCombo() };
    expect(validar(combo, catalogoCombo)).toBeNull();
    expect(validar({ ...combo, receta: null }, catalogoCombo)).toMatch(/mayor a 0/);
  });

  it("la vista previa dice qué lleva y cuánto cuesta", () => {
    const v = vistaPreviaReceta(recetaCombo(), 4, catalogoCombo);
    // 0.5 kg de pechuga + 0.5 kg de relleno (mínimo 250 g, de 125 en 125) + 2 piernas de 700 g
    expect(v.texto).toBe("Para 4: Pechuga de Pavo Horneada 0.5 kg · Relleno de Pavo 0.5 kg · Pierna de Pavo Horneada 2 pzas (aprox. 1.4 kg) (opcional)");
    // 295 + 200 + 1.4 × 200
    expect(v.total).toBe(775);
    // Nunca pasa del máximo de personas de la receta
    expect(vistaPreviaReceta(recetaCombo(), 9, catalogoCombo).texto).toContain("Para 5:");
  });
});

describe("asignarClaves", () => {
  it("saca la clave del nombre, sin acentos, y no repite", () => {
    const r = asignarClaves({
      ...recetaNueva(),
      componentes: [
        { ...componenteNuevo(), nombre: "Pechuga de pavo" },
        { ...componenteNuevo(), nombre: "Pechuga extra" },
        { ...componenteNuevo(), nombre: "Puré de papa" },
        { ...componenteNuevo(), nombre: "" },
      ],
    });
    expect(r.componentes.map((c) => c.clave)).toEqual(["pechuga", "pechuga2", "pure", "parte"]);
  });

  it("una parte guardada conserva su clave aunque cambie de nombre", () => {
    const r = asignarClaves({
      ...recetaNueva(),
      componentes: [
        { ...componenteNuevo(), clave: "relleno", nombre: "Relleno de manzana" },
        { ...componenteNuevo(), nombre: "Relleno tradicional" },
      ],
    });
    expect(r.componentes.map((c) => c.clave)).toEqual(["relleno", "relleno2"]);
  });
});
