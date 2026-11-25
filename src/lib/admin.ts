import type { Encuadre, FotoProducto, Producto } from "../types";
import { normalizarEncuadre } from "./encuadre";
import type { FotoGaleria } from "../data/galeria";
import { fotosDeLaPagina, SITIO } from "./galeria";

/**
 * Producto de Firestore (`products`) tal como lo usa el súper panel.
 * Firestore es la verdad: la app y la web leen de aquí.
 */
export interface ProductoFirestore {
  id: string;
  /**
   * El campo `id` guardado dentro del documento, solo cuando no coincide con el id del documento.
   * La app y la página usan ese campo: si se repite con otro producto, uno tapa al otro
   * (pasó con la Chapata: PROD_054 traía id "PROD_053"). Al guardar se corrige.
   */
  idGuardado?: string;
  nombre: string;
  categoria: Categoria;
  grupo: string;
  menudeo: number;
  mayoreo: number;
  /** tipoVenta de la app: Kg, Pza, Lt, Envio. */
  unidad: string;
  presentacion: string;
  /** Foto principal: la que se ve en la app y al elegir el producto en el pedido. Es una de `fotos`. */
  imagen: string;
  /** Todas las fotos del producto; todas salen en la galería de la página. */
  fotos: FotoProducto[];
  /** El producto ya tiene la lista `fotos` en Firestore (aunque esté vacía): el panel manda sobre sus fotos. */
  conFotos: boolean;
  maquila: boolean;
  pesoAjustable: boolean;
  disponible: boolean;
  /** No se muestra ni en la app ni en la web. */
  oculto: boolean;
  /** Sale en grande arriba del menú de la página. Máximo [MAX_DESTACADOS] a la vez. */
  destacado: boolean;
  /** Lleva la etiqueta "Nuevo" en la página. */
  nuevo: boolean;
  /** Receta: el producto es un combo que se arma con otros productos. null = producto normal. */
  receta: RecetaAdmin | null;
  /** Última modificación hecha desde el panel (null si nunca se ha tocado desde ahí). */
  actualizadoEn: Date | null;
  actualizadoPor: string;
}

/**
 * Receta de un combo tal como la edita el panel. Se guarda en `products/{id}.receta` y de ahí la
 * leen la app y la página: las cantidades, los precios y las versiones salen de los productos.
 */
export interface RecetaAdmin {
  personas: { minimo: number; alAgregar: number; maximo: number };
  /** Lo que se calcula por persona se redondea hacia arriba en pasos de este tamaño. */
  redondeoKg: number;
  empaque: { alAgregar: string; permitidos: string[] };
  /** Indicaciones para producción (salen en cocina y en el mensaje de WhatsApp). */
  instrucciones: string;
  componentes: ComponenteAdmin[];
}

export interface ComponenteAdmin {
  /** Nombre corto sin espacios con el que se identifica la parte (pechuga, relleno, piernas). */
  clave: string;
  nombre: string;
  /** Ids de los productos que pueden ocupar ese lugar (las 4 versiones de pechuga). */
  opciones: string[];
  /** El que entra por defecto al agregar el combo. */
  alAgregar: string;
  modo: "POR_PERSONA" | "FIJA";
  /** Cantidad por persona (POR_PERSONA) o cantidad fija (FIJA). */
  cantidad: number;
  unidad: "GRANEL" | "PIEZA";
  /** Nunca se vende menos de esto. */
  minimo: number;
  /** Peso aproximado de cada pieza (una pierna ≈ 0.7 kg). 0 = no aplica. */
  kgPorPieza: number;
  /** Va incluida, pero se puede quitar al levantar el pedido. */
  opcional: boolean;
}

/** Presentaciones (de la app) que puede llevar un combo. */
export const EMPAQUES_RECETA = [
  "SIN_PRESENTACION",
  "CHAROLA_CHICA",
  "CHAROLA_MEDIANA",
  "CHAROLA_GRANDE",
  "VACIO_CHICO",
  "VACIO_MEDIANO",
  "VACIO_GRANDE",
  "ACRILICO",
  "BOLSA",
] as const;

export const NOMBRE_EMPAQUE: Record<string, string> = {
  SIN_PRESENTACION: "Sin presentación",
  CHAROLA_CHICA: "Charola chica",
  CHAROLA_MEDIANA: "Charola mediana",
  CHAROLA_GRANDE: "Charola grande",
  VACIO_CHICO: "Vacío chico",
  VACIO_MEDIANO: "Vacío mediano",
  VACIO_GRANDE: "Vacío grande",
  ACRILICO: "Acrílico",
  BOLSA: "Bolsa",
};

