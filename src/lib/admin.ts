import type { Producto } from "../types";

/**
 * Producto de Firestore (`products`) tal como lo usa el súper panel.
 * Firestore es la verdad: la app y la web leen de aquí.
 */
export interface ProductoFirestore {
  id: string;
  nombre: string;
  categoria: Categoria;
  grupo: string;
  menudeo: number;
  mayoreo: number;
  /** tipoVenta de la app: Kg, Pza, Lt, Envio. */
  unidad: string;
  presentacion: string;
  imagen: string;
  maquila: boolean;
  pesoAjustable: boolean;
  disponible: boolean;
  /** No se muestra ni en la app ni en la web. */
  oculto: boolean;
}

/** Mismos valores que los enums de la app (CategoryType, GroupType, SaleType, PresentationType). */
export const CATEGORIAS = ["Comida", "Envio", "Empaque"] as const;
export type Categoria = (typeof CATEGORIAS)[number];
export const GRUPOS = ["AVES", "CARNES", "PASTAS", "GUARNICIONES", "MAQUILAS", "POSTRES", "OTROS"];
export const UNIDADES = ["Kg", "Pza", "Lt", "Envio"];
export const PRESENTACIONES = [
  "",
  "Charola chica",
  "Charola mediana",
  "Charola grande",
  "Vacío chica",
  "Vacío mediana",
  "Vacío grande",
  "Acrílico",
  "Recipiente cliente",
  "Bolsa",
  "Sin presentación",
];

/** Secciones de la lista: los grupos de comida y luego envíos y empaques. */
const SECCIONES = [...GRUPOS, "ENVIO", "EMPAQUE"];

export function nombreGrupo(grupo: string): string {
  if (grupo === "ENVIO") return "Envíos";
  if (grupo === "EMPAQUE") return "Empaques";
  const g = grupo.toUpperCase();
  return g.charAt(0) + g.slice(1).toLowerCase();
}

const texto = (v: unknown, def = ""): string => (typeof v === "string" ? v : def);
const numero = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) ? v : 0);

/** Convierte un documento de `products` sin confiar en sus tipos. */
export function leerProducto(id: string, d: Record<string, unknown>): ProductoFirestore {
  const cat = CATEGORIAS.find((c) => c.toLowerCase() === texto(d.categoria).toLowerCase()) ?? "Comida";
  const g = texto(d.group).toUpperCase();
  return {
    id,
    nombre: texto(d.nombre, id) || id,
    categoria: cat,
    grupo: GRUPOS.includes(g) ? g : "OTROS",
    menudeo: numero(d.menudeo),
    mayoreo: numero(d.mayoreo),
    unidad: texto(d.tipoVenta),
    presentacion: texto(d.presentacion),
    imagen: texto(d.imagen),
    maquila: d.isMaquila === true,
    pesoAjustable: d.isWeightAdjustable === true,
    // Igual que la app: sin el campo, cuenta como agotado.
    disponible: d.estaDisponible === true,
    oculto: d.oculto === true,
  };
}

/** Lo que se guarda en Firestore, con los nombres de campo de la app. */
export function aDocumento(p: ProductoFirestore): Record<string, string | number | boolean> {
  return {
    id: p.id,
    nombre: p.nombre,
    categoria: p.categoria,
    group: p.grupo,
    menudeo: p.menudeo,
    mayoreo: p.mayoreo,
    tipoVenta: p.unidad,
    presentacion: p.presentacion,
    imagen: p.imagen,
    isMaquila: p.maquila,
    isWeightAdjustable: p.pesoAjustable,
    estaDisponible: p.disponible,
    oculto: p.oculto,
  };
}

/** Sección donde se lista: el grupo si es comida, si no la categoría. */
export const seccion = (p: ProductoFirestore): string => (p.categoria === "Comida" ? p.grupo : p.categoria.toUpperCase());

/**
 * Agrupa y filtra para pintar. El orden es fijo (sección y nombre), no depende del estado,
 * para que los renglones no brinquen al tocar un interruptor.
 */
