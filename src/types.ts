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
  /** Maquila: el cliente trae su carne y se cobra por kilo cocinado. Se puede agregar varias veces. */
  maquila?: boolean;
  /**
   * Ids del producto en Firestore (`products`). Si todos están sin disponibilidad,
   * la web lo muestra como AGOTADO.
   */
  firebaseIds: readonly string[];
}

export type TamanoPavo = "completo" | "medio";

/** acrilico = sin costo; bolsa = bolsa o caja de cartón (pavos, sin costo). */
export type Presentacion = "acrilico" | "bolsa" | "vacio" | "charola";

export type TamanoEmpaque = "chica" | "mediana" | "grande";

export interface Linea {
  productoId: string;
  /** kg (o número de piezas). En pavos enteros: número de pavos. */
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
  /** Nota solo para este producto. */
  nota: string;
}

export interface ZonaEnvio {
  nombre: string;
  costo: number;
}

/** Días especiales de diciembre. */
export type TipoDia = "limite" | "sujeto" | "tienda";

export interface DiaEspecial {
  dia: number;
  tipo: TipoDia;
}

export type ModoEntrega = "tienda" | "domicilio";

export interface Pedido {
  /** Llave = id de la línea. Es el id del producto, salvo en maquila (maquila-1, maquila-2…). */
  lineas: Readonly<Record<string, Linea>>;
  nombre: string;
  modo: ModoEntrega;
  zona: number;
  direccion: string;
  referencias: string;
  nota: string;
  /** Fecha de entrega "AAAA-MM-DD", o null si todavía no elige. */
  fecha: string | null;
}
