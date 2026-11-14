/** Cómo se vende un producto. Igual que `tipoVenta` en la app. */
export type Unidad = "kg" | "pza";

export type CategoriaId = "pavo" | "cerdo" | "trad" | "guarn" | "pan" | "maquila";

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
  /** Pavo entero: se pide completo o medio, no por kilo. */
  pavoEntero?: boolean;
  /** Mínimo de kilos de este pavo completo, si es distinto al general (ej. el relleno empieza en 6 kg). */
  kgMinimoCompleto?: number;
  /** Pavo que solo se vende completo (sin medio pavo), como el ahumado. */
  soloCompleto?: boolean;
  /** Se pide por pieza (ej. patos) pero se cobra por kilo con un peso aproximado por pieza. */
  pieza?: PiezaPorPeso;
  /** Maquila: el cliente trae su carne y se cobra por kilo cocinado. Se puede agregar varias veces. */
  maquila?: boolean;
  /**
   * Versiones del mismo producto y precio (ej. pechuga horneada, adobada o mechada).
   * Cada versión es su propia línea del pedido.
   */
  versiones?: readonly string[];
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
  /** Solo pavo completo: kilos aproximados por pavo (mínimo 5). */
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
