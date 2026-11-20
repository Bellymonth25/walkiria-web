import type { Encuadre } from "../types";

export const ZOOM_MAX = 3;
const limitar = (n: number, min: number, max: number): number => Math.min(max, Math.max(min, n));

/** Deja el encuadre en rangos válidos (x, y de 0 a 100; zoom de 1 a 3) y redondeado para guardarlo. */
export function normalizarEncuadre(e: Partial<Encuadre> | null | undefined): Encuadre | undefined {
  if (!e) return undefined;
  const num = (v: unknown, def: number) => (typeof v === "number" && Number.isFinite(v) ? v : def);
  const r = {
    x: Math.round(limitar(num(e.x, 50), 0, 100) * 10) / 10,
    y: Math.round(limitar(num(e.y, 50), 0, 100) * 10) / 10,
    zoom: Math.round(limitar(num(e.zoom, 1), 1, ZOOM_MAX) * 100) / 100,
  };
  return esCentro(r) ? undefined : r;
}

/** El encuadre de siempre (centro, sin acercar): no hace falta guardarlo. */
export const esCentro = (e: Encuadre): boolean => e.x === 50 && e.y === 50 && e.zoom === 1;

/**
 * Estilo para un <img> con object-fit: cover dentro de un recuadro con overflow oculto. El mismo en
 * el pedido, en el panel y en la vista previa del selector, para que se vea igual en todos lados.
 */
export function estiloEncuadre(e: Encuadre | undefined): string {
  if (!e) return "";
  const pos = `${e.x}% ${e.y}%`;
  return `object-position:${pos};${e.zoom > 1 ? `transform:scale(${e.zoom});transform-origin:${pos};` : ""}`;
}
