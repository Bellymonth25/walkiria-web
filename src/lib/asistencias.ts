/**
 * Asistencias y pagos de empleados (página `asistencias.html`). Lógica pura, sin Firebase.
 *
 * Firestore:
 * - `empleados/{id}`          { nombre, pagoDia, frecuencia: "DIA" | "SEMANA", activo, qr }
 * - `asistencias/{AAAA-MM-DD}` { marcas: { [empleadoId]: { estado: "VINO" | "FALTO", pago } } }
 *     `pago` es lo que ganaba ese día al marcarlo: si luego le cambian el sueldo, los días ya
 *     marcados no cambian.
 * - `pagosEmpleados/{empleadoId}_{periodo}` { empleadoId, periodo, fecha, monto, dias, en, por }
 *     `periodo` es "AAAA-MM-DD" (pago diario) o "S" + el día de pago de esa semana (pago semanal).
 *     El id fijo evita pagar dos veces lo mismo aunque dos personas toquen "Pagado" a la vez.
 * - `asistenciasConfig/general` { diaPago } (0 = domingo … 6 = sábado; sábado si no hay nada).
 *
 * No se guardan horas de entrada ni de salida: solo si vino o no.
 */
import { aIso, deIso, sumarDias } from "./fechas";

export type Frecuencia = "DIA" | "SEMANA";
export type Estado = "VINO" | "FALTO";

export interface Empleado {
  id: string;
  nombre: string;
  /** Lo que gana por día trabajado. */
  pagoDia: number;
  frecuencia: Frecuencia;
  /** Los que ya no trabajan se desactivan, no se borran (se conserva lo que se les pagó). */
  activo: boolean;
  /** Código del gafete QR (ver `textoQr`). Vacío si aún no se imprime. */
  qr: string;
}

export interface Marca {
  estado: Estado;
  /** Sueldo del día al marcarlo (0 si faltó). */
  pago: number;
}

/** fecha → empleadoId → marca */
export type Asistencias = ReadonlyMap<string, Readonly<Record<string, Marca>>>;

export interface Pago {
  empleadoId: string;
  periodo: string;
  monto: number;
}

export interface Pendiente {
  empleado: Empleado;
  periodo: string;
  /** Día de pago: la fecha del día (diario) o el día de pago de la semana. */
  fecha: string;
  /** Primer día que cubre (igual a `fecha` en el pago diario). */
  desde: string;
  dias: number;
  /** Lo que se debe en total por ese periodo. */
  total: number;
  /** Lo que ya se pagó de ese periodo (si se marcaron días después de pagar). */
  yaPagado: number;
  /** total - yaPagado: lo que hay que dar. */
  monto: number;
}

export const DIA_PAGO_DEFAULT = 6; // sábado
/** Hasta cuántos días atrás se buscan pagos olvidados. */
export const DIAS_ATRAS = 35;

export const DIAS_SEMANA = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"] as const;

const num = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) ? v : Number(v) || 0);

export function leerEmpleado(id: string, d: Record<string, unknown>): Empleado {
  return {
    id,
    nombre: typeof d.nombre === "string" ? d.nombre.trim() : "",
    pagoDia: Math.max(0, num(d.pagoDia)),
    frecuencia: d.frecuencia === "SEMANA" ? "SEMANA" : "DIA",
    activo: d.activo !== false,
    qr: typeof d.qr === "string" ? d.qr : "",
  };
}

export function leerMarcas(d: Record<string, unknown> | undefined): Record<string, Marca> {
  const out: Record<string, Marca> = {};
  const marcas = d?.marcas;
  if (!marcas || typeof marcas !== "object") return out;
  for (const [id, v] of Object.entries(marcas as Record<string, unknown>)) {
    if (!v || typeof v !== "object") continue;
    const m = v as Record<string, unknown>;
    if (m.estado !== "VINO" && m.estado !== "FALTO") continue;
    out[id] = { estado: m.estado, pago: m.estado === "VINO" ? Math.max(0, num(m.pago)) : 0 };
  }
  return out;
}

export function leerDiaPago(v: unknown): number {
  const n = typeof v === "number" ? v : NaN;
  return Number.isInteger(n) && n >= 0 && n <= 6 ? n : DIA_PAGO_DEFAULT;
}

