import { describe, expect, it } from "vitest";
import type { Linea, Pedido, Producto } from "../src/types";
import { pavoPermitido } from "../src/lib/calculadora";
import { productos } from "../src/data/productos";
import { temporada } from "../src/data/temporada";
import {
  resumenEmpaques, aumentar, conRellenoSugerido, disminuir, empaquesDe, rellenoSugerido, faltantes, idLinea, importeLinea, mensaje, nombreLinea, normalizarCantidad, normalizarKgPavo, nuevaLinea, total, alcaldiaValida, zonaDe,
} from "../src/lib/pedido";
import { esPedidoTardio, nombreDia } from "../src/lib/fechas";
import { estaAgotado, estaOculto, parsearAgotados, parsearOcultos } from "../src/lib/disponibilidad";
import { fechaElegible, sinDomicilio, tipoDeFecha } from "../src/lib/entrega";

const prod = (id: string): Producto => productos.find((p) => p.id === id)!;
const lomo = prod("lomo-adobado");
const pavoR = prod("pavo-relleno");
const strudel = prod("strudel");
const linea = (p: Producto, cambios: Partial<Linea> = {}): Linea => ({ ...nuevaLinea(p), ...cambios });
const base: Pedido = { lineas: {}, nombre: "", modo: "tienda", alcaldia: "", direccion: "", referencias: "", nota: "", fecha: "2026-12-23" };
const ctx = { catalogo: productos, zonas: temporada.zonas, nombreDia: "Miércoles 23 de diciembre", tardio: false };

describe("líneas nuevas", () => {
  it("los pavos empiezan completos y en bolsa o caja; todos desde 6 kg", () => {
    expect(nuevaLinea(pavoR)).toMatchObject({ cantidad: 1, tamano: "completo", kgPorPavo: 6, presentacion: "bolsa" });
    expect(nuevaLinea(prod("pavo-adobado"))).toMatchObject({ cantidad: 1, tamano: "completo", kgPorPavo: 6, presentacion: "bolsa" });
  });
  it("lo demás empieza en acrílico", () => {
    expect(nuevaLinea(lomo).presentacion).toBe("acrilico");
  });
});

describe("cantidades", () => {
  it("+ y − de medio kilo; en piezas y pavos de uno en uno", () => {
    expect(aumentar(lomo, 1)).toBe(1.5);
    expect(aumentar(pavoR, 1)).toBe(2);
    expect(disminuir(lomo, 0.5)).toBe(0);
    expect(disminuir(strudel, 1)).toBe(0);
  });
  it("lo escrito a mano se limpia", () => {
    expect(normalizarCantidad(lomo, 1.333)).toBe(1.33);
    expect(normalizarCantidad(lomo, 0.1)).toBe(0.25);
    expect(normalizarCantidad(strudel, 2.6)).toBe(3);
    expect(normalizarCantidad(lomo, -1)).toBeNull();
    expect(normalizarKgPavo(prod("pavo-adobado"), 4)).toBe(6);
    expect(normalizarKgPavo(prod("pavo-adobado"), 6.3)).toBe(6.5);
    // Todos los pavos empiezan en 6 kg.
    expect(normalizarKgPavo(prod("pavo-relleno"), 5)).toBe(6);
    expect(normalizarKgPavo(prod("pavo-relleno"), 6.3)).toBe(6.5);
    expect(nuevaLinea(prod("pavo-relleno")).kgPorPavo).toBe(6);
    expect(nuevaLinea(prod("pavo-ahumado")).kgPorPavo).toBe(6);
  });
});

describe("empaques", () => {
  it("acrílico y bolsa no cuestan", () => {
    expect(empaquesDe(lomo, linea(lomo, { cantidad: 3 }))).toEqual([]);
  });
  it("elige el tamaño por kilos y reparte si no cabe", () => {
    expect(empaquesDe(lomo, linea(lomo, { cantidad: 1, presentacion: "charola" }))[0]).toMatchObject({ tamano: "chica", piezas: 1 });
    expect(empaquesDe(lomo, linea(lomo, { cantidad: 2, presentacion: "charola" }))[0]).toMatchObject({ tamano: "mediana", piezas: 1 });
    expect(empaquesDe(lomo, linea(lomo, { cantidad: 4, presentacion: "vacio" }))[0]).toMatchObject({ tamano: "grande", piezas: 1 });
    // 6 kg → 2 charolas grandes de 3 kg
    expect(empaquesDe(lomo, linea(lomo, { cantidad: 6, presentacion: "charola" }))[0]).toMatchObject({ tamano: "grande", piezas: 2 });
    // 4.5 kg → 2 de 2.25 kg = medianas
    expect(empaquesDe(lomo, linea(lomo, { cantidad: 4.5, presentacion: "charola" }))[0]).toMatchObject({ tamano: "mediana", piezas: 2 });
  });
  it("suma el empaque al importe", () => {
    expect(importeLinea(lomo, linea(lomo, { cantidad: 6, presentacion: "charola" }))).toBe(6 * 440 + 2 * 40);
  });
});

