import type { Pedido, Producto, Unidad, ZonaEnvio } from "../types";
import { cantidad, dinero, enLista, paso } from "./formato";

export interface Renglon {
  producto: Producto;
  cantidad: number;
  importe: number;
}

export function renglones(pedido: Pedido, catalogo: readonly Producto[]): Renglon[] {
  return catalogo
    .filter((p) => (pedido.cantidades[p.id] ?? 0) > 0)
    .map((p) => {
      const q = pedido.cantidades[p.id]!;
      return { producto: p, cantidad: q, importe: p.precio * q };
    });
}

export function costoEnvio(pedido: Pedido, zonas: readonly ZonaEnvio[]): number {
  return pedido.modo === "domicilio" ? (zonas[pedido.zona]?.costo ?? 0) : 0;
}

export function total(pedido: Pedido, catalogo: readonly Producto[], zonas: readonly ZonaEnvio[]): number {
  return renglones(pedido, catalogo).reduce((a, r) => a + r.importe, 0) + costoEnvio(pedido, zonas);
}

/** Primer toque = 1 kg / 1 pza; después sube de medio en medio (o de una en una). */
export function aumentar(actual: number, u: Unidad): number {
  return actual > 0 ? redondear(actual + paso(u)) : 1;
}

/** Regresa 0 cuando ya no queda nada (el producto sale del pedido). */
export function disminuir(actual: number, u: Unidad): number {
  return Math.max(0, redondear(actual - paso(u)));
}

const redondear = (n: number): number => Math.round(n * 10) / 10;

/** Lo que le falta al cliente para poder mandar el pedido. Vacío = listo. */
export function faltantes(pedido: Pedido, catalogo: readonly Producto[]): string[] {
  const f: string[] = [];
  if (renglones(pedido, catalogo).length === 0) f.push("al menos un producto");
  if (!pedido.nombre.trim()) f.push("tu nombre");
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
    ...filas.map((r) => `• ${cantidad(r.cantidad, r.producto.unidad)} de ${r.producto.nombre} (${dinero(r.importe)})`),
    "",
    `Entrega: ${pedido.modo === "tienda" ? "Recojo en tienda" : `A domicilio, ${ctx.zonas[pedido.zona]?.nombre ?? ""}`}`,
  ];
  if (pedido.modo === "domicilio") {
    lineas.push(`Dirección: ${pedido.direccion.trim()}`);
    if (pedido.referencias.trim()) lineas.push(`Referencias: ${pedido.referencias.trim()}`);
  }
  lineas.push(`Día: ${ctx.nombreDia}`);
  const t = total(pedido, ctx.catalogo, ctx.zonas);
  lineas.push(`Total estimado: ${dinero(t)}${envio ? ` (incluye envío ${dinero(envio)})` : ""}`);
  return lineas.join("\n");
}

export const enlaceWhatsApp = (numero: string, texto: string): string =>
  `https://wa.me/${numero}?text=${encodeURIComponent(texto)}`;
