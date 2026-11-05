import type { DiaEntrega, ZonaEnvio } from "../types";

export interface Temporada {
  anio: number;
  notaPrecios: string;
  /** Último día de diciembre para pedidos en línea y por teléfono. */
  diaLimite: number;
  /** Día de pedidos tardíos: se reciben, sujetos a disponibilidad. */
  diaTardio: number;
  anticipo: string;
  diasEntrega: readonly DiaEntrega[];
  /** Índice de `diasEntrega` que aparece seleccionado al entrar. */
  diaPorDefecto: number;
  zonas: readonly ZonaEnvio[];
}

/** Datos de la temporada y del negocio. Lo que cambia cada año está aquí. */
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
  diaPorDefecto: 3,
  zonas: [
    { nombre: "Zona Sur", costo: 100 },
    { nombre: "Zona Centro", costo: 150 },
    { nombre: "Zona Norte", costo: 200 },
  ],
};

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
