import type { DiaEntrega, TamanoEmpaque, ZonaEnvio } from "../types";

export interface Temporada {
  anio: number;
  notaPrecios: string;
  /** Último día de diciembre para pedidos en línea y por teléfono. */
  diaLimite: number;
  /** Día de pedidos tardíos: se reciben, sujetos a disponibilidad. */
  diaTardio: number;
  anticipo: string;
  diasEntrega: readonly DiaEntrega[];
  zonas: readonly ZonaEnvio[];
}

export const temporada: Temporada = {
  anio: 2026,
  notaPrecios: "Precios de la temporada 2025 mientras salen los de 2026.",
  diaLimite: 22,
  diaTardio: 23,
  anticipo: "50%",
  diasEntrega: [
    { dia: 20 }, { dia: 21 }, { dia: 22 }, { dia: 23 },
    { dia: 24, soloTienda: true },
    { dia: 30 },
    { dia: 31, soloTienda: true },
  ],
  zonas: [
    { nombre: "Zona Sur", costo: 100 },
    { nombre: "Zona Centro", costo: 150 },
    { nombre: "Zona Norte", costo: 200 },
  ],
};

/** Pavos enteros. */
export const pavo = {
  /** Mínimo de un pavo completo. */
  kgMinimoCompleto: 5,
  /** Medio pavo pesa entre 3 y 4 kg; para el estimado se usa el punto medio. */
  kgMedio: { min: 3, max: 4, estimado: 3.5 },
} as const;

/**
 * Empaques con costo. Capacidad máxima en kg de cada tamaño
 * (chica hasta 1 kg, mediana hasta 2.5 kg, grande hasta 4 kg).
 * Si no cabe en una grande, se reparte en varias.
 */
export const empaques = {
  capacidad: { chica: 1, mediana: 2.5, grande: 4 } satisfies Record<TamanoEmpaque, number>,
  precio: {
    vacio: { chica: 25, mediana: 30, grande: 35 } satisfies Record<TamanoEmpaque, number>,
    charola: { chica: 25, mediana: 30, grande: 35 } satisfies Record<TamanoEmpaque, number>,
  },
} as const;

/** Servicio "¿Le regalaron el pavo?". */
export const maquila = {
  precioCocinarKg: 75,
  precioRellenoKg: 390,
  /** Días antes de la entrega para traer el producto a la tienda. */
  diasAnticipacion: 2,
} as const;

export const negocio = {
  /** 52 + 10 dígitos, sin espacios. */
  whatsapp: "525538776743",
  whatsappVisible: "55 3877 6743",
  telefonos: "55 5573 1277 · 55 5573 1479",
  direccion: "Clavel Norte #3, San Pedro Mártir, Tlalpan, C.P. 14650",
  /** Dirección para Google Maps y Waze. */
  direccionMapas: "Clavel Norte 3, San Pedro Mártir, Tlalpan, 14650 Ciudad de México",
  horario: "9:00 a 19:00",
} as const;

/** Documento público de Firestore con los productos agotados (lo escribe una Cloud Function). */
export const firebase = {
  proyecto: "lwk-app-a583b",
  documento: "publicWeb/disponibilidad",
} as const;
