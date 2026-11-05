/** Cómo se vende un producto. Igual que `tipoVenta` en la app. */
export type Unidad = "kg" | "pza" | "lt";

export type CategoriaId = "pavo" | "cerdo" | "trad" | "guarn" | "pan" | "serv";

export interface Categoria {
  id: CategoriaId;
  nombre: string;
}

export interface Producto {
  /** Identificador estable (no cambiarlo entre temporadas; se usa en el pedido). */
  id: string;
  nombre: string;
  categoria: CategoriaId;
  unidad: Unidad;
  /** Precio de menudeo en pesos, por unidad. */
  precio: number;
  descripcion?: string;
  /** Muestra la etiqueta "Clásico". */
  clasico?: boolean;
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
  cantidades: Readonly<Record<string, number>>;
  nombre: string;
  modo: ModoEntrega;
  zona: number;
  direccion: string;
  referencias: string;
  /** Índice dentro de `temporada.diasEntrega`. */
  dia: number;
}
