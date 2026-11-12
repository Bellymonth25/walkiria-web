import type { Linea, Pedido, Presentacion, Producto, TamanoEmpaque, ZonaEnvio } from "../types";
import { empaques, maquila, pavo } from "../data/temporada";
import { dinero, enLista, kilos, normalizar } from "./formato";

// ---------- Presentación ----------

export const nombrePresentacion: Record<Presentacion, string> = {
  acrilico: "Acrílico",
  bolsa: "Bolsa o caja de cartón",
  vacio: "Al vacío",
  charola: "Charola de aluminio",
};

/** Opciones de presentación que aplican a un producto. La primera es la de default (sin costo). */
export function presentaciones(p: Producto): Presentacion[] {
  if (p.unidad === "pza" || p.maquila) return [];
  return p.pavoEntero || p.pieza ? ["bolsa", "vacio", "charola"] : ["acrilico", "vacio", "charola"];
}

export const tieneCosto = (pr: Presentacion): pr is "vacio" | "charola" => pr === "vacio" || pr === "charola";

export interface Empaque {
  tamano: TamanoEmpaque;
  piezas: number;
  precio: number;
}

/** Tamaño de bolsa/charola para cierta cantidad de kg (máximo una grande). */
export function tamanoPara(kg: number): TamanoEmpaque {
  const c = empaques.capacidad;
  return kg <= c.chica ? "chica" : kg <= c.mediana ? "mediana" : "grande";
}

/**
 * Cuántos empaques lleva un producto. Si no cabe en una grande, se reparte en partes iguales
 * (6 kg → 2 grandes de 3 kg). Los pavos enteros van en un empaque grande por pavo.
 */
export function empaquesDe(p: Producto, l: Linea): Empaque[] {
  if (!presentaciones(p).length || !tieneCosto(l.presentacion)) return [];
  const precios = empaques.precio[l.presentacion];
  if (p.pavoEntero) return [{ tamano: "grande", piezas: l.cantidad, precio: precios.grande }];
  if (p.pieza) {
    const tamano = tamanoPara(p.pieza.kgEstimado);
    return [{ tamano, piezas: l.cantidad, precio: precios[tamano] }];
  }
  const kg = l.cantidad;
  const piezas = Math.max(1, Math.ceil(kg / empaques.capacidad.grande - 1e-9));
  const tamano = tamanoPara(kg / piezas);
  return [{ tamano, piezas, precio: precios[tamano] }];
}

export function textoEmpaques(pr: Presentacion, es: readonly Empaque[]): string {
  if (!es.length) return nombrePresentacion[pr] + " (sin costo)";
  const tipo = pr === "vacio" ? ["bolsa al vacío", "bolsas al vacío"] : ["charola", "charolas"];
  return es
    .map((e) => {
      const plural = e.piezas > 1;
      const tam = plural ? `${e.tamano}s` : e.tamano;
      return `${e.piezas} ${plural ? tipo[1] : tipo[0]} ${tam} (+${dinero(e.piezas * e.precio)})`;
    })
    .join(", ");
}

// ---------- Maquila ----------

export const llevaRelleno = (l: Linea): boolean => l.tipoMaquila === maquila.tipoConRelleno;

/** "Lomo Mechado", o lo que escribió el cliente en "Otro". */
export function nombreMaquila(l: Linea): string {
  if (l.tipoMaquila === "Otro") return l.otroMaquila.trim() || "Otro";
  return l.tipoMaquila;
}

/** Kilos de relleno sugeridos para un pavo de cierto peso. */
export function rellenoSugerido(kgPavo: number): number {
  return maquila.rellenoSugerido.find((r) => kgPavo <= r.hastaKg)?.kgRelleno ?? 1;
}

/** Si el cliente no ha tocado el relleno, se ajusta solo al peso del pavo. */
export function conRellenoSugerido(l: Linea): Linea {
  return l.rellenoManual ? l : { ...l, kgRelleno: rellenoSugerido(l.cantidad) };
}

/** La maquila necesita saber qué carne trae el cliente. */
export const maquilaIncompleta = (l: Linea): boolean =>
  !l.tipoMaquila || (l.tipoMaquila === "Otro" && !l.otroMaquila.trim());

// ---------- Cantidades ----------

/** Productos que se agregan como varias líneas independientes (cada maquila, cada pavo). */
export const variasLineas = (p: Producto): boolean => Boolean(p.maquila || p.pavoEntero);

/** Id de la línea en el pedido. Cada versión va aparte: "pechuga-pavo~horneada". */
export const idLinea = (p: Producto, version = ""): string =>
  version ? `${p.id}~${normalizar(version).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}` : p.id;

/** Mínimo de kilos de un pavo completo: el propio del producto o el general. */
export const kgMinimoPavo = (p: Producto): number => p.kgMinimoCompleto ?? pavo.kgMinimoCompleto;

