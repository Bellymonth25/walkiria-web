import type { Unidad } from "../types";

const pesos = new Intl.NumberFormat("es-MX", { minimumFractionDigits: 0, maximumFractionDigits: 2 });

export const dinero = (n: number): string => "$" + pesos.format(n);

/** Sufijo corto para el precio: "/kg", "/pza", "/L". */
export const sufijo = (u: Unidad): string => (u === "pza" ? "pza" : u === "lt" ? "L" : "kg");

/** Cuánto sube o baja cada toque de + / −. */
export const paso = (u: Unidad): number => (u === "pza" ? 1 : 0.5);

export const cantidad = (q: number, u: Unidad): string =>
  u === "pza" ? `${q} ${q === 1 ? "pza" : "pzas"}` : `${String(q).replace(".", ",")} ${u === "kg" ? "kg" : "L"}`;

/** Para buscar sin importar acentos ni mayúsculas. */
export const normalizar = (s: string): string => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export const escapar = (s: string): string =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** "a, b y c" */
export const enLista = (xs: readonly string[]): string =>
  xs.length <= 1 ? (xs[0] ?? "") : `${xs.slice(0, -1).join(", ")} y ${xs[xs.length - 1]}`;