/** Receta nueva, con lo que casi siempre aplica (el Combo Pavo de 2 a 5 personas). */
export const recetaNueva = (): RecetaAdmin => ({
  personas: { minimo: 2, alAgregar: 4, maximo: 5 },
  redondeoKg: 0.125,
  empaque: { alAgregar: "CHAROLA_MEDIANA", permitidos: ["CHAROLA_CHICA", "CHAROLA_MEDIANA"] },
  instrucciones: "",
  componentes: [],
});

/** "Pechuga de pavo" -> "pechuga": la primera palabra, sin acentos ni símbolos. */
const claveBase = (nombre: string): string =>
  nombre
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .find((w) => w.length > 0) ?? "parte";

/**
 * Cada parte necesita una clave interna para que la app reconozca la parte al modificar un
 * pedido. No se le pide a nadie: sale del nombre ("pechuga", "relleno"…). Una parte ya guardada
 * conserva la suya aunque se le cambie el nombre, para no romper los pedidos que ya la usan.
 */
export function asignarClaves(r: RecetaAdmin): RecetaAdmin {
  const usadas = new Set(r.componentes.map((c) => c.clave).filter(Boolean));
  const componentes = r.componentes.map((c) => {
    if (c.clave) return c;
    const base = claveBase(c.nombre);
    let clave = base;
    for (let n = 2; usadas.has(clave); n++) clave = `${base}${n}`;
    usadas.add(clave);
    return { ...c, clave };
  });
  return { ...r, componentes };
}

export const componenteNuevo = (): ComponenteAdmin => ({
  clave: "",
  nombre: "",
  opciones: [],
  alAgregar: "",
  modo: "POR_PERSONA",
  cantidad: 0.125,
  unidad: "GRANEL",
  minimo: 0.25,
  kgPorPieza: 0,
  opcional: false,
});

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
  const idCampo = texto(d.id);
  return {
    id,
    ...(idCampo && idCampo !== id ? { idGuardado: idCampo } : {}),
    nombre: texto(d.nombre, id) || id,
    categoria: cat,
    grupo: GRUPOS.includes(g) ? g : "OTROS",
    menudeo: numero(d.menudeo),
    mayoreo: numero(d.mayoreo),
    unidad: texto(d.tipoVenta),
    presentacion: texto(d.presentacion),
    imagen: texto(d.imagen),
    fotos: leerFotos(d.fotos),
    conFotos: Array.isArray(d.fotos),
    maquila: d.isMaquila === true,
    pesoAjustable: d.isWeightAdjustable === true,
    // Igual que la app: sin el campo, cuenta como agotado.
    disponible: d.estaDisponible === true,
    oculto: d.oculto === true,
    destacado: d.destacado === true,
    nuevo: d.nuevo === true,
    receta: leerReceta(d.receta),
    actualizadoEn: aFecha(d.actualizadoEn),
    actualizadoPor: texto(d.actualizadoPor),
  };
}

/** Receta de Firestore sin confiar en sus tipos. null cuando el producto no es un combo. */
export function leerReceta(v: unknown): RecetaAdmin | null {
  if (!v || typeof v !== "object") return null;
  const d = v as Record<string, unknown>;
  const per = (d.personas ?? {}) as Record<string, unknown>;
  const emp = (d.empaque ?? {}) as Record<string, unknown>;
  const base = recetaNueva();
  const minimo = Math.max(1, Math.round(numero(per.minimo)) || base.personas.minimo);
  const alAgregar = Math.max(minimo, Math.round(numero(per.alAgregar)) || minimo);

  const componentes = (Array.isArray(d.componentes) ? d.componentes : []).map((x): ComponenteAdmin => {
    const c = (x ?? {}) as Record<string, unknown>;
    const opciones = (Array.isArray(c.opciones) ? c.opciones : []).filter((o): o is string => typeof o === "string" && !!o);
    const alAgregarC = texto(c.alAgregar);
    return {
      clave: texto(c.clave),
      nombre: texto(c.nombre),
      opciones,
      alAgregar: opciones.includes(alAgregarC) ? alAgregarC : (opciones[0] ?? ""),
      modo: c.modo === "FIJA" ? "FIJA" : "POR_PERSONA",
      cantidad: numero(c.cantidad),
      unidad: c.unidad === "PIEZA" ? "PIEZA" : "GRANEL",
      minimo: numero(c.minimo),
      kgPorPieza: numero(c.kgPorPieza),
      opcional: c.opcional === true,
    };
  });

  return {
    personas: { minimo, alAgregar, maximo: Math.max(alAgregar, Math.round(numero(per.maximo))) },
    redondeoKg: numero(d.redondeoKg) || base.redondeoKg,
    empaque: {
      alAgregar: texto(emp.alAgregar, base.empaque.alAgregar),
      permitidos: (Array.isArray(emp.permitidos) ? emp.permitidos : []).filter((e): e is string => typeof e === "string" && !!e),
    },
    instrucciones: texto(d.instrucciones),
    componentes,
  };
}

