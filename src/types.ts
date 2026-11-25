/** Cómo se vende un producto. Igual que `tipoVenta` en la app. */
export type Unidad = "kg" | "pza";

export type CategoriaId = "pavo" | "cerdo" | "trad" | "guarn" | "pan" | "otros" | "maquila";

export interface Categoria {
  id: CategoriaId;
  nombre: string;
}

export interface Producto {
  /** Identificador estable de la web (no cambiarlo entre temporadas). */
  id: string;
  nombre: string;
  categoria: CategoriaId;
  unidad: Unidad;
  /** Precio de menudeo en pesos, por kg o por pieza. */
  precio: number;
  descripcion?: string;
  /** Muestra la etiqueta "Clásico". */
  clasico?: boolean;
  /** Destacado desde el panel (máximo 2): sale en grande arriba del menú. */
  destacado?: boolean;
  /** Marcado como nuevo desde el panel: lleva la etiqueta "Nuevo". */
  nuevo?: boolean;
  /** Pavo entero: se pide completo o medio, no por kilo. */
  pavoEntero?: boolean;
  /** Mínimo de kilos de este pavo completo, si es distinto al general (ej. el relleno empieza en 6 kg). */
  kgMinimoCompleto?: number;
  /** Pavo que solo se vende completo (sin medio pavo), como el ahumado. */
  soloCompleto?: boolean;
  /** Se pide por pieza (ej. patos) pero se cobra por kilo con un peso aproximado por pieza. */
  pieza?: PiezaPorPeso;
  /**
   * Combo Pavo: pechuga, relleno y piernas de pavo en una charola. La cantidad de la línea es el
   * número de personas y el precio sale del desglose con los precios por kilo de cada parte
   * (se toman de la lista al cargar, ver `resolverCombos`).
   */
  combo?: PreciosCombo;
  /**
   * Receta publicada por la app. Cuando existe, el combo se arma con ella (cantidades, versiones,
   * precios y partes opcionales); si no llega, se usa la configuración de `data/temporada`.
   */
  receta?: RecetaResuelta;
  /** Maquila: el cliente trae su carne y se cobra por kilo cocinado. Se puede agregar varias veces. */
  maquila?: boolean;
  /**
   * Versiones del mismo producto y precio (ej. pechuga horneada, adobada o mechada).
   * Cada versión es su propia línea del pedido.
   */
  versiones?: readonly string[];
  /**
   * Id de Firestore de cada versión, en el mismo orden que `versiones` (pechuga horneada = PROD_019…).
   * Con él, una versión que se elimina u oculta en el panel deja de salir. Sin él, las versiones son
   * solo estilos del mismo producto (pierna horneada o adobada) y salen siempre.
   */
  versionIds?: readonly string[];
  /**
   * Productos con distinto precio que se eligen juntos (ej. los lomos). En la lista se ven
   * como un solo renglón con sus opciones; `opcion` es el nombre corto dentro del grupo.
   */
  familia?: string;
  opcion?: string;
  /**
   * Ids del producto en Firestore (`products`). Si todos están sin disponibilidad,
   * la web lo muestra como AGOTADO.
   */
  firebaseIds: readonly string[];
  /**
   * Foto del producto para verla en grande (~1400 px). Ruta del sitio (`img/galeria/bacalao.jpg`)
   * o URL completa (`https://…`). Sin foto, la lista muestra el recuadro de "foto pronto".
   */
  imagen?: string;
  /** Miniatura 4:3 de ~320 px para la lista. Si falta, se usa `imagen`. */
  imagenMini?: string;
  /** Foto principal en tamaño real (súper panel): se carga al acercar en el visor. */
  imagenGrande?: string;
  /** Qué parte de la foto principal se ve en la miniatura. Sin él, el centro. */
  encuadre?: Encuadre;
  /**
   * Fotos de la galería subidas desde el súper panel (todas las de sus ids de Firestore).
   * Si existe, reemplaza a las fotos de `data/galeria.ts` que apuntan a este producto.
   */
  fotos?: readonly FotoProducto[];
}

/** Una foto de un producto en Firestore (`products/{id}.fotos`). La principal es la que está en `imagen`. */
export interface FotoProducto {
  url: string;
  /** "h" horizontal, "v" vertical (en la galería las verticales miden el doble de alto). */
  forma: "h" | "v";
  /** A lo ancho de dos columnas en la galería. */
  ancha?: boolean;
  /** false: solo en la página de galería, no en el carrusel del inicio. */
  carrusel?: boolean;
  /** false: no sale en la galería ni en el carrusel (sigue sirviendo de principal en el pedido y en la app). */
  galeria?: boolean;
  /** La misma foto en tamaño real (hasta 3000 px), para verla completa y acercarla en el visor. */
  grande?: string;
  /** Qué parte de la foto se ve en la miniatura del pedido (solo cuenta en la principal). */
  encuadre?: Encuadre;
}

/**
 * Encuadre de una miniatura: el punto que queda al centro (x, y en % de la foto, 50/50 = centro)
 * y cuánto se acerca (1 = sin acercar). Se aplica igual a la miniatura 4:3 (compu) y a la cuadrada (celular).
 */
