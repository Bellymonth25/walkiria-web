import type { Producto } from "../types";

/** Producto de Firestore (`products`) tal como lo necesita la página admin. */
export interface ProductoFirestore {
  id: string;
  nombre: string;
  grupo: string;
  precio: number;
  unidad: string;
  disponible: boolean;
}

/** Orden de los grupos igual que en la app (GroupType). */
const ORDEN_GRUPOS = ["AVES", "CARNES", "PASTAS", "GUARNICIONES", "MAQUILAS", "POSTRES", "OTROS"];

export function nombreGrupo(grupo: string): string {
  const g = grupo.toUpperCase();
  return g.charAt(0) + g.slice(1).toLowerCase();
}

/** Convierte un documento de `products` sin confiar en sus tipos. */
export function leerProducto(id: string, d: Record<string, unknown>): ProductoFirestore {
  const grupo = typeof d.group === "string" && ORDEN_GRUPOS.includes(d.group.toUpperCase()) ? d.group.toUpperCase() : "OTROS";
  return {
    id,
    nombre: typeof d.nombre === "string" ? d.nombre : id,
    grupo,
    precio: typeof d.menudeo === "number" ? d.menudeo : 0,
    unidad: typeof d.tipoVenta === "string" ? d.tipoVenta : "",
    // Igual que la app: sin el campo, no se ofrece al levantar pedidos.
    disponible: d.estaDisponible === true,
  };
}

/**
 * Agrupa y filtra para pintar. El orden es fijo (grupo y nombre), no depende de la disponibilidad,
 * para que los renglones no brinquen al tocar el interruptor.
 */
export function agrupar(lista: readonly ProductoFirestore[], busqueda: string): [string, ProductoFirestore[]][] {
  const q = quitarAcentos(busqueda.trim().toLowerCase());
  const grupos = new Map<string, ProductoFirestore[]>();
  [...lista]
    .filter((p) => !q || quitarAcentos(p.nombre.toLowerCase()).includes(q))
    .sort((a, b) => ORDEN_GRUPOS.indexOf(a.grupo) - ORDEN_GRUPOS.indexOf(b.grupo) || a.nombre.localeCompare(b.nombre, "es"))
    .forEach((p) => {
      const g = grupos.get(p.grupo) ?? [];
      g.push(p);
      grupos.set(p.grupo, g);
    });
  return [...grupos];
}

/** Nombre del producto de la página web que usa este id, si hay. */
export function nombreEnWeb(id: string, productos: readonly Producto[]): string | null {
  return productos.find((p) => p.firebaseIds.includes(id))?.nombre ?? null;
}

const quitarAcentos = (s: string): string => s.normalize("NFD").replace(/[̀-ͯ]/g, "");
