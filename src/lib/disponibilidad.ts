import type { Producto } from "../types";

/**
 * Lee de Firestore (REST, sin SDK) la lista de ids de `products` que están sin disponibilidad.
 * El documento lo escribe la Cloud Function `onProductWritten` y es de lectura pública.
 * Si falla (sin internet, reglas, etc.) regresa null y la página muestra todo disponible.
 */
export interface Disponibilidad {
  agotados: Set<string>;
  ocultos: Set<string>;
}

export async function leerDisponibilidad(proyecto: string, documento: string, timeoutMs = 5000): Promise<Disponibilidad | null> {
  const url = `https://firestore.googleapis.com/v1/projects/${proyecto}/databases/(default)/documents/${documento}`;
  const ctrl = new AbortController();
  const t = window.setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ctrl.signal, cache: "no-store" });
    if (!res.ok) return null;
    const doc = await res.json();
    return { agotados: parsearAgotados(doc), ocultos: parsearOcultos(doc) };
  } catch {
    return null;
  } finally {
    window.clearTimeout(t);
  }
}

type ListaFirestore = { arrayValue?: { values?: { stringValue?: string }[] } };
interface DocumentoFirestore {
  fields?: { agotados?: ListaFirestore; ocultos?: ListaFirestore };
}

function lista(l: ListaFirestore | undefined): Set<string> {
  const valores = l?.arrayValue?.values ?? [];
  return new Set(valores.map((v) => v.stringValue).filter((s): s is string => typeof s === "string"));
}

export const parsearAgotados = (doc: unknown): Set<string> => lista((doc as DocumentoFirestore)?.fields?.agotados);
/** Si el documento aún no trae `ocultos` (función vieja), no se oculta nada. */
export const parsearOcultos = (doc: unknown): Set<string> => lista((doc as DocumentoFirestore)?.fields?.ocultos);

/** Un producto de la web está agotado si todos sus ids de Firestore están agotados. */
export function estaAgotado(p: Producto, agotados: ReadonlySet<string>): boolean {
  return p.firebaseIds.length > 0 && p.firebaseIds.every((id) => agotados.has(id));
}

/** Oculto en la web (`ocultoEnWeb` en Firestore): no se muestra ni se puede pedir. La app lo ignora. */
export function estaOculto(p: Producto, ocultos: ReadonlySet<string>): boolean {
  return p.firebaseIds.length > 0 && p.firebaseIds.every((id) => ocultos.has(id));
}