/**
 * Lo que falta para que la receta sirva. Si algo está mal, la app y la página la ignoran y el
 * producto se comporta como uno normal, así que es mejor avisarlo al guardar.
 */
export function validarReceta(r: RecetaAdmin, productos: readonly ProductoFirestore[]): string | null {
  const { minimo, alAgregar, maximo } = r.personas;
  if (!(minimo >= 1)) return "Las personas mínimas de la receta deben ser 1 o más.";
  if (maximo < minimo) return "El máximo de personas no puede ser menor al mínimo.";
  if (alAgregar < minimo || alAgregar > maximo) return "Las personas con las que entra el combo tienen que estar entre el mínimo y el máximo.";
  if (!(r.redondeoKg > 0)) return "El redondeo tiene que ser mayor a 0 (por ejemplo 0.125 kg).";
  if (!r.componentes.length) return "Agrega al menos una parte a la receta.";
  if (!r.empaque.permitidos.length) return "Elige al menos un empaque para el combo.";
  if (!r.empaque.permitidos.includes(r.empaque.alAgregar)) return "El empaque con el que entra el combo tiene que estar entre los permitidos.";

  for (const [n, c] of r.componentes.entries()) {
    const quien = c.nombre.trim() || "una parte";
    if (!c.nombre.trim()) return `Ponle nombre a la parte ${n + 1}.`;
    if (!c.opciones.length) return `Elige los productos que pueden ir en ${quien}.`;
    const fuera = c.opciones.filter((id) => !productos.some((p) => p.id === id));
    if (fuera.length) return `${quien}: ${fuera.join(", ")} ya no existe${fuera.length > 1 ? "n" : ""} en el panel.`;
    if (!(c.cantidad > 0)) return `La cantidad de ${quien} tiene que ser mayor a 0.`;
    if (c.minimo < 0) return `El mínimo de ${quien} no puede ser negativo.`;
    if (c.unidad === "PIEZA" && c.modo === "FIJA" && !Number.isInteger(c.cantidad)) return `${quien} se cuenta por pieza: la cantidad tiene que ser un número entero.`;
  }
  return null;
}

/** Qué lleva el combo para cierto número de personas, para la vista previa del panel. */
export function vistaPreviaReceta(r: RecetaAdmin, personas: number, productos: readonly ProductoFirestore[]): { texto: string; total: number } {
  const n = Math.min(r.personas.maximo, Math.max(r.personas.minimo, personas));
  const partes: string[] = [];
  let total = 0;
  for (const c of r.componentes) {
    const prod = productos.find((p) => p.id === (c.alAgregar || c.opciones[0]));
    if (!prod) continue;
    const paso = c.unidad === "PIEZA" ? 1 : r.redondeoKg;
    const cantidad = c.modo === "FIJA" ? c.cantidad : Math.max(c.minimo, Math.ceil((c.cantidad * n) / paso - 1e-9) * paso);
    // Una parte que se cuenta por pieza pero se vende por kilo se cobra por su peso aproximado.
    const porKilo = prod.unidad.toLowerCase() === "kg";
    const kg = c.unidad === "PIEZA" && c.kgPorPieza > 0 ? Math.round(cantidad * c.kgPorPieza * 1e6) / 1e6 : null;
    const importe = prod.menudeo * (porKilo && kg !== null ? kg : cantidad);
    total += importe;
    const medida = c.unidad === "PIEZA" ? `${cantidad} ${cantidad === 1 ? "pza" : "pzas"}${kg !== null ? ` (aprox. ${kg} kg)` : ""}` : `${Math.round(cantidad * 1000) / 1000} kg`;
    partes.push(`${prod.nombre} ${medida}${c.opcional ? " (opcional)" : ""}`);
  }
  return { texto: partes.length ? `Para ${n}: ${partes.join(" · ")}` : "Agrega partes para ver qué lleva el combo.", total: Math.round(total * 100) / 100 };
}

