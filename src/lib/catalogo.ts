import type { CategoriaId, ComponenteReceta, FotoProducto, OpcionParte, ParteReceta, Producto, RecetaPublica, RecetaResuelta } from "../types";
import { SITIO, urlLocal } from "./galeria";
import { normalizarEncuadre } from "./encuadre";
import { normalizar } from "./formato";
import { resolverCombos } from "./combo";

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
  /** Oculto en el panel: no sale (ni sus versiones). */
  oculto?: boolean;
  /**
   * Fotos de la galería subidas desde el panel. La principal es `imagen`. undefined: el producto
   * nunca ha tenido fotos en el panel (la galería usa las de la página); [] = se quitaron todas.
   */
  fotos?: FotoProducto[];
  /** Receta del producto (combos): con ella la página arma el combo igual que la app. */
  receta?: RecetaPublica;
}

type Valor = {
  stringValue?: string;
  integerValue?: string;
  doubleValue?: number;
  booleanValue?: boolean;
  mapValue?: { fields?: Record<string, Valor> };
  arrayValue?: { values?: Valor[] };
};

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
    const receta = leerReceta(f.receta);
    salida.set(id, { nombre: texto(f.nombre) || id, precio: numero(f.precio), imagen: texto(f.imagen), grupo: texto(f.grupo), unidad: texto(f.unidad), ...(f.oculto?.booleanValue ? { oculto: true } : {}), ...(receta ? { receta } : {}), ...conFotos(leerFotos(f.fotos)) });
  }
  return salida;
}

/**
 * Receta en formato REST. Devuelve undefined si está incompleta: el producto se comporta
 * como uno normal y el combo sigue usando la configuración de la página.
 */
function leerReceta(v: Valor | undefined): RecetaPublica | undefined {
  const f = v?.mapValue?.fields;
  if (!f) return undefined;

  const componentes = (f.componentes?.arrayValue?.values ?? []).flatMap((x): ComponenteReceta[] => {
    const c = x.mapValue?.fields ?? {};
    const clave = texto(c.clave);
    const opciones = (c.opciones?.arrayValue?.values ?? []).map(texto).filter((o) => !!o);
    if (!clave || !opciones.length) return [];
    const alAgregar = texto(c.alAgregar);
    const kgPorPieza = numero(c.kgPorPieza);
    return [
      {
        clave,
        nombre: texto(c.nombre) || clave,
        opciones,
        alAgregar: opciones.includes(alAgregar) ? alAgregar : opciones[0]!,
        modo: texto(c.modo) === "FIJA" ? "FIJA" : "POR_PERSONA",
        cantidad: numero(c.cantidad),
        unidad: texto(c.unidad) === "PIEZA" ? "PIEZA" : "GRANEL",
        minimo: numero(c.minimo),
        ...(kgPorPieza > 0 ? { kgPorPieza } : {}),
        ...(c.opcional?.booleanValue ? { opcional: true } : {}),
      },
    ];
  });
  if (!componentes.length) return undefined;

  const per = f.personas?.mapValue?.fields ?? {};
  const emp = f.empaque?.mapValue?.fields ?? {};
  const minimo = Math.max(1, numero(per.minimo) || 1);
  const alAgregar = numero(per.alAgregar) || minimo;
  const instrucciones = texto(f.instrucciones);
  const empaqueDefault = texto(emp.alAgregar);

  return {
    personas: { minimo, alAgregar, maximo: Math.max(alAgregar, numero(per.maximo) || alAgregar) },
    redondeoKg: numero(f.redondeoKg) || 0.125,
    empaque: {
      ...(empaqueDefault ? { alAgregar: empaqueDefault } : {}),
      permitidos: (emp.permitidos?.arrayValue?.values ?? []).map(texto).filter((e) => !!e),
    },
    ...(instrucciones ? { instrucciones } : {}),
    componentes,
  };
}

/**
 * Liga la receta con los productos del panel: nombre y precio de cada opción salen de Firestore
 * y las que ya no existen se caen. [noDisponibles] son los ids agotados u ocultos: sus opciones
 * se marcan para que la página las muestre tachadas y no las pueda elegir.
 */