export function nuevaLinea(p: Producto, version = ""): Linea {
  return {
    productoId: p.id,
    // Maquila: el cliente escribe cuánto pesa su carne (empieza vacío).
    cantidad: p.maquila ? 0 : 1,
    tamano: "completo",
    kgPorPavo: kgMinimoPavo(p),
    presentacion: presentaciones(p)[0] ?? "acrilico",
    tipoMaquila: "",
    otroMaquila: "",
    kgRelleno: 1,
    rellenoManual: false,
    nota: "",
    version: p.versiones?.includes(version) ? version : "",
  };
}

/** kg que se van a cobrar (estimado en pavos enteros). En piezas regresa 0. */
export function kgDe(p: Producto, l: Linea): number {
  if (p.pavoEntero) return l.cantidad * (l.tamano === "completo" || p.soloCompleto ? Math.max(kgMinimoPavo(p), l.kgPorPavo) : pavo.kgMedio.estimado);
  if (p.pieza) return l.cantidad * p.pieza.kgEstimado;
  return p.unidad === "kg" ? l.cantidad : 0;
}

export function importeProducto(p: Producto, l: Linea): number {
  if (p.unidad === "pza") return p.precio * l.cantidad;
  const relleno = p.maquila && llevaRelleno(l) ? maquila.precioRellenoKg * l.kgRelleno : 0;
  return redondear2(p.precio * kgDe(p, l) + relleno);
}

export function importeEmpaques(p: Producto, l: Linea): number {
  return empaquesDe(p, l).reduce((a, e) => a + e.piezas * e.precio, 0);
}

export const importeLinea = (p: Producto, l: Linea): number => importeProducto(p, l) + importeEmpaques(p, l);

/** Lo que se escribe en el pedido: "6 kg", "2 pzas", "1 pavo completo (aprox. 5 kg)". */
export function textoCantidad(p: Producto, l: Linea): string {
  if (p.pavoEntero) {
    const n = l.cantidad;
    const cu = n === 1 ? "" : " c/u";
    if (l.tamano === "medio" && !p.soloCompleto) return `${n} ${n === 1 ? "medio pavo" : "medios pavos"} (${pavo.kgMedio.min} a ${pavo.kgMedio.max} kg${cu})`;
    return `${n} ${n === 1 ? "pavo completo" : "pavos completos"} (aprox. ${kilos(Math.max(kgMinimoPavo(p), l.kgPorPavo))}${cu})`;
  }
  if (p.pieza) {
    const { nombre, plural, kgMin, kgMax } = p.pieza;
    const n = l.cantidad;
    return `${n} ${n === 1 ? nombre : plural} (${kgMin} a ${kgMax} kg c/u, aprox. ${kilos(kgDe(p, l))})`;
  }
  if (p.maquila) return `aprox. ${kilos(l.cantidad)}`;
  return p.unidad === "pza" ? `${l.cantidad} ${l.cantidad === 1 ? "pza" : "pzas"}` : kilos(l.cantidad);
}

/** Nombre del renglón en el pedido: "Pavo Relleno" o "Maquila de Lomo Mechado". */
export const nombreLinea = (p: Producto, l: Linea): string =>
  p.maquila ? `Maquila de ${nombreMaquila(l) || "carne"}` : l.version ? `${p.nombre} ${l.version.toLowerCase()}` : p.nombre;

const porKilo = (p: Producto): boolean => p.unidad === "kg" && !p.pavoEntero && !p.pieza;

/** Paso de los botones + y −. */
export const paso = (p: Producto): number => (porKilo(p) ? 0.5 : 1);

/** Limpia lo que el cliente escribe. Regresa null si no es un número válido. */
export function normalizarCantidad(p: Producto, valor: number): number | null {
  if (p.maquila) return Number.isFinite(valor) && valor >= 0 ? Math.round(valor * 100) / 100 : null;
  if (!Number.isFinite(valor) || valor <= 0) return null;
  if (!porKilo(p)) return Math.max(1, Math.round(valor));
  return Math.max(0.25, Math.round(valor * 100) / 100);
}

export function normalizarKgPavo(p: Producto, valor: number): number {
  const minimo = kgMinimoPavo(p);
  if (!Number.isFinite(valor)) return minimo;
  return Math.max(minimo, Math.round(valor * 2) / 2);
}

/** Kilos de relleno: 0 o más, en cuartos de kilo. */
export function normalizarKgRelleno(valor: number): number {
  if (!Number.isFinite(valor) || valor < 0) return 0;
  return Math.round(valor * 4) / 4;
}

export function aumentar(p: Producto, actual: number): number {
  return redondear1(actual + paso(p));
}

/** Regresa 0 cuando ya no queda nada (el producto sale del pedido; la maquila se queda en 0 kg). */
export function disminuir(p: Producto, actual: number): number {
  const n = redondear1(actual - paso(p));
  if (p.maquila) return Math.max(0, n);
  return n < (porKilo(p) ? 0.25 : 1) ? 0 : n;
}

const redondear1 = (n: number): number => Math.round(n * 10) / 10;
const redondear2 = (n: number): number => Math.round(n * 100) / 100;

// ---------- Pedido ----------

export interface Renglon {
  id: string;
  producto: Producto;
  linea: Linea;
  importe: number;
}