/** Lista `fotos` de Firestore sin confiar en sus tipos: solo pasan las que traen url. */
export function leerFotos(v: unknown): FotoProducto[] {
  if (!Array.isArray(v)) return [];
  return v.flatMap((x): FotoProducto[] => {
    const f = (x ?? {}) as Record<string, unknown>;
    const url = texto(f.url);
    if (!url) return [];
    const grande = texto(f.grande);
    const encuadre = normalizarEncuadre(f.encuadre as Partial<Encuadre> | undefined);
    return [
      {
        url,
        forma: f.forma === "v" ? "v" : "h",
        ...(f.ancha === true ? { ancha: true } : {}),
        ...(f.carrusel === false ? { carrusel: false } : {}),
        ...(f.galeria === false ? { galeria: false } : {}),
        ...(grande ? { grande } : {}),
        ...(encuadre ? { encuadre } : {}),
      },
    ];
  });
}

/** Acepta un Timestamp de Firestore (con toDate) o una fecha; cualquier otra cosa es null. */
function aFecha(v: unknown): Date | null {
  if (v instanceof Date) return v;
  const t = (v as { toDate?: () => Date } | null)?.toDate;
  return typeof t === "function" ? t.call(v) : null;
}

/** "14 nov 2026, 10:41" en hora de México. */
export function fechaCorta(f: Date): string {
  return new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "America/Mexico_City" })
    .format(f)
    .replace(/\./g, "");
}

/** Texto de "última modificación" para la ficha. */
/**
 * Quién hizo el último cambio, por su nombre (el `name` de su usuario en `user/{uid}`).
 * [nombres] liga correo → nombre; si no se conoce, la parte del correo antes de la @.
 */
export function quienModifico(p: Pick<ProductoFirestore, "actualizadoPor">, nombres: ReadonlyMap<string, string> = new Map()): string {
  const correo = p.actualizadoPor.trim();
  if (!correo) return "";
  return nombres.get(correo.toLowerCase()) || correo.split("@")[0]!;
}

export function textoModificacion(p: ProductoFirestore, nombres: ReadonlyMap<string, string> = new Map()): string {
  if (!p.actualizadoEn) return "Sin cambios registrados desde el panel.";
  const quien = quienModifico(p, nombres);
  return `Última modificación: ${fechaCorta(p.actualizadoEn)}${quien ? ` por ${quien}` : ""}.`;
}

type ValorDoc = string | number | boolean | FotoProducto[] | RecetaAdmin | null;

/** Lo que se guarda en Firestore, con los nombres de campo de la app. */
export function aDocumento(p: ProductoFirestore): Record<string, ValorDoc> {
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
    fotos: p.fotos,
    isMaquila: p.maquila,
    isWeightAdjustable: p.pesoAjustable,
    estaDisponible: p.disponible,
    oculto: p.oculto,
    destacado: p.destacado,
    nuevo: p.nuevo,
    // null deja al producto como uno normal (la app y la página la ignoran).
    receta: p.receta,
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
    fotos: [],
    conFotos: false,
    maquila: false,
    pesoAjustable: true,
    disponible: true,
    oculto: false,
    destacado: false,
    nuevo: false,
    receta: null,
    actualizadoEn: null,
    actualizadoPor: "",
  };
}

/** Cuántos productos se pueden destacar a la vez en la página. */
export const MAX_DESTACADOS = 2;

/** Los otros productos que ya están destacados (sin contar a [p]). */
export const otrosDestacados = (p: Pick<ProductoFirestore, "id">, todos: readonly ProductoFirestore[]): ProductoFirestore[] =>
  todos.filter((o) => o.id !== p.id && o.destacado);