function resolverReceta(receta: RecetaPublica, publico: ReadonlyMap<string, ProductoPublico>, noDisponibles: ReadonlySet<string>): RecetaResuelta | undefined {
  const partes = receta.componentes.flatMap((c): ParteReceta[] => {
    const opciones = c.opciones.flatMap((id): OpcionParte[] => {
      const fs = publico.get(id);
      if (!fs || fs.oculto) return [];
      return [{ id, nombre: fs.nombre, precio: fs.precio, unidad: fs.unidad.toLowerCase() === "pza" ? "pza" : "kg", ...(noDisponibles.has(id) ? { agotado: true } : {}) }];
    });
    if (!opciones.length) return [];
    const { opciones: _ids, alAgregar, ...resto } = c;
    return [{ ...resto, opciones, alAgregar: opciones.some((o) => o.id === alAgregar) ? alAgregar : opciones[0]!.id }];
  });
  if (!partes.length) return undefined;
  const { componentes: _c, ...resto } = receta;
  return { ...resto, partes };
}

/** Lista `fotos` en formato REST. Solo pasan las fotos propias (Storage o la página). */
function leerFotos(v: Valor | undefined): FotoProducto[] | undefined {
  if (!v?.arrayValue) return undefined;
  return (v?.arrayValue?.values ?? []).flatMap((x): FotoProducto[] => {
    const f = x.mapValue?.fields ?? {};
    const url = texto(f.url);
    if (!esFotoPropia(url)) return [];
    const grande = texto(f.grande);
    const e = f.encuadre?.mapValue?.fields;
    const encuadre = e ? normalizarEncuadre({ x: numero(e.x), y: numero(e.y), zoom: numero(e.zoom) }) : undefined;
    return [
      {
        url,
        forma: texto(f.forma) === "v" ? "v" : "h",
        ...(f.ancha?.booleanValue ? { ancha: true } : {}),
        ...(f.carrusel?.booleanValue === false ? { carrusel: false } : {}),
        ...(f.galeria?.booleanValue === false ? { galeria: false } : {}),
        ...(esFotoPropia(grande) ? { grande } : {}),
        ...(encuadre ? { encuadre } : {}),
      },
    ];
  });
}

/**
 * Solo se usan fotos subidas desde el panel (Firebase Storage) o que ya vivían en la página
 * (https://www.lawalkiria.com.mx/img/…). Las que ya traía `products` son de relleno de otros
 * sitios; mientras no se cambien, la web conserva sus fotos.
 */
export const esFotoPropia = (url: string): boolean => /^https:\/\/firebasestorage\.googleapis\.com\//.test(url) || url.startsWith(`${SITIO}/img/`);

/**
 * Foto principal de Firestore para el renglón del pedido. Si es la misma foto que la web ya tenía,
 * se conserva su miniatura ligera; si es nueva, la miniatura es la misma foto.
 */
function fotoPrincipal(p: Producto, imagen: string, fotos: readonly FotoProducto[] = []): Partial<Pick<Producto, "imagen" | "imagenMini" | "imagenGrande" | "encuadre">> {
  if (!esFotoPropia(imagen)) return {};
  const local = urlLocal(imagen);
  // Encuadre y tamaño real vienen de la foto principal dentro de `fotos`.
  const f = fotos.find((x) => x.url === imagen);
  // Con encuadre, la miniatura ligera de la página (ya recortada) no sirve: se usa la foto.
  const mini = !f?.encuadre && local === p.imagen && p.imagenMini ? p.imagenMini : local;
  return {
    imagen: local,
    imagenMini: mini,
    ...(f?.grande ? { imagenGrande: urlLocal(f.grande) } : {}),
    ...(f?.encuadre ? { encuadre: f.encuadre } : {}),
  };
}

/** Agrega `fotos` solo si existe (con exactOptionalPropertyTypes no se puede poner undefined). */
const conFotos = (fotos: FotoProducto[] | undefined): { fotos?: FotoProducto[] } => (fotos ? { fotos } : {});

/** Sección de la web según el grupo de la app. */
const CATEGORIA_DE_GRUPO: Record<string, CategoriaId> = {
  AVES: "pavo",
  CARNES: "cerdo",
  PASTAS: "guarn",
  GUARNICIONES: "guarn",
  POSTRES: "pan",
  MAQUILAS: "maquila",
};