/** Renglones en el orden del catálogo (y de captura, para varias maquilas). */
export function renglones(pedido: Pedido, catalogo: readonly Producto[]): Renglon[] {
  const entradas = Object.entries(pedido.lineas);
  return catalogo.flatMap((p) =>
    entradas
      .filter(([, l]) => l.productoId === p.id)
      // Las versiones van en el orden del catálogo (horneada, adobada, mechada).
      .sort(([, a], [, b]) => (p.versiones?.indexOf(a.version) ?? 0) - (p.versiones?.indexOf(b.version) ?? 0))
      .map(([id, l]) => ({ id, producto: p, linea: l, importe: importeLinea(p, l) })),
  );
}

export function costoEnvio(pedido: Pedido, zonas: readonly ZonaEnvio[]): number {
  return pedido.modo === "domicilio" ? (zonas[pedido.zona]?.costo ?? 0) : 0;
}

export function total(pedido: Pedido, catalogo: readonly Producto[], zonas: readonly ZonaEnvio[]): number {
  return renglones(pedido, catalogo).reduce((a, r) => a + r.importe, 0) + costoEnvio(pedido, zonas);
}

/** Lo que le falta al cliente para poder mandar el pedido. Vacío = listo. */
export function faltantes(pedido: Pedido, catalogo: readonly Producto[]): string[] {
  const f: string[] = [];
  const filas = renglones(pedido, catalogo);
  if (filas.length === 0) f.push("al menos un producto");
  const maquilas = filas.filter((r) => r.producto.maquila);
  if (maquilas.some((r) => maquilaIncompleta(r.linea))) f.push("qué carne nos trae para la maquila");
  if (maquilas.some((r) => r.linea.cantidad <= 0)) f.push("el peso aproximado de su carne");
  if (!pedido.nombre.trim()) f.push("tu nombre");
  if (pedido.fecha === null) f.push("el día de entrega");
  if (pedido.modo === "domicilio" && !pedido.direccion.trim()) f.push("la dirección de entrega");
  return f;
}

export const textoFaltantes = (f: readonly string[]): string => (f.length ? `Falta ${enLista(f)}.` : "");

export interface ContextoMensaje {
  catalogo: readonly Producto[];
  zonas: readonly ZonaEnvio[];
  /** Ej. "Miércoles 23 de diciembre". */
  nombreDia: string;
  /** Fecha sujeta a disponibilidad (23 y 30 de diciembre). */
  diaSujeto?: boolean;
  tardio: boolean;
}

/** Texto que se manda por WhatsApp. El nombre va primero para que en mostrador lo busquen rápido. */
export function mensaje(pedido: Pedido, ctx: ContextoMensaje): string {
  const filas = renglones(pedido, ctx.catalogo);
  const envio = costoEnvio(pedido, ctx.zonas);
  const lineas: string[] = [
    ctx.tardio
      ? "Hola, quiero hacer un pedido tardío (sé que está sujeto a disponibilidad):"
      : "Hola, quiero hacer un pedido de Navidad:",
    `Nombre: ${pedido.nombre.trim()}`,
    "",
  ];
  for (const r of filas) {
    const { producto: p, linea: l } = r;
    lineas.push(`• ${nombreLinea(p, l)}, ${textoCantidad(p, l)}: ${dinero(importeProducto(p, l))}`);
    if (p.maquila && llevaRelleno(l)) lineas.push(`   Con ${kilos(l.kgRelleno)} de relleno`);
    if (presentaciones(p).length) lineas.push(`   Presentación: ${textoEmpaques(l.presentacion, empaquesDe(p, l))}`);
    if (l.nota.trim()) lineas.push(`   Nota: ${l.nota.trim()}`);
  }
  if (filas.some((r) => r.producto.maquila)) {
    lineas.push("", `Llevaré la carne para la maquila a la tienda al menos ${maquila.diasAnticipacion} días antes de la entrega.`);
  }
  lineas.push("", `Entrega: ${pedido.modo === "tienda" ? "Recojo en tienda" : `A domicilio, ${ctx.zonas[pedido.zona]?.nombre ?? ""}`}`);
  if (pedido.modo === "domicilio") {
    lineas.push(`Dirección: ${pedido.direccion.trim()}`);
    if (pedido.referencias.trim()) lineas.push(`Referencias: ${pedido.referencias.trim()}`);
  }
  lineas.push(`Día: ${ctx.nombreDia}${ctx.diaSujeto ? " (sujeto a disponibilidad)" : ""}`);
  if (pedido.nota.trim()) lineas.push(`Nota del pedido: ${pedido.nota.trim()}`);
  const t = total(pedido, ctx.catalogo, ctx.zonas);
  lineas.push(`Total estimado: ${dinero(t)}${envio ? ` (incluye envío ${dinero(envio)})` : ""}`);
  return lineas.join("\n");
}

export const enlaceWhatsApp = (numero: string, texto: string): string =>
  `https://wa.me/${numero}?text=${encodeURIComponent(texto)}`;
