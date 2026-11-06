import { describe, expect, it } from "vitest";
import type { Linea, Pedido, Producto } from "../src/types";
import { productos } from "../src/data/productos";
import { temporada } from "../src/data/temporada";
import {
  aumentar, conRellenoSugerido, disminuir, empaquesDe, rellenoSugerido, faltantes, importeLinea, mensaje, normalizarCantidad, normalizarKgPavo, nuevaLinea, total,
} from "../src/lib/pedido";
import { esPedidoTardio, nombreDia } from "../src/lib/fechas";
import { estaAgotado, parsearAgotados } from "../src/lib/disponibilidad";
import { fechaElegible, sinDomicilio, tipoDeFecha } from "../src/lib/entrega";

const prod = (id: string): Producto => productos.find((p) => p.id === id)!;
const lomo = prod("lomo-adobado");
const pavoR = prod("pavo-relleno");
const strudel = prod("strudel");
const linea = (p: Producto, cambios: Partial<Linea> = {}): Linea => ({ ...nuevaLinea(p), ...cambios });
const base: Pedido = { lineas: {}, nombre: "", modo: "tienda", zona: 0, direccion: "", referencias: "", nota: "", fecha: "2026-12-23" };
const ctx = { catalogo: productos, zonas: temporada.zonas, nombreDia: "Miércoles 23 de diciembre", tardio: false };

describe("líneas nuevas", () => {
  it("los pavos empiezan completos, de 5 kg y en bolsa o caja", () => {
    expect(nuevaLinea(pavoR)).toMatchObject({ cantidad: 1, tamano: "completo", kgPorPavo: 5, presentacion: "bolsa" });
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
    expect(normalizarKgPavo(4)).toBe(5);
    expect(normalizarKgPavo(6.3)).toBe(6.5);
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
    expect(importeLinea(lomo, linea(lomo, { cantidad: 6, presentacion: "charola" }))).toBe(6 * 430 + 2 * 35);
  });
});

describe("pavos", () => {
  it("completo usa los kilos por pavo; medio usa 3.5 kg de estimado", () => {
    expect(importeLinea(pavoR, linea(pavoR, { cantidad: 2, kgPorPavo: 6 }))).toBe(2 * 6 * 390);
    expect(importeLinea(pavoR, linea(pavoR, { tamano: "medio" }))).toBe(3.5 * 390);
  });
});

describe("total y faltantes", () => {
  it("suma envío solo a domicilio", () => {
    const p: Pedido = { ...base, lineas: { "lomo-adobado": linea(lomo, { cantidad: 2 }) } };
    expect(total(p, productos, temporada.zonas)).toBe(860);
    expect(total({ ...p, modo: "domicilio", zona: 2 }, productos, temporada.zonas)).toBe(1060);
  });
  it("pide día y dirección cuando aplica", () => {
    const p: Pedido = { ...base, lineas: { bacalao: linea(prod("bacalao")) }, nombre: "Ana", fecha: null };
    expect(faltantes(p, productos)).toEqual(["el día de entrega"]);
    expect(faltantes({ ...p, fecha: "2026-12-22", modo: "domicilio" }, productos)).toEqual(["la dirección de entrega"]);
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
    expect(m).toContain("• Pavo Relleno, 1 medio pavo (3 a 4 kg): $1,365");
    expect(m).toContain("Presentación: Bolsa o caja de cartón (sin costo)");
    expect(m).toContain("• Lomo Adobado, 6 kg: $2,580");
    expect(m).toContain("Presentación: 2 charolas grandes (+$70)");
    expect(m).toContain("Nota del pedido: Ensalada sin apio");
    expect(m).toContain("Total estimado: $4,015");
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
  });
  it("un producto con varios ids solo se agota si todos lo están", () => {
    const pechuga = prod("pechuga-pavo");
    expect(estaAgotado(pechuga, new Set(["PROD_017"]))).toBe(false);
    expect(estaAgotado(pechuga, new Set(["PROD_017", "PROD_018", "PROD_019"]))).toBe(true);
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
    expect(importeLinea(maq, linea(maq, { cantidad: 4, tipoMaquila: "Lomo Mechado" }))).toBe(4 * 75);
    expect(importeLinea(maq, linea(maq, { cantidad: 6, tipoMaquila: "Pavo Relleno", kgRelleno: 1.5 }))).toBe(6 * 75 + 1.5 * 390);
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
    expect(m).toContain("• Maquila de Pavo Relleno, aprox. 6 kg: $840");
    expect(m).toContain("   Con 1 kg de relleno");
    expect(m).toContain("   Nota: Poca sal");
    expect(m).toContain("• Maquila de Cabrito, aprox. 3 kg: $225");
    expect(m).toContain("Llevaré la carne para la maquila a la tienda al menos 2 días antes de la entrega.");
    expect(m).toContain("Día: Miércoles 30 de diciembre (sujeto a disponibilidad)");
    expect(m).not.toContain("Presentación");
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
    expect(fechaElegible("2026-11-06", hoy, temporada)).toBe(true);
    expect(fechaElegible("2026-12-31", hoy, temporada)).toBe(true);
    expect(fechaElegible("2027-01-01", hoy, temporada)).toBe(false);
  });
  it("a domicilio: no el 24 ni el 31, y con 2 días de aviso", () => {
    expect(sinDomicilio("2026-12-24", hoy, temporada)).toBe("tienda");
    expect(sinDomicilio("2026-11-07", hoy, temporada)).toBe("aviso");
    expect(sinDomicilio("2026-11-08", hoy, temporada)).toBeNull();
  });
});

describe("varios pavos y patos", () => {
  it("cada pavo es su propia línea, con su propio peso", () => {
    const pedido = {
      lineas: {
        "pavo-relleno-1": linea(pavoR, { kgPorPavo: 7 }),
        "pavo-relleno-2": linea(pavoR, { kgPorPavo: 9, presentacion: "charola" as const }),
      },
      nombre: "Ana", modo: "tienda" as const, zona: 0, direccion: "", referencias: "", nota: "", fecha: "2026-12-23",
    };
    expect(total(pedido, productos, [])).toBe(7 * 390 + 9 * 390 + 35);
    const m = mensaje(pedido, { catalogo: productos, zonas: [], nombreDia: "Miércoles 23 de diciembre", tardio: false });
    expect(m).toContain("• Pavo Relleno, 1 pavo completo (aprox. 7 kg): $2,730");
    expect(m).toContain("• Pavo Relleno, 1 pavo completo (aprox. 9 kg): $3,510");
  });

  it("el pato se pide por pieza y se cobra por su peso aproximado", () => {
    const pato = prod("pato-naranja");
    const l = linea(pato, { cantidad: 2 });
    expect(importeLinea(pato, l)).toBe(2 * 2 * 500);
    expect(l.presentacion).toBe("bolsa");
    expect(aumentar(pato, 2)).toBe(3);
    expect(normalizarCantidad(pato, 1.4)).toBe(1);
    expect(empaquesDe(pato, linea(pato, { cantidad: 2, presentacion: "charola" }))).toEqual([{ tamano: "mediana", piezas: 2, precio: 30 }]);
  });
});
