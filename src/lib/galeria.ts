import type { FotoProducto, Producto } from "../types";
import type { FotoGaleria } from "../data/galeria";

/** Dominio de la página. Las fotos que ya vivían en la página se guardan en Firestore con esta dirección. */
export const SITIO = "https://www.lawalkiria.com.mx";

/** Foto de la página (public/img/galeria/<id>.jpg) como ruta del sitio. */
export const rutaGaleria = (id: string): string => `img/galeria/${id}.jpg`;

/**
 * Una foto de la página guardada con dirección completa (https://www.lawalkiria.com.mx/img/…) se usa
 * como ruta del sitio, para que funcione igual en local, en la vista previa y publicada.
 */
export function urlLocal(url: string): string {
  return url.startsWith(`${SITIO}/`) ? url.slice(SITIO.length + 1) : url;
}

/** Lo que se pinta en la galería y en el carrusel. */
export interface FotoVista {
  /** Único dentro de la galería. */
  clave: string;
  nombre: string;
  /** Ruta del sitio o URL completa. */
  url: string;
  forma: "h" | "v";
  ancha?: boolean;
  carrusel?: boolean;
  /** Tamaño real, para acercar en el visor. */
  grande?: string;
  /** El producto está agotado: la foto lleva la marca. */
  agotado: boolean;
}

export interface EstadoProductos {
  oculto: (p: Producto) => boolean;
  agotado: (p: Producto) => boolean;
}

/**
 * Arma la galería con el estado de los productos:
 * - La foto de un producto oculto no sale.
 * - La de un producto agotado sale con la marca.
 * - Si al producto se le subieron fotos en el panel (`fotos`), esas reemplazan a las de la página
 *   y salen todas juntas donde estaba su primera foto. Las de productos que no tenían foto en la
 *   página van al final.
 * - Las fotos sin producto se muestran siempre.
 */
export function armarGaleria(curadas: readonly FotoGaleria[], catalogo: readonly Producto[], estado: EstadoProductos): FotoVista[] {
  const porId = new Map(catalogo.map((p) => [p.id, p]));
  /**
   * Producto de una foto. Con `firebaseId` se busca en lo que trajo Firestore; si aún no llega (primera
   * visita sin datos guardados) se usa un producto mínimo con ese id para revisar oculto y agotado.
   */
  const productoDe = (f: FotoGaleria): Producto | undefined => {
    if (f.producto) return porId.get(f.producto);
    if (!f.firebaseId) return undefined;
    const id = f.firebaseId;
    return catalogo.find((p) => p.firebaseIds.includes(id)) ?? { id: `fs-${id.toLowerCase()}`, nombre: f.nombre, categoria: "otros", unidad: "kg", precio: 0, firebaseIds: [id] };
  };
  const salida: FotoVista[] = [];
  const yaPuestos = new Set<string>();

  const delPanel = (p: Producto): FotoVista[] =>
    (p.fotos ?? []).map((f, i) => ({
      clave: `${p.id}-${i + 1}`,
      nombre: p.nombre,
      url: urlLocal(f.url),
      forma: f.forma,
      ...(f.ancha ? { ancha: true } : {}),
      ...(f.carrusel === false ? { carrusel: false } : {}),
      ...(f.grande ? { grande: urlLocal(f.grande) } : {}),
      agotado: estado.agotado(p),
    }));

  for (const f of curadas) {
    if (f.disponible === false) continue;
    const p = productoDe(f);
    if (p && estado.oculto(p)) continue;
    if (p?.fotos) {
      if (!yaPuestos.has(p.id)) salida.push(...delPanel(p));
      yaPuestos.add(p.id);
      continue;
    }
    salida.push({
      clave: f.id,
      nombre: f.nombre,
      url: rutaGaleria(f.id),
      forma: f.forma,
      ...(f.ancha ? { ancha: true } : {}),
      ...(f.carrusel === false ? { carrusel: false } : {}),
      agotado: !!p && estado.agotado(p),
    });
  }

  for (const p of catalogo) {
    if (p.fotos?.length && !yaPuestos.has(p.id) && !estado.oculto(p)) salida.push(...delPanel(p));
  }
  return salida;
}

/**
 * Fotos que la página ya trae para un producto de la web, con dirección completa, para que el panel
 * las muestre y, si se cambia algo, las guarde en Firestore junto con las nuevas.
 */
export function fotosDeLaPagina(curadas: readonly FotoGaleria[], de: { productoWeb?: string | undefined; firebaseId: string }): FotoProducto[] {
  return curadas
    .filter((f) => f.disponible !== false && ((!!de.productoWeb && f.producto === de.productoWeb) || f.firebaseId === de.firebaseId))
    .map((f) => ({
      url: `${SITIO}/${rutaGaleria(f.id)}`,
      forma: f.forma,
      ...(f.ancha ? { ancha: true } : {}),
      ...(f.carrusel === false ? { carrusel: false } : {}),
    }));
}

/** Firma corta para saber si la galería cambió y vale la pena volver a pintarla. */
export const firmaGaleria = (fotos: readonly FotoVista[]): string => fotos.map((f) => `${f.clave}|${f.url}|${f.agotado ? 1 : 0}|${f.carrusel === false ? 0 : 1}`).join(",");