describe("pavos", () => {
  it("completo usa los kilos por pavo; medio usa 3.5 kg de estimado", () => {
    expect(importeLinea(pavoR, linea(pavoR, { cantidad: 2, kgPorPavo: 6 }))).toBe(2 * 6 * 400);
    expect(importeLinea(pavoR, linea(pavoR, { tamano: "medio" }))).toBe(3.5 * 400);
  });
});

describe("total y faltantes", () => {
  it("suma envío solo a domicilio", () => {
    const p: Pedido = { ...base, lineas: { "lomo-adobado": linea(lomo, { cantidad: 2 }) } };
    expect(total(p, productos, temporada.zonas)).toBe(880);
    expect(total({ ...p, modo: "domicilio", alcaldia: "Azcapotzalco" }, productos, temporada.zonas)).toBe(1080);
    expect(total({ ...p, modo: "domicilio", alcaldia: "Coyoacán" }, productos, temporada.zonas)).toBe(980);
    expect(total({ ...p, modo: "tienda", alcaldia: "Azcapotzalco" }, productos, temporada.zonas)).toBe(880);
    expect(total({ ...p, modo: "domicilio", alcaldia: "otra" }, productos, temporada.zonas)).toBe(880);
  });
  it("pide día y dirección cuando aplica", () => {
    const p: Pedido = { ...base, lineas: { bacalao: linea(prod("bacalao")) }, nombre: "Ana", fecha: null };
    expect(faltantes(p, productos)).toEqual(["el día de entrega"]);
    expect(faltantes({ ...p, fecha: "2026-12-22", modo: "domicilio" }, productos)).toEqual(["tu alcaldía", "la dirección de entrega"]);
    expect(faltantes({ ...p, fecha: "2026-12-22", modo: "domicilio", alcaldia: "Tlalpan", direccion: "Clavel 3" }, productos)).toEqual([]);
  });
});

describe("mensaje de WhatsApp", () => {
  it("lleva nombre, presentación, nota y total", () => {
    const m = mensaje(
      {
        ...base,
        nombre: " Ana López ",
        nota: "Ensalada sin apio",
        lineas: {
          "pavo-relleno": linea(pavoR, { tamano: "medio" }),
          "lomo-adobado": linea(lomo, { cantidad: 6, presentacion: "charola" }),
        },
      },
      ctx,
    );
    expect(m.split("\n")[1]).toBe("Nombre: Ana López");
    expect(m).toContain("• Pavo Relleno, 1 medio pavo (3 a 4 kg): $1,400");
    expect(m).toContain("Va en bolsa o caja de cartón (sin costo)");
    expect(m).toContain("• Lomo Adobado, 6 kg: $2,640");
    expect(m).toContain("Va en charola de aluminio: 2 charolas grandes (+$80)");
    // El total se explica: productos + charolas
    expect(m).toContain("Productos: $4,040");
    expect(m).toContain("Charolas de aluminio (2): $80");
    expect(m).toContain("Nota del pedido: Ensalada sin apio");
    expect(m).toContain("Total estimado: $4,120");
  });
});

describe("fechas", () => {
  it("calcula el día de la semana del año", () => {
    expect(nombreDia(2026, 24)).toBe("Jueves 24 de diciembre");
  });
  it("marca como tardío solo después del día límite y antes de Navidad", () => {
    const limites = [22, 29];
    expect(esPedidoTardio(new Date(2026, 11, 22, 18), 2026, limites)).toBe(false);
    expect(esPedidoTardio(new Date(2026, 11, 23, 9), 2026, limites)).toBe(true);
    expect(esPedidoTardio(new Date(2026, 11, 26), 2026, limites)).toBe(false);
    expect(esPedidoTardio(new Date(2026, 11, 29, 20), 2026, limites)).toBe(false);
    expect(esPedidoTardio(new Date(2026, 11, 30, 9), 2026, limites)).toBe(true);
  });
});