export function agrupar(lista: readonly ProductoFirestore[], busqueda: string): [string, ProductoFirestore[]][] {
  const q = quitarAcentos(busqueda.trim().toLowerCase());
  const grupos = new Map<string, ProductoFirestore[]>();
  [...lista]
    .filter((p) => !q || quitarAcentos(p.nombre.toLowerCase()).includes(q) || p.id.toLowerCase().includes(q))
    .sort((a, b) => SECCIONES.indexOf(seccion(a)) - SECCIONES.indexOf(seccion(b)) || a.nombre.localeCompare(b.nombre, "es"))
    .forEach((p) => {
      const g = grupos.get(seccion(p)) ?? [];
      g.push(p);
      grupos.set(seccion(p), g);
    });
  return [...grupos];
}

/** Siguiente id con el formato de siempre: PROD_052 después de PROD_051. */
export function siguienteId(ids: readonly string[]): string {
  const max = ids.reduce((m, id) => {
    const n = /^PROD_(\d+)$/.exec(id)?.[1];
    return n ? Math.max(m, Number(n)) : m;
  }, 0);
  return `PROD_${String(max + 1).padStart(3, "0")}`;
}

export function productoNuevo(id: string): ProductoFirestore {
  return {
    id,
    nombre: "",
    categoria: "Comida",
    grupo: "OTROS",
    menudeo: 0,
    mayoreo: 0,
    unidad: "Kg",
    presentacion: "",
    imagen: "",
    maquila: false,
    pesoAjustable: true,
    disponible: true,
    oculto: false,
  };
}

/** Revisa la ficha antes de guardar. Regresa el mensaje para el usuario o null si está bien. */
export function validar(p: ProductoFirestore, otros: readonly ProductoFirestore[]): string | null {
  if (!p.nombre.trim()) return "Escribe el nombre del producto.";
  const repetido = otros.find((o) => o.id !== p.id && o.nombre.trim().toLowerCase() === p.nombre.trim().toLowerCase());
  if (repetido) return `Ya existe "${repetido.nombre}" (${repetido.id}).`;
  if (!(p.menudeo > 0)) return "El precio de menudeo debe ser mayor a 0.";
  if (p.mayoreo < 0) return "El precio de mayoreo no puede ser negativo.";
  if (p.imagen && !/^https:\/\//.test(p.imagen)) return "La foto debe ser un enlace que empiece con https://";
  return null;
}

/** Campos que cambiaron entre dos versiones (para no reescribir lo que no se tocó). */
export function cambios(antes: ProductoFirestore, despues: ProductoFirestore): Record<string, string | number | boolean> {
  const a = aDocumento(antes);
  const d = aDocumento(despues);
  return Object.fromEntries(Object.entries(d).filter(([k, v]) => a[k] !== v));
}

/** Nombre del producto de la página web que usa este id, si hay. */
export function nombreEnWeb(id: string, productos: readonly Producto[]): string | null {
  return productos.find((p) => p.firebaseIds.includes(id))?.nombre ?? null;
}

export type ResultadoRol = { ok: true } | { ok: false; motivo: string };

/** Solo entra quien tenga un documento en `superadmins/{uid}` (se crea a mano en la consola). */
export function evaluarSuperadmin(existe: boolean): ResultadoRol {
  return existe
    ? { ok: true }
    : { ok: false, motivo: "Este panel es solo para el súper administrador. Tu usuario no está en la lista." };
}

/** Explica en español por qué falló la lectura del permiso (el código de error de Firebase). */
export function motivoDeError(codigo: string | undefined): string {
  if (codigo === "permission-denied") {
    return "Firestore no te dejó revisar tu permiso (permission-denied). Revisa las reglas y que tu correo sea @lawalkiria.com.mx.";
  }
  if (codigo === "unavailable") {
    return "No se pudo conectar con Firebase (unavailable). Revisa tu conexión o desactiva el bloqueador de anuncios.";
  }
  return `No se pudo verificar tu permiso (${codigo ?? "error desconocido"}).`;
}

const quitarAcentos = (s: string): string => s.normalize("NFD").replace(/[̀-ͯ]/g, "");