/** Nombre, sueldo y frecuencia válidos. null si todo bien. */
export function validarEmpleado(e: Pick<Empleado, "nombre" | "pagoDia">, otros: readonly Empleado[], id?: string): string | null {
  const nombre = e.nombre.trim();
  if (!nombre) return "Escribe el nombre.";
  if (!(e.pagoDia > 0)) return "Escribe cuánto se le paga por día.";
  const igual = otros.find((o) => o.id !== id && o.activo && o.nombre.trim().toLowerCase() === nombre.toLowerCase());
  if (igual) return `Ya hay un empleado activo llamado "${igual.nombre}".`;
  return null;
}

/** Activos primero y por nombre. */
export function ordenar(lista: readonly Empleado[]): Empleado[] {
  return [...lista].sort((a, b) => Number(b.activo) - Number(a.activo) || a.nombre.localeCompare(b.nombre, "es"));
}

/** Día de pago de la semana a la que pertenece `fecha` (el mismo día o el siguiente `diaPago`). */
export function corteDeSemana(fecha: string, diaPago: number): string {
  const d = deIso(fecha);
  return aIso(sumarDias(d, (diaPago - d.getDay() + 7) % 7));
}

/** Los 7 días que cubre el pago semanal que se hace en `corte`. */
export function diasDeSemana(corte: string): string[] {
  const c = deIso(corte);
  return Array.from({ length: 7 }, (_, i) => aIso(sumarDias(c, i - 6)));
}

export const periodoSemana = (corte: string): string => `S${corte}`;
export const idPago = (empleadoId: string, periodo: string): string => `${empleadoId}_${periodo}`;

export interface ResumenDia {
  vinieron: number;
  faltaron: number;
  sinMarcar: number;
}

export function resumenDia(empleados: readonly Empleado[], marcas: Readonly<Record<string, Marca>>): ResumenDia {
  const r: ResumenDia = { vinieron: 0, faltaron: 0, sinMarcar: 0 };
  for (const e of empleados) {
    const m = marcas[e.id];
    if (!m) r.sinMarcar++;
    else if (m.estado === "VINO") r.vinieron++;
    else r.faltaron++;
  }
  return r;
}

/**
 * Lo que hay que pagar hasta `hoy`, de los últimos `DIAS_ATRAS` días:
 * - Pago diario: cada día que vino y no se le ha pagado.
 * - Pago semanal: cada semana ya cerrada (su día de pago es hoy o ya pasó) con días trabajados.
 * Si se marcaron días después de pagar, sale solo la diferencia.
 * Incluye a los desactivados: si se fueron debiéndoles, todavía hay que pagarles.
 */
export function pendientes(
  empleados: readonly Empleado[],
  asistencias: Asistencias,
  pagos: readonly Pago[],
  hoy: string,
  diaPago: number,
): Pendiente[] {
  const pagado = new Map<string, number>();
  for (const p of pagos) pagado.set(idPago(p.empleadoId, p.periodo), (pagado.get(idPago(p.empleadoId, p.periodo)) ?? 0) + p.monto);
  const desde = aIso(sumarDias(deIso(hoy), -DIAS_ATRAS));
  const fechas = [...asistencias.keys()].filter((f) => f >= desde && f <= hoy).sort();
  const out: Pendiente[] = [];

  for (const e of empleados) {
    if (e.frecuencia === "DIA") {
      for (const f of fechas) {
        const m = asistencias.get(f)?.[e.id];
        if (m?.estado !== "VINO") continue;
        const ya = pagado.get(idPago(e.id, f)) ?? 0;
        if (m.pago - ya > 0.005) out.push({ empleado: e, periodo: f, fecha: f, desde: f, dias: 1, total: m.pago, yaPagado: ya, monto: m.pago - ya });
      }
    } else {
      const semanas = new Map<string, { dias: number; total: number }>();
      for (const f of fechas) {
        const m = asistencias.get(f)?.[e.id];
        if (m?.estado !== "VINO") continue;
        const corte = corteDeSemana(f, diaPago);
        if (corte > hoy) continue; // semana en curso: todavía no toca
        const s = semanas.get(corte) ?? { dias: 0, total: 0 };
        s.dias++;
        s.total += m.pago;
        semanas.set(corte, s);
      }
      for (const [corte, s] of semanas) {
        const periodo = periodoSemana(corte);
        const ya = pagado.get(idPago(e.id, periodo)) ?? 0;
        if (s.total - ya > 0.005) {
          out.push({ empleado: e, periodo, fecha: corte, desde: diasDeSemana(corte)[0]!, dias: s.dias, total: s.total, yaPagado: ya, monto: s.total - ya });
        }
      }
    }
  }
  // Lo más viejo primero (lo que se olvidó pagar), luego por nombre.
  return out.sort((a, b) => a.fecha.localeCompare(b.fecha) || a.empleado.nombre.localeCompare(b.empleado.nombre, "es"));
}