export interface Encuadre {
  x: number;
  y: number;
  zoom: number;
}

/**
 * Receta publicada por la app en `publicWeb/disponibilidad.productos[id].receta`: un producto que
 * en realidad es la suma de otros (el Combo Pavo). La página la usa para armar el combo con las
 * mismas cantidades y precios que la app, sin tener nada escrito a mano.
 */
export interface RecetaPublica {
  personas: { minimo: number; alAgregar: number; maximo: number };
  /** Lo que se calcula por persona se redondea hacia arriba en pasos de este tamaño. */
  redondeoKg: number;
  empaque: { alAgregar?: string; permitidos: readonly string[] };
  /** Indicaciones para producción (van en el mensaje de WhatsApp). */
  instrucciones?: string;
  componentes: readonly ComponenteReceta[];
}

export interface ComponenteReceta {
  clave: string;
  nombre: string;
  /** Ids de Firestore que pueden ocupar ese lugar (las 4 versiones de pechuga). */
  opciones: readonly string[];
  /** El que entra por defecto. */
  alAgregar: string;
  modo: "POR_PERSONA" | "FIJA";
  /** Kg por persona (POR_PERSONA) o cantidad fija (FIJA). */
  cantidad: number;
  unidad: "GRANEL" | "PIEZA";
  /** Nunca se vende menos de esto. */
  minimo: number;
  /** Peso aproximado de cada pieza (2 piernas ≈ 700 g c/u). */
  kgPorPieza?: number;
  /** Va incluida, pero el cliente la puede quitar. */
  opcional?: boolean;
}

/** La receta ya ligada con los productos de Firestore (nombre, precio y si está agotado). */
export interface RecetaResuelta extends Omit<RecetaPublica, "componentes"> {
  partes: readonly ParteReceta[];
}

export interface ParteReceta extends Omit<ComponenteReceta, "opciones" | "alAgregar"> {
  opciones: readonly OpcionParte[];
  alAgregar: string;
}

export interface OpcionParte {
  id: string;
  nombre: string;
  /** Precio por kilo o por pieza, de Firestore. */
  precio: number;
  /** Cómo se vende ese producto. Una pierna se cuenta por pieza pero se cobra por kilo. */
  unidad: Unidad;
  /** Agotado u oculto en el panel: se ve tachada y no se puede elegir. */
  agotado?: boolean;
}

/** Precio por kilo de cada parte del Combo Pavo. */
export interface PreciosCombo {
  pechuga: number;
  relleno: number;
  pierna: number;
}

export interface PiezaPorPeso {
  nombre: string;
  plural: string;
  kgMin: number;
  kgMax: number;
  /** Peso que se usa para el estimado. */
  kgEstimado: number;
}

export type TamanoPavo = "completo" | "medio";

/** acrilico = sin costo; bolsa = bolsa o caja de cartón (pavos, sin costo). */
export type Presentacion = "acrilico" | "bolsa" | "vacio" | "charola";

export type TamanoEmpaque = "chica" | "mediana" | "grande";

export interface Linea {
  productoId: string;
  /** kg o número de piezas. En pavos enteros siempre 1: cada pavo es su propia línea. */
  cantidad: number;
  tamano: TamanoPavo;
  /** Solo pavo completo: kilos aproximados por pavo (mínimo 6). */
  kgPorPavo: number;
  presentacion: Presentacion;
  /** Maquila: qué carne trae el cliente ("" = todavía no elige). */
  tipoMaquila: string;
  /** Maquila con tipo "Otro": lo que escribe el cliente. */
  otroMaquila: string;
  /** Maquila de pavo relleno: kilos de relleno. */
  kgRelleno: number;
  /** true si el cliente cambió el relleno a mano (ya no se sugiere solo). */
  rellenoManual: boolean;
  /** Nota solo para este producto. */
  nota: string;
  /** Versión elegida en productos con `versiones` ("" si no aplica). */
  version: string;
  /** Combo con receta: qué versión eligió el cliente en cada parte (clave → id del producto). */
  comboVersiones?: Record<string, string>;
  /** Combo con receta: partes opcionales que el cliente quitó (van incluidas por default). */
  comboQuitados?: readonly string[];
}

export interface ZonaEnvio {
  nombre: string;
  costo: number;
  /** Lo que el cliente elige en el pedido. Santa Fe va aparte porque cae en dos alcaldías. */
  alcaldias: readonly string[];
}

/** Días especiales de diciembre. */
export type TipoDia = "limite" | "sujeto" | "tienda";

export interface DiaEspecial {
  dia: number;
  tipo: TipoDia;
}

export type ModoEntrega = "tienda" | "domicilio";

export interface Pedido {
  /** Llave = id de la línea. Es el id del producto, salvo en maquila y pavos enteros (maquila-1, pavo-relleno-2…). */
  lineas: Readonly<Record<string, Linea>>;
  nombre: string;
  modo: ModoEntrega;
  /** Alcaldía elegida para el envío: "" = sin elegir, "otra" = fuera de zona (se confirma por WhatsApp). */
  alcaldia: string;
  direccion: string;
  referencias: string;
  nota: string;
  /** Fecha de entrega "AAAA-MM-DD", o null si todavía no elige. */
  fecha: string | null;
}