describe("agotados", () => {
  it("lee el documento de Firestore", () => {
    const doc = { fields: { agotados: { arrayValue: { values: [{ stringValue: "PROD_001" }, { stringValue: "PROD_017" }] } } } };
    expect([...parsearAgotados(doc)]).toEqual(["PROD_001", "PROD_017"]);
    expect([...parsearAgotados({})]).toEqual([]);
    expect([...parsearOcultos(doc)]).toEqual([]);
    const conOcultos = { fields: { ocultos: { arrayValue: { values: [{ stringValue: "PROD_001" }] } } } };
    expect([...parsearOcultos(conOcultos)]).toEqual(["PROD_001"]);
    expect(estaOculto(pavoR, new Set(["PROD_001"]))).toBe(true);
    expect(estaOculto(pavoR, new Set())).toBe(false);
  });
  it("un producto con varios ids solo se agota si todos lo están", () => {
    const pechuga = prod("pechuga-pavo");
    expect(estaAgotado(pechuga, new Set(["PROD_017"]))).toBe(false);
    expect(estaAgotado(pechuga, new Set(["PROD_017", "PROD_018", "PROD_019", "PROD_020"]))).toBe(true);
    expect(estaAgotado(pavoR, new Set(["PROD_001"]))).toBe(true);
  });
});

describe("maquila", () => {
  const maq = prod("maquila");
  it("empieza en 0 kg y no se quita al bajar a 0", () => {
    expect(nuevaLinea(maq).cantidad).toBe(0);
    expect(disminuir(maq, 0.5)).toBe(0);
    expect(aumentar(maq, 0)).toBe(0.5);
  });
  it("sugiere el relleno según el peso del pavo, salvo que el cliente lo cambie", () => {
    expect(rellenoSugerido(6)).toBe(1);
    expect(rellenoSugerido(7)).toBe(1);
    expect(rellenoSugerido(8)).toBe(1.5);
    expect(rellenoSugerido(11)).toBe(2);
    expect(conRellenoSugerido(linea(maq, { cantidad: 8.5 })).kgRelleno).toBe(1.5);
    expect(conRellenoSugerido(linea(maq, { cantidad: 8.5, kgRelleno: 3, rellenoManual: true })).kgRelleno).toBe(3);
  });
  it("se cobra por kilo y el pavo relleno suma su relleno", () => {
    expect(importeLinea(maq, linea(maq, { cantidad: 4, tipoMaquila: "Lomo Mechado" }))).toBe(4 * 170);
    expect(importeLinea(maq, linea(maq, { cantidad: 6, tipoMaquila: "Pavo Relleno", kgRelleno: 1.5 }))).toBe(6 * 170 + 1.5 * 400);
  });
  it("pide qué carne trae, y en Otro que lo especifique", () => {
    const p: Pedido = { ...base, nombre: "Ana", lineas: { "maquila-1": linea(maq) } };
    expect(faltantes(p, productos)).toEqual(["qué carne nos trae para la maquila", "el peso aproximado de su carne"]);
    const otro: Pedido = { ...p, lineas: { "maquila-1": linea(maq, { tipoMaquila: "Otro", cantidad: 3 }) } };
    expect(faltantes(otro, productos)).toEqual(["qué carne nos trae para la maquila"]);
    const listo: Pedido = { ...p, lineas: { "maquila-1": linea(maq, { tipoMaquila: "Otro", otroMaquila: "Cabrito", cantidad: 3 }) } };
    expect(faltantes(listo, productos)).toEqual([]);
  });
  it("varias maquilas con su nota en el mensaje", () => {
    const m = mensaje(
      {
        ...base,
        nombre: "Ana",
        fecha: "2026-12-30",
        lineas: {
          "maquila-1": linea(maq, { cantidad: 6, tipoMaquila: "Pavo Relleno", kgRelleno: 1, nota: "Poca sal" }),
          "maquila-2": linea(maq, { cantidad: 3, tipoMaquila: "Otro", otroMaquila: "Cabrito" }),
        },
      },
      { ...ctx, nombreDia: "Miércoles 30 de diciembre", diaSujeto: true },
    );
    expect(m).toContain("• Maquila de Pavo Relleno, aprox. 6 kg: $1,420");
    expect(m).toContain("   Con 1 kg de relleno");
    expect(m).toContain("   Nota: Poca sal");
    expect(m).toContain("• Maquila de Cabrito, aprox. 3 kg: $510");
    expect(m).toContain("Llevaré la carne para la maquila a la tienda al menos 2 días antes de la entrega.");
    expect(m).toContain("Día: Miércoles 30 de diciembre (sujeto a disponibilidad)");
    expect(m).not.toContain("Va en");
  });
});

