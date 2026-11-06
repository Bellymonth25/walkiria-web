import type { Linea, Pedido, Presentacion, Producto, TamanoEmpaque, ZonaEnvio } from "../types";
import { empaques, pavo } from "../data/temporada";
import { dinero, enLista, kilos } from "./formato";

// ---------- Presentación ----------

export const nombrePresentacion: Record<Presentacion, string> = {
  acrilico: "Acrílico",
  bolsa: "Bolsa o caja de cartón",
  vacio: "Al vacío",
  charola: "Charola de aluminio",
};

/** Opciones de presentación que aplican a un producto. La primera es la de default (sin costo). */
export function presentaciones(p: Producto): Presentacion[] {
  if (p.unidad === "pza") return [];
  return p.pavoEntero ? ["bolsa", "vacio", "charola"] : ["acrilico", "vacio", "charola"];
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
  if (!tieneCosto(l.presentacion)) return [];
  const precios = empaques.precio[l.presentacion];
  if (p.pavoEntero) return [{ tamano: "grande", piezas: l.cantidad, precio: precios.grande }];
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

// ---------- Cantidades ----------

export function nuevaLinea(p: Producto): Linea {
  return {
    cantidad: 1,
    tamano: "completo",
    kgPorPavo: pavo.kgMinimoCompleto,
    presentacion: presentaciones(p)[0] ?? "acrilico",
  };
}

/** kg que se van a cobrar (estimado en pavos enteros). En piezas regresa 0. */
export function kgDe(p: Producto, l: Linea): number {
  if (p.pavoEntero) return l.cantidad * (l.tamano === "completo" ? l.kgPorPavo : pavo.kgMedio.estimado);
  return p.unidad === "kg" ? l.cantidad : 0;
}

export function importeProducto(p: Producto, l: Linea): number {
  return p.unidad === "pza" ? p.precio * l.cantidad : redondear2(p.precio * kgDe(p, l));
}

export function importeEmpaques(p: Producto, l: Linea): number {
  return empaquesDe(p, l).reduce((a, e) => a + e.piezas * e.precio, 0);
}

export const importeLinea = (p: Producto, l: Linea): number => importeProducto(p, l) + importeEmpaques(p, l);

/** Lo que se escribe en el pedido: "6 kg", "2 pzas", "1 pavo completo (aprox. 5 kg)". */
export function textoCantidad(p: Producto, l: Linea): string {
  if (p.pavoEntero) {
    const n = l.cantidad;
    if (l.tamano === "medio") return `${n} ${n === 1 ? "medio pavo" : "medios pavos"} (3 a 4 kg c/u)`;
    return `${n} ${n === 1 ? "pavo completo" : "pavos completos"} (aprox. ${kilos(l.kgPorPavo)} c/u)`;
  }
  return p.unidad === "pza" ? `${l.cantidad} ${l.cantidad === 1 ? "pza" : "pzas"}` : kilos(l.cantidad);
}

/** Paso de los botones + y −. */
export const paso = (p: Producto): number => (p.unidad === "kg" && !p.pavoEntero ? 0.5 : 1);

/** Limpia lo que el cliente escribe. Regresa null si no es un número válido. */
export function normalizarCantidad(p: Producto, valor: number): number | null {
  if (!Number.isFinite(valor) || valor <= 0) return null;
  if (p.unidad === "pza" || p.pavoEntero) return Math.max(1, Math.round(valor));
  return Math.max(0.25, Math.round(valor * 100) / 100);
}

export function normalizarKgPavo(valor: number): number {
  if (!Number.isFinite(valor)) return pavo.kgMinimoCompleto;
  return Math.max(pavo.kgMinimoCompleto, Math.round(valor * 2) / 2);
}

export function aumentar(p: Producto, actual: number): number {
  return redondear1(actual + paso(p));
}

/** Regresa 0 cuando ya no queda nada (el producto sale del pedido). */
export function disminuir(p: Producto, actual: number): number {
  const n = redondear1(actual - paso(p));
  return n < (p.unidad === "kg" && !p.pavoEntero ? 0.25 : 1) ? 0 : n;
}

const redondear1 = (n: number): number => Math.round(n * 10) / 10;
const redondear2 = (n: number): number => Math.round(n * 100) / 100;

// ---------- Pedido ----------

export interface Renglon {
  producto: Producto;
  linea: Linea;
  importe: number;
}

export function renglones(pedido: Pedido, catalogo: readonly Producto[]): Renglon[] {
  return catalogo
    .filter((p) => pedido.lineas[p.id])
    .map((p) => {
      const l = pedido.lineas[p.id]!;
      return { producto: p, linea: l, importe: importeLinea(p, l) };
    });
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
  if (renglones(pedido, catalogo).length === 0) f.push("al menos un producto");
  if (!pedido.nombre.trim()) f.push("tu nombre");
  if (pedido.dia === null) f.push("el día de entrega");
  if (pedido.modo === "domicilio" && !pedido.direccion.trim()) f.push("la dirección de entrega");
  return f;
}

export const textoFaltantes = (f: readonly string[]): string => (f.length ? `Falta ${enLista(f)}.` : "");

export interface ContextoMensaje {
  catalogo: readonly Producto[];
  zonas: readonly ZonaEnvio[];
  /** Ej. "Miércoles 23 de diciembre". */
  nombreDia: string;
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
    lineas.push(`• ${textoCantidad(r.producto, r.linea)} de ${r.producto.nombre}: ${dinero(importeProducto(r.producto, r.linea))}`);
    const pr = presentaciones(r.producto);
    if (pr.length) lineas.push(`   Presentación: ${textoEmpaques(r.linea.presentacion, empaquesDe(r.producto, r.linea))}`);
  }
  lineas.push("", `Entrega: ${pedido.modo === "tienda" ? "Recojo en tienda" : `A domicilio, ${ctx.zonas[pedido.zona]?.nombre ?? ""}`}`);
  if (pedido.modo === "domicilio") {
    lineas.push(`Dirección: ${pedido.direccion.trim()}`);
    if (pedido.referencias.trim()) lineas.push(`Referencias: ${pedido.referencias.trim()}`);
  }
  lineas.push(`Día: ${ctx.nombreDia}`);
  if (pedido.nota.trim()) lineas.push(`Nota especial: ${pedido.nota.trim()}`);
  const t = total(pedido, ctx.catalogo, ctx.zonas);
  lineas.push(`Total estimado: ${dinero(t)}${envio ? ` (incluye envío ${dinero(envio)})` : ""}`);
  return lineas.join("\n");
}

export const enlaceWhatsApp = (numero: string, texto: string): string =>
  `https://wa.me/${numero}?text=${encodeURIComponent(texto)}`;
