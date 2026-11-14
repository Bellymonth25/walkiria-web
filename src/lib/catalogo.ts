import type { CategoriaId, Producto } from "../types";
import { normalizar } from "./formato";

/**
 * Lo que la Cloud Function publica de cada producto de comida en `publicWeb/disponibilidad`.
 * Firestore (lo que edita el súper panel) es la verdad: nombre, precio y foto salen de aquí.
 * La web solo agrega lo que Firestore no tiene: descripción, versiones, pavo completo o medio, etc.
 */
export interface ProductoPublico {
  nombre: string;
  precio: number;
  imagen: string;
  grupo: string;
  unidad: string;
}

type Valor = { stringValue?: string; integerValue?: string; doubleValue?: number; mapValue?: { fields?: Record<string, Valor> } };

const texto = (v: Valor | undefined): string => v?.stringValue ?? "";
const numero = (v: Valor | undefined): number => {
  const n = v?.doubleValue ?? (v?.integerValue !== undefined ? Number(v.integerValue) : NaN);
  return Number.isFinite(n) ? n : 0;
};

/** Lee el mapa `productos` del documento en formato REST de Firestore. Sin el campo, regresa vacío. */
export function parsearCatalogo(doc: unknown): Map<string, ProductoPublico> {
  const campos = (doc as { fields?: { productos?: Valor } })?.fields?.productos?.mapValue?.fields ?? {};
  const salida = new Map<string, ProductoPublico>();
  for (const [id, v] of Object.entries(campos)) {
    const f = v.mapValue?.fields ?? {};
    salida.set(id, { nombre: texto(f.nombre) || id, precio: numero(f.precio), imagen: texto(f.imagen), grupo: texto(f.grupo), unidad: texto(f.unidad) });
  }
  return salida;
}

/**
 * Solo se usan fotos subidas desde el panel (Firebase Storage). Las que ya traía `products`
 * son de relleno de otros sitios; mientras no se cambien, la web conserva sus fotos.
 */
export const esFotoPropia = (url: string): boolean => /^https:\/\/firebasestorage\.googleapis\.com\//.test(url);

/** Sección de la web según el grupo de la app. */
const CATEGORIA_DE_GRUPO: Record<string, CategoriaId> = {
  AVES: "pavo",
  CARNES: "cerdo",
  PASTAS: "guarn",
  GUARNICIONES: "guarn",
  POSTRES: "pan",
  MAQUILAS: "maquila",
};

/**
 * Junta la lista de la web con Firestore:
 * - Precio (y foto, si es propia) de Firestore. Con versiones o familia se usa el primer id.
 * - Nombre de Firestore cuando el producto de la web es uno solo (sin versiones ni familia).
 * - Un producto de la web sin id se liga al de Firestore con el mismo nombre (así se da de alta
 *   desde el panel, como la costilla adobada).
 * - Lo que está en Firestore y no en la web se agrega como producto sencillo.
 * Agotados y ocultos se resuelven aparte, con las listas de ids.
 */
export function aplicarCatalogo(base: readonly Producto[], publico: ReadonlyMap<string, ProductoPublico>): Producto[] {
  if (!publico.size) return [...base];
  const porNombre = new Map([...publico].map(([id, p]) => [normalizar(p.nombre.trim()), id]));
  const usados = new Set<string>();

  const lista = base.map((p): Producto => {
    const ligado = p.firebaseIds.length ? p.firebaseIds : [porNombre.get(normalizar(p.nombre.trim()))].filter((x): x is string => !!x);
    ligado.forEach((id) => usados.add(id));
    const fs = ligado.length ? publico.get(ligado[0]!) : undefined;
    if (!fs) return { ...p, firebaseIds: ligado };
    const sencillo = ligado.length === 1 && !p.versiones && !p.familia;
    return {
      ...p,
      firebaseIds: ligado,
      precio: fs.precio > 0 ? fs.precio : p.precio,
      nombre: sencillo && fs.nombre ? fs.nombre : p.nombre,
      ...(esFotoPropia(fs.imagen) ? { imagen: fs.imagen, imagenMini: fs.imagen } : {}),
    };
  });

  const extra = [...publico]
    .filter(([id, p]) => !usados.has(id) && p.precio > 0)
    .sort(([, a], [, b]) => a.nombre.localeCompare(b.nombre, "es"))
    .map(
      ([id, p]): Producto => ({
        id: `fs-${id.toLowerCase()}`,
        nombre: p.nombre,
        categoria: CATEGORIA_DE_GRUPO[p.grupo.toUpperCase()] ?? "otros",
        unidad: p.unidad.toLowerCase() === "kg" ? "kg" : "pza",
        precio: p.precio,
        firebaseIds: [id],
        ...(esFotoPropia(p.imagen) ? { imagen: p.imagen, imagenMini: p.imagen } : {}),
      }),
    );
  return [...lista, ...extra];
}