describe("reglas de entrega", () => {
  const hoy = new Date(2026, 10, 6, 20); // 6 de noviembre, 8 pm
  it("marca los días especiales de diciembre", () => {
    expect(tipoDeFecha("2026-12-23", temporada)).toBe("sujeto");
    expect(tipoDeFecha("2026-12-30", temporada)).toBe("sujeto");
    expect(tipoDeFecha("2026-12-31", temporada)).toBe("tienda");
    expect(tipoDeFecha("2026-11-23", temporada)).toBeUndefined();
  });
  it("se puede elegir de hoy al 31 de diciembre", () => {
    expect(fechaElegible("2026-11-05", hoy, temporada)).toBe(false);
    // Pedidos en línea con 2 días de anticipación
    expect(fechaElegible("2026-11-06", hoy, temporada)).toBe(false);
    expect(fechaElegible("2026-11-07", hoy, temporada)).toBe(false);
    expect(fechaElegible("2026-11-08", hoy, temporada)).toBe(true);
    expect(fechaElegible("2026-12-31", hoy, temporada)).toBe(true);
    expect(fechaElegible("2027-01-01", hoy, temporada)).toBe(false);
  });
  it("a domicilio: no el 24 ni el 31, y con 3 días de aviso", () => {
    expect(sinDomicilio("2026-12-24", hoy, temporada)).toBe("tienda");
    expect(sinDomicilio("2026-11-07", hoy, temporada)).toBe("aviso");
    expect(sinDomicilio("2026-11-08", hoy, temporada)).toBe("aviso");
    expect(sinDomicilio("2026-11-09", hoy, temporada)).toBeNull();
  });
});

describe("varios pavos y patos", () => {
  it("cada pavo es su propia línea, con su propio peso", () => {
    const pedido = {
      lineas: {
        "pavo-relleno-1": linea(pavoR, { kgPorPavo: 7 }),
        "pavo-relleno-2": linea(pavoR, { kgPorPavo: 9, presentacion: "charola" as const }),
      },
      nombre: "Ana", modo: "tienda" as const, alcaldia: "", direccion: "", referencias: "", nota: "", fecha: "2026-12-23",
    };
    expect(total(pedido, productos, [])).toBe(7 * 400 + 9 * 400 + 40);
    const m = mensaje(pedido, { catalogo: productos, zonas: [], nombreDia: "Miércoles 23 de diciembre", tardio: false });
    expect(m).toContain("• Pavo Relleno, 1 pavo completo (aprox. 7 kg): $2,800");
    expect(m).toContain("• Pavo Relleno, 1 pavo completo (aprox. 9 kg): $3,600");
  });

  it("el pato se pide por pieza y se cobra por su peso aproximado", () => {
    const pato = prod("pato-naranja");
    const l = linea(pato, { cantidad: 2 });
    expect(importeLinea(pato, l)).toBe(2 * 2 * 500);
    expect(l.presentacion).toBe("bolsa");
    expect(aumentar(pato, 2)).toBe(3);
    expect(normalizarCantidad(pato, 1.4)).toBe(1);
    expect(empaquesDe(pato, linea(pato, { cantidad: 2, presentacion: "charola" }))).toEqual([{ tamano: "mediana", piezas: 2, precio: 35 }]);
  });
});

import { calcularCena, combinarPavos, pavosCena, pavosPara, redondearKg, repartirCarne } from "../src/lib/calculadora";