/** "Horneada, adobada o mechada." */
const enLista = (xs: readonly string[]): string => {
  const t = (xs.length <= 1 ? (xs[0] ?? "") : `${xs.slice(0, -1).join(", ")} o ${xs[xs.length - 1]}`).toLowerCase();
  return t ? `${t.charAt(0).toUpperCase()}${t.slice(1)}.` : "";
};

/**
 * Junta Firestore con las reglas de la web. Firestore manda QUÉ productos hay:
 * - Un renglón de la web sale solo si está en Firestore: por sus ids o, si no tiene, por el mismo
 *   nombre (así se liga el Combo Pavo cuando se da de alta en el panel). Si no, no sale: un producto
 *   eliminado en el panel, o que nunca se dio de alta, no aparece en la página.
 * - Precio (y foto, si es propia) de Firestore. Con versiones o familia se usa el primer id.
 * - Nombre de Firestore cuando el producto de la web es uno solo (sin versiones ni familia).
 * - Con `versionIds`, las versiones eliminadas u ocultas en el panel no salen y la descripción
 *   se arma con las que quedan.
 * - Lo que está en Firestore y no en la web se agrega como producto sencillo.
 * Agotados y ocultos se resuelven aparte, con las listas de ids.
 * Sin datos de Firestore (no respondió y no hay nada guardado) se usa la lista de la web tal cual.
 */
export function aplicarCatalogo(base: readonly Producto[], publico: ReadonlyMap<string, ProductoPublico>, noDisponibles: ReadonlySet<string> = new Set()): Producto[] {
  if (!publico.size) return resolverCombos([...base]);
  const porNombre = new Map([...publico].map(([id, p]) => [normalizar(p.nombre.trim()), id]));
  const usados = new Set<string>();
  const vivo = (id: string) => !!publico.get(id) && !publico.get(id)!.oculto;

  const lista = base.flatMap((p): Producto[] => {
    const ligado = (p.firebaseIds.length ? p.firebaseIds : [porNombre.get(normalizar(p.nombre.trim()))]).filter((x): x is string => !!x && publico.has(x));
    if (!ligado.length) return [];
    ligado.forEach((id) => usados.add(id));
    const fs = publico.get(ligado[0]!)!;
    // Versiones ligadas a su propio id: solo las que siguen en el panel y no están ocultas.
    let conVersiones: Partial<Pick<Producto, "versiones" | "versionIds" | "descripcion">> = {};
    if (p.versiones && p.versionIds) {
      const i = p.versiones.map((_, k) => k).filter((k) => vivo(p.versionIds![k] ?? ""));
      if (!i.length) return [];
      const versiones = i.map((k) => p.versiones![k]!);
      conVersiones = { versiones, versionIds: i.map((k) => p.versionIds![k]!), descripcion: enLista(versiones) };
    }
    // Fotos de la galería: las de todos sus ids (la pechuga junta horneada, adobada y mechada).
    // Si ninguno las maneja desde el panel, se quedan las de la página.
    const delPanel = ligado.map((id) => publico.get(id)?.fotos).filter((x): x is FotoProducto[] => !!x);
    const fotos = delPanel.length ? delPanel.flat() : undefined;
    const sencillo = ligado.length === 1 && !p.versiones && !p.familia;
    // Receta (combos): con ella el combo se arma con las cantidades, versiones y precios del panel.
    const receta = fs.receta ? resolverReceta(fs.receta, publico, noDisponibles) : undefined;
    const r: Producto = {
      ...p,
      firebaseIds: ligado,
      ...conVersiones,
      ...(receta ? { receta } : {}),
      precio: fs.precio > 0 ? fs.precio : p.precio,
      nombre: sencillo && fs.nombre ? fs.nombre : p.nombre,
      ...fotoPrincipal(p, fs.imagen, fs.fotos),
      ...conFotos(fotos),
    };
    // Si en el panel se quitaron todas sus fotos, en el pedido sale "Foto pronto".
    if (fs.fotos && !esFotoPropia(fs.imagen)) {
      delete r.imagen;
      delete r.imagenMini;
    }
    return [r];
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
        ...fotoPrincipal({ id, nombre: p.nombre, categoria: "otros", unidad: "kg", precio: 0, firebaseIds: [] }, p.imagen, p.fotos),
        ...conFotos(p.fotos),
      }),
    );
  return resolverCombos([...lista, ...extra]);
}