/** Revisa la ficha antes de guardar. Regresa el mensaje para el usuario o null si está bien. */
export function validar(p: ProductoFirestore, otros: readonly ProductoFirestore[]): string | null {
  if (!p.nombre.trim()) return "Escribe el nombre del producto.";
  if (p.destacado) {
    const ya = otrosDestacados(p, otros);
    if (ya.length >= MAX_DESTACADOS) return `Solo se pueden destacar ${MAX_DESTACADOS} a la vez. Ya están ${ya.map((o) => `"${o.nombre}"`).join(" y ")}: quítale el destacado a uno primero.`;
    if (p.categoria !== "Comida") return "Solo la comida se puede destacar en la página.";
  }
  const repetido = otros.find((o) => o.id !== p.id && o.nombre.trim().toLowerCase() === p.nombre.trim().toLowerCase());
  if (repetido) return `Ya existe "${repetido.nombre}" (${repetido.id}).`;
  // Un combo no tiene precio propio: se cobra la suma de sus partes.
  if (!p.receta && !(p.menudeo > 0)) return "El precio de menudeo debe ser mayor a 0.";
  if (p.menudeo < 0) return "El precio de menudeo no puede ser negativo.";
  if (p.mayoreo < 0) return "El precio de mayoreo no puede ser negativo.";
  if (p.imagen && !/^https:\/\//.test(p.imagen)) return "La foto debe ser un enlace que empiece con https://";
  if (p.fotos.length && !p.fotos.some((f) => f.url === p.imagen)) return "Marca con ★ cuál foto es la principal.";
  return null;
}

/**
 * Fotos con las que abre la ficha. Si el producto aún no tiene `fotos` en Firestore, se muestran las
 * que la página ya traía para él (solo en su primer id, para no repetirlas en la pechuga y sus
 * versiones) y su foto principal. Así, al agregar o quitar una, el panel se queda a cargo de todas.
 * Las fotos de relleno de otros sitios no se ofrecen.
 */
export function fotosParaFicha(p: ProductoFirestore, web: readonly Producto[], curadas: readonly FotoGaleria[]): { fotos: FotoProducto[]; imagen: string; dePagina: boolean } {
  if (p.conFotos) return { fotos: p.fotos, imagen: p.fotos.some((f) => f.url === p.imagen) ? p.imagen : (p.fotos[0]?.url ?? ""), dePagina: false };
  const propia = (u: string) => /^https:\/\/firebasestorage\.googleapis\.com\//.test(u) || u.startsWith(`${SITIO}/img/`);
  const pw = web.find((x) => x.firebaseIds[0] === p.id);
  const dePagina = fotosDeLaPagina(curadas, { productoWeb: pw?.id, firebaseId: p.id });
  // La principal: la que ya se sube desde el panel o, si no, la que usa la página en el pedido.
  const principalWeb = pw?.imagen && /^img\/galeria\//.test(pw.imagen) ? `${SITIO}/${pw.imagen}` : "";
  const principal = propia(p.imagen) ? p.imagen : principalWeb;
  const fotos = [...dePagina];
  if (principal && !fotos.some((f) => f.url === principal)) fotos.unshift({ url: principal, forma: "h" });
  return { fotos, imagen: principal || (fotos[0]?.url ?? ""), dePagina: dePagina.length > 0 };
}

/**
 * La foto como se puede ver aquí mismo: las de la página se cargan del mismo sitio, con ruta relativa
 * para que funcione en el dominio, en la vista previa de GitHub Pages (/walkiria-web/) y en local.
 */
export const urlVista = (url: string): string => (url.startsWith(`${SITIO}/`) ? url.slice(SITIO.length + 1) : url);

/** Para el contador del renglón: cuántas fotos tiene (las del panel o, si no hay, las de la página). */
export function cuantasFotos(p: ProductoFirestore, web: readonly Producto[], curadas: readonly FotoGaleria[]): number {
  return fotosParaFicha(p, web, curadas).fotos.length;
}

/** Campos que cambiaron entre dos versiones (para no reescribir lo que no se tocó). */
export function cambios(antes: ProductoFirestore, despues: ProductoFirestore): Record<string, ValorDoc> {
  const a = aDocumento(antes);
  const d = aDocumento(despues);
  const diff = Object.fromEntries(Object.entries(d).filter(([k, v]) => JSON.stringify(a[k]) !== JSON.stringify(v)));
  // Si el id guardado adentro no es el del documento, se corrige aunque no haya otro cambio.
  if (antes.idGuardado && antes.idGuardado !== despues.id) diff.id = despues.id;
  return diff;
}

/** Para eliminar hay que escribir el nombre exacto del producto (como en Firebase). */
export const coincideNombre = (escrito: string, nombre: string): boolean => nombre.trim() !== "" && escrito.trim() === nombre.trim();

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

/**
 * Dónde sale una foto en la página: en el carrusel del inicio y la galería, solo en la galería,
 * o en ningún lado (sigue sirviendo como principal del pedido y de la app).
 */
export type Visibilidad = "todo" | "galeria" | "nada";

export const visibilidad = (f: FotoProducto): Visibilidad => (f.galeria === false ? "nada" : f.carrusel === false ? "galeria" : "todo");

export const TEXTO_VISIBILIDAD: Record<Visibilidad, string> = { todo: "Visible", galeria: "Solo galería", nada: "Oculta" };

/** Un toque pasa a la siguiente: visible (inicio y galería) → solo galería → oculta → visible. */
export function cambiarVisibilidad(f: FotoProducto): FotoProducto {
  const { carrusel: _c, galeria: _g, ...resto } = f;
  const v = visibilidad(f);
  if (v === "todo") return { ...resto, carrusel: false };
  if (v === "galeria") return { ...resto, carrusel: false, galeria: false };
  return resto;
}