describe("calculadora de cena", () => {
  it("redondea hacia arriba al cuarto de kilo", () => {
    expect(redondearKg(0)).toBe(0);
    expect(redondearKg(1.5)).toBe(1.5);
    expect(redondearKg(1.51)).toBe(1.75);
  });
  it("todos cuentan igual: 10 personas", () => {
    const c = calcularCena(10);
    expect(c.personas).toBe(10);
    expect(c.equivalentes).toBe(10);
    expect(c.carne).toBe(1.5); // 10 × 150 g
    expect(c.romeritos).toBe(0.5); // 10 × 50 g
    expect(c.panes).toBe(10);
    expect([c.strudelGrande, c.strudelIndividual]).toEqual([1, 0]);
  });
  it("cena para 4: 600 g de carne", () => {
    expect(calcularCena(4)).toMatchObject({ carne: 0.75, pasta: 0.75, strudelGrande: 0, strudelIndividual: 4 });
  });
  it("postre: strudel grande por cada 10, el resto individual", () => {
    expect(calcularCena(13)).toMatchObject({ strudelGrande: 1, strudelIndividual: 3 });
    expect(calcularCena(8)).toMatchObject({ strudelGrande: 1, strudelIndividual: 0 });
  });
  it("reparte la carne en partes iguales de al menos 250 g", () => {
    expect(repartirCarne(1.5, 2)).toEqual([0.75, 0.75]);
    expect(repartirCarne(1, 3)).toEqual([0.5, 0.5, 0.5]);
    expect(repartirCarne(0.25, 2)).toEqual([0.25, 0.25]);
    expect(repartirCarne(0, 2)).toEqual([]);
  });
  it("reparte la carne en pavos de máximo 9 kg", () => {
    expect(pavosPara(3)).toEqual([{ tamano: "medio", kgPorPavo: 6 }]);
    expect(pavosPara(5.5, 6)).toEqual([{ tamano: "medio", kgPorPavo: 6 }]);
    // El ahumado no tiene medio pavo: si pide poco, se le da uno completo del mínimo.
    expect(pavosPara(3, 6, false)).toEqual([{ tamano: "completo", kgPorPavo: 6 }]);
    expect(pavosPara(7.2, 6)).toEqual([{ tamano: "completo", kgPorPavo: 7.5 }]);
    expect(pavosPara(7.2)).toEqual([{ tamano: "completo", kgPorPavo: 7.5 }]);
    expect(pavosPara(14)).toEqual([{ tamano: "completo", kgPorPavo: 7 }, { tamano: "completo", kgPorPavo: 7 }]);
  });
});

describe("versiones (pechuga, pierna, espagueti)", () => {
  const pechuga = prod("pechuga-pavo");
  it("cada versión es su propia línea", () => {
    expect(idLinea(pechuga, "Horneada")).toBe("pechuga-pavo~horneada");
    expect(idLinea(pechuga, "Adobada")).not.toBe(idLinea(pechuga, "Horneada"));
    expect(idLinea(prod("espagueti"), "En salsa de 3 quesos")).toBe("espagueti~en-salsa-de-3-quesos");
    expect(idLinea(lomo)).toBe("lomo-adobado");
  });
  it("el nombre en el pedido lleva la versión", () => {
    expect(nombreLinea(pechuga, nuevaLinea(pechuga, "Adobada"))).toBe("Pechuga de Pavo adobada");
    expect(nuevaLinea(pechuga, "Inventada").version).toBe("");
    expect(nombreLinea(lomo, nuevaLinea(lomo))).toBe("Lomo Adobado");
  });
  it("el mensaje separa las versiones", () => {
    const p: Pedido = {
      ...base,
      nombre: "Ana",
      lineas: {
        [idLinea(pechuga, "Horneada")]: { ...nuevaLinea(pechuga, "Horneada"), cantidad: 0.5 },
        [idLinea(pechuga, "Adobada")]: { ...nuevaLinea(pechuga, "Adobada"), cantidad: 0.5 },
      },
    };
    const m = mensaje(p, ctx);
    expect(m).toContain("Pechuga de Pavo horneada, 0.5 kg");
    expect(m).toContain("Pechuga de Pavo adobada, 0.5 kg");
  });
});

describe("zonas de envío", () => {
  it("cada alcaldía está en una sola zona y Santa Fe va en Norte", () => {
    const todas = temporada.zonas.flatMap((z) => z.alcaldias);
    expect(new Set(todas).size).toBe(todas.length);
    expect(zonaDe("Santa Fe", temporada.zonas)?.nombre).toBe("Zona Norte");
    expect(zonaDe("Magdalena Contreras", temporada.zonas)?.costo).toBe(100);
    expect(zonaDe("Milpa Alta", temporada.zonas)).toBeUndefined();
  });
  it("solo guarda alcaldías conocidas u \"otra\"", () => {
    expect(alcaldiaValida("Iztapalapa", temporada.zonas)).toBe("Iztapalapa");
    expect(alcaldiaValida("otra", temporada.zonas)).toBe("otra");
    expect(alcaldiaValida("Narnia", temporada.zonas)).toBe("");
    expect(alcaldiaValida(2, temporada.zonas)).toBe("");
  });
  it("el mensaje lleva alcaldía y zona, o pide confirmar el envío", () => {
    const p: Pedido = { ...base, lineas: { "lomo-adobado": linea(lomo, { cantidad: 2 }) }, nombre: "Ana", modo: "domicilio", direccion: "Calle 1" };
    const ctxZ = { ...ctx, zonas: temporada.zonas };
    expect(mensaje({ ...p, alcaldia: "Coyoacán" }, ctxZ)).toContain("Entrega: A domicilio, Coyoacán (Zona Sur)");
    const otra = mensaje({ ...p, alcaldia: "otra" }, ctxZ);
    expect(otra).toContain("otra zona");
    expect(otra).toContain("Total estimado: $880 más envío por confirmar");
  });
});

