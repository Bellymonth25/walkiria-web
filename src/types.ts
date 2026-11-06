/** Cómo se vende un producto. Igual que `tipoVenta` en la app. */
export type Unidad = "kg" | "pza";

export type CategoriaId = "pavo" | "cerdo" | "trad" | "guarn" | "pan";

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
  /** kg (o número de piezas). En pavos enteros: número de pavos. */
  cantidad: number;
  tamano: TamanoPavo;
  /** Solo pavo completo: kilos aproximados por pavo (mínimo 5). */
  kgPorPavo: number;
  presentacion: Presentacion;
}

export interface ZonaEnvio {
  nombre: string;
  costo: number;
}

export interface DiaEntrega {
  /** Día de diciembre. */
  dia: number;
  /** true en 24 y 31: no hay envíos a domicilio. */
  soloTienda?: boolean;
}

export type ModoEntrega = "tienda" | "domicilio";

export interface Pedido {
  lineas: Readonly<Record<string, Linea>>;
  nombre: string;
  modo: ModoEntrega;
  zona: number;
  direccion: string;
  referencias: string;
  nota: string;
  /** Día de diciembre elegido, o null si todavía no elige. */
  dia: number | null;
}
