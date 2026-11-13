import type { DiaEspecial, TamanoEmpaque, ZonaEnvio } from "../types";

export interface Corte {
  para: string;
  limite: number;
  tardio: number;
}

export interface Temporada {
  anio: number;
  notaPrecios: string;
  /**
   * Fechas límite de diciembre para pedidos en línea y por teléfono (2 días antes de la entrega).
   * El día siguiente al límite se reciben pedidos tardíos, sujetos a disponibilidad.
   */
  cortes: readonly Corte[];
  anticipo: string;
  /** Días de diciembre con regla especial (se marcan en el calendario). */
  diasEspeciales: readonly DiaEspecial[];
  /** Último día que se puede elegir en el calendario (diciembre). */
  ultimoDia: number;
  /** Días de anticipación para envío a domicilio. */
  diasAvisoDomicilio: number;
  /** Pedidos en línea/WhatsApp: días de anticipación. Para antes, por teléfono fijo o en tienda. */
  diasAnticipacionPedido: number;
  zonas: readonly ZonaEnvio[];
}

export const temporada: Temporada = {
  anio: 2026,
  notaPrecios: "Precios de la temporada 2026.",
  cortes: [
    { para: "Navidad", limite: 22, tardio: 23 },
    { para: "Año Nuevo", limite: 29, tardio: 30 },
  ],
  anticipo: "50%",
  diasEspeciales: [
    { dia: 22, tipo: "limite" },
    { dia: 23, tipo: "sujeto" },
    { dia: 24, tipo: "tienda" },
    { dia: 29, tipo: "limite" },
    { dia: 30, tipo: "sujeto" },
    { dia: 31, tipo: "tienda" },
  ],
  ultimoDia: 31,
  diasAvisoDomicilio: 3,
  diasAnticipacionPedido: 2,
  zonas: [
    { nombre: "Zona Sur", costo: 100, alcaldias: ["Tlalpan", "Coyoacán", "Xochimilco", "Magdalena Contreras"] },
    { nombre: "Zona Centro", costo: 150, alcaldias: ["Benito Juárez", "Álvaro Obregón (excepto Santa Fe)", "Iztapalapa"] },
    { nombre: "Zona Norte", costo: 200, alcaldias: ["Santa Fe", "Cuajimalpa", "Miguel Hidalgo", "Cuauhtémoc", "Azcapotzalco"] },
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
  precioCocinarKg: 170,
  precioRellenoKg: 400,
  /** Días antes de la entrega para traer el producto a la tienda. */
  diasAnticipacion: 2,
  /** Opciones de "¿qué nos trae?". "Otro" pide especificar. */
  tipos: [
    "Pavo Relleno", "Pavo Adobado", "Pavo Ahumado",
    "Lomo Horneado", "Lomo Mechado", "Lomo Adobado", "Lomo a la Ciruela",
    "Pechuga de Pavo Adobada", "Pechuga de Pavo Horneada", "Pechuga de Pavo Mechada",
    "Pierna de Pavo Adobada", "Pierna de Pavo Horneada", "Pierna de Pavo Mechada",
    "Pato", "Costillas", "Otro",
  ],
  /** El tipo que lleva relleno (se cobra aparte por kilo de relleno). */
  tipoConRelleno: "Pavo Relleno",
  /** Relleno sugerido según el peso del pavo: hasta 7 kg → 1 kg, hasta 9 kg → 1.5 kg, más → 2 kg. */
  rellenoSugerido: [
    { hastaKg: 7, kgRelleno: 1 },
    { hastaKg: 9, kgRelleno: 1.5 },
    { hastaKg: Infinity, kgRelleno: 2 },
  ],
} as const;

export const negocio = {
  /** 52 + 10 dígitos, sin espacios. */
  whatsapp: "525538776743",
  whatsappVisible: "55 3877 6743",
  telefonos: "55 5573 1277 · 55 5573 1479",
  /** Para los enlaces tel: (marcar con un toque). */
  telefonosMarcar: ["5555731277", "5555731479"],
  direccion: "Clavel Norte 3, San Pedro Mártir, Tlalpan, C.P. 14650",
  /** Dirección para Google Maps y Waze. */
  direccionMapas: "Clavel Norte 3, San Pedro Mártir, Tlalpan, 14650 Ciudad de México",
  horario: "9:00 a 18:00 hrs",
} as const;

/** Documento público de Firestore con los productos agotados (lo escribe una Cloud Function). */
export const firebase = {
  proyecto: "lwk-app-a583b",
  documento: "publicWeb/disponibilidad",
} as const;

/**
 * Calculadora "¿Cuánto pido?". Porciones por adulto y cuánto come cada grupo comparado con un adulto.
 * Para ajustar las porciones solo hay que cambiar estos números.
 */
export const calculadora = {
  porcionAdultoKg: { carne: 0.15, pasta: 0.15, ensalada: 0.15, romeritos: 0.05, bacalao: 0.05 },
  /** "Personas" incluye niños, adultos y personas mayores; los adolescentes suelen comer más. */
  factor: { personas: 1, adolescentes: 1.25 },
  /** Botones de tamaño de cena. La primera es la que se ve al abrir. */
  sugeridas: [4, 6, 10],
  /** Hasta este número de personas se recomienda pechuga en lugar de pavo entero. */
  hastaPechuga: 4,
  /** Desde este número de personas se puede repartir la carne en varias (mitad y mitad). */
  desdeVariasCarnes: 6,
  maxCarnes: 3,
  /** Un Strudel de Manzana grande alcanza para 10 personas. */
  personasPorStrudel: 10,
} as const;