describe("desglose de empaques", () => {
  it("junta charolas y bolsas al vacío por tipo, con productos aparte", () => {
    const pedido: Pedido = {
      ...base,
      lineas: {
        "lomo-adobado": linea(lomo, { cantidad: 6, presentacion: "charola" }),
        "pavo-relleno": linea(pavoR, { tamano: "medio", presentacion: "vacio" }),
      },
    };
    const r = resumenEmpaques(pedido, productos);
    const charolas = r.empaques.find((e) => e.presentacion === "charola")!;
    expect(charolas.piezas).toBe(2);
    expect(charolas.importe).toBe(80);
    expect(charolas.tamanos).toBe("2 grandes");
    expect(r.empaques.find((e) => e.presentacion === "vacio")?.nombre).toBe("Bolsas al vacío");
    const suma = r.empaques.reduce((a, e) => a + e.importe, 0);
    expect(r.productos + suma).toBeCloseTo(total(pedido, productos, []), 2);
  });

  it("sin empaques con costo no hay desglose", () => {
    const r = resumenEmpaques({ ...base, lineas: { "lomo-adobado": linea(lomo, { cantidad: 2 }) } }, productos);
    expect(r.empaques).toEqual([]);
  });
});

describe("pavo en la calculadora", () => {
  const pavo = (id: string) => productos.find((x) => x.id === id)!;
  it("no se ofrece en cenas de 4, desde 6 solo medio y el ahumado desde 10", () => {
    expect(pavoPermitido(pavo("pavo-relleno"), 4)).toBe(false);
    expect(pavoPermitido(pavo("pavo-relleno"), 6)).toBe(true);
    expect(pavoPermitido(pavo("pavo-ahumado"), 6)).toBe(false);
    expect(pavoPermitido(pavo("pavo-ahumado"), 10)).toBe(true);
    expect(pavoPermitido(pavo("pechuga-pavo"), 4)).toBe(true);
  });
});

describe("pavo por número de personas", () => {
  const medio = [{ tamano: "medio", kgPorPavo: 6 }];
  const completo = (kg: number, n = 1) => Array.from({ length: n }, () => ({ tamano: "completo", kgPorPavo: kg }));
  it("de 6 a 8 personas, medio pavo", () => {
    for (const n of [6, 7, 8]) expect(pavosCena(n, n, 1, 6, true)).toEqual(medio);
  });
  it("de 9 en adelante, pavo entero de 0.55 kg por persona y mínimo 6 kg", () => {
    expect(pavosCena(9, 9, 1, 6, true)).toEqual(completo(6));
    expect(pavosCena(10, 10, 1, 6, true)).toEqual(completo(6));
    expect(pavosCena(11, 11, 1, 6, true)).toEqual(completo(6.5));
    expect(pavosCena(12, 12, 1, 6, true)).toEqual(completo(7));
    expect(pavosCena(14, 14, 1, 6, true)).toEqual(completo(8));
  });
  it("si pasa de 9 kg se reparte en dos pavos", () => {
    expect(pavosCena(16, 16, 1, 6, true)).toEqual(completo(9)); // 8.8 kg → un pavo de 9
    // Se prefiere un pavo y un medio pavo antes que dos pavos que sobren mucho.
    expect(pavosCena(17, 17, 1, 6, true)).toEqual([...completo(6), medio[0]]); // 9.35 kg → 6 kg + medio pavo
    expect(pavosCena(20, 20, 1, 6, true)).toEqual([...completo(7.5), medio[0]]); // 11 kg → 7.5 kg + medio pavo
  });
  it("el ahumado no tiene medio pavo: se reparte solo en pavos enteros", () => {
    expect(combinarPavos(9.5, 6, false)).toEqual(completo(6, 2));
  });
  it("el ahumado (solo completo) nunca baja del mínimo", () => {
    expect(pavosCena(9, 9, 1, 6, false)).toEqual(completo(6));
  });
});