export interface Acumulado {
  empleado: Empleado;
  dias: number;
  monto: number;
}

/** Semana en curso de los de pago semanal (para "El sábado se paga…"). Vacío si hoy es día de pago. */
export function semanaEnCurso(empleados: readonly Empleado[], asistencias: Asistencias, hoy: string, diaPago: number): { corte: string; lista: Acumulado[] } {
  const corte = corteDeSemana(hoy, diaPago);
  if (corte === hoy) return { corte, lista: [] };
  const dias = diasDeSemana(corte).filter((f) => f <= hoy);
  const lista = empleados
    .filter((e) => e.activo && e.frecuencia === "SEMANA")
    .map((e) => {
      let n = 0;
      let monto = 0;
      for (const f of dias) {
        const m = asistencias.get(f)?.[e.id];
        if (m?.estado === "VINO") {
          n++;
          monto += m.pago;
        }
      }
      return { empleado: e, dias: n, monto };
    })
    .filter((a) => a.dias > 0);
  return { corte, lista };
}

/** "Hoy", "Ayer" o "Sáb 21 nov". */
export function etiquetaFecha(fecha: string, hoy: string): string {
  if (fecha === hoy) return "Hoy";
  if (fecha === aIso(sumarDias(deIso(hoy), -1))) return "Ayer";
  const d = deIso(fecha);
  const dia = DIAS_SEMANA[d.getDay()]!.slice(0, 3);
  const mes = new Intl.DateTimeFormat("es-MX", { month: "short" }).format(d).replace(".", "");
  return `${dia.charAt(0).toUpperCase()}${dia.slice(1)} ${d.getDate()} ${mes}`;
}

/** Qué cubre un pendiente: "Hoy" / "Semana dom 16 – sáb 22 nov · 5 días". */
export function textoPeriodo(p: Pendiente, hoy: string): string {
  if (p.empleado.frecuencia === "DIA") return etiquetaFecha(p.fecha, hoy);
  const dias = `${p.dias} ${p.dias === 1 ? "día" : "días"}`;
  const fin = etiquetaFecha(p.fecha, "");
  const ini = etiquetaFecha(p.desde, "");
  const mismoMes = p.desde.slice(0, 7) === p.fecha.slice(0, 7);
  return `Semana ${mismoMes ? ini.slice(0, ini.lastIndexOf(" ")) : ini} – ${fin} · ${dias}`;
}

// ---------- Gafetes QR ----------
// El gafete lleva "WLK-EMP:" + un código al azar guardado en `empleados/{id}.qr`. No lleva el nombre
// ni el id: si se pierde, "Cambiar código" deja inservible el anterior.

const PREFIJO_QR = "WLK-EMP:";
const LETRAS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // sin 0/O ni 1/I

export function nuevoCodigo(azar: (n: number) => Uint8Array = (n) => crypto.getRandomValues(new Uint8Array(n))): string {
  return Array.from(azar(10), (b) => LETRAS[b % LETRAS.length]).join("");
}

export const textoQr = (codigo: string): string => PREFIJO_QR + codigo;

/** El código de un gafete leído por la cámara, o null si no es un gafete de La Walkiria. */
export function leerQr(texto: string): string | null {
  const t = texto.trim();
  if (!t.startsWith(PREFIJO_QR)) return null;
  const c = t.slice(PREFIJO_QR.length);
  return /^[A-Z0-9]{6,32}$/.test(c) ? c : null;
}

export type ResultadoChecador =
  | { tipo: "registrado"; empleado: Empleado }
  | { tipo: "yaEstaba"; empleado: Empleado }
  | { tipo: "inactivo"; empleado: Empleado }
  | { tipo: "desconocido" };

/** Qué hacer al escanear un gafete (sin escribir nada: eso lo hace la página). */
export function alEscanear(codigo: string, empleados: readonly Empleado[], marcasHoy: Readonly<Record<string, Marca>>): ResultadoChecador {
  const e = codigo ? empleados.find((x) => x.qr === codigo) : undefined;
  if (!e) return { tipo: "desconocido" };
  if (!e.activo) return { tipo: "inactivo", empleado: e };
  return marcasHoy[e.id]?.estado === "VINO" ? { tipo: "yaEstaba", empleado: e } : { tipo: "registrado", empleado: e };
}
