import type { Producto } from "../types";

/**
 * Lee de Firestore (REST, sin SDK) la lista de ids de `products` que están sin disponibilidad.
 * El documento lo escribe la Cloud Function `onProductWritten` y es de lectura pública.
 * Si falla (sin internet, reglas, etc.) regresa null y la página muestra todo disponible.
 */
export async function leerAgotados(proyecto: string, documento: string, timeoutMs = 5000): Promise<Set<string> | null> {
  const url = `https://firestore.googleapis.com/v1/projects/${proyecto}/databases/(default)/documents/${documento}`;
  const ctrl = new AbortController();
  const t = window.setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ctrl.signal, cache: "no-store" });
    if (!res.ok) return null;
    return parsearAgotados(await res.json());
  } catch {
    return null;
  } finally {
    window.clearTimeout(t);
  }
}

interface DocumentoFirestore {
  fields?: { agotados?: { arrayValue?: { values?: { stringValue?: string }[] } } };
}

export function parsearAgotados(doc: unknown): Set<string> {
  const valores = (doc as DocumentoFirestore)?.fields?.agotados?.arrayValue?.values ?? [];
  return new Set(valores.map((v) => v.stringValue).filter((s): s is string => typeof s === "string"));
}

/** Un producto de la web está agotado si todos sus ids de Firestore están agotados. */
export function estaAgotado(p: Producto, agotados: ReadonlySet<string>): boolean {
  return p.firebaseIds.length > 0 && p.firebaseIds.every((id) => agotados.has(id));
}
