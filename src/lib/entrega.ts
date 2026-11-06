import type { TipoDia } from "../types";
import type { Temporada } from "../data/temporada";
import { deIso, inicioDelDia, sumarDias } from "./fechas";

/** Regla especial de una fecha (solo aplica en diciembre de la temporada). */
export function tipoDeFecha(iso: string, t: Temporada): TipoDia | undefined {
  const d = deIso(iso);
  if (d.getFullYear() !== t.anio || d.getMonth() !== 11) return undefined;
  return t.diasEspeciales.find((x) => x.dia === d.getDate())?.tipo;
}

export type MotivoSinDomicilio = "tienda" | "aviso";

/**
 * Si esa fecha no admite envío a domicilio, regresa el motivo:
 * "tienda" (24 y 31 de diciembre) o "aviso" (faltan menos de N días).
 */
export function sinDomicilio(iso: string, hoy: Date, t: Temporada): MotivoSinDomicilio | null {
  if (tipoDeFecha(iso, t) === "tienda") return "tienda";
  if (deIso(iso) < sumarDias(inicioDelDia(hoy), t.diasAvisoDomicilio)) return "aviso";
  return null;
}

/**
 * Fechas que se pueden elegir en la página: desde dentro de N días (anticipación de pedidos
 * en línea) hasta el último día de diciembre. Para antes, se pide por teléfono fijo o en tienda.
 */
export function fechaElegible(iso: string, hoy: Date, t: Temporada): boolean {
  const d = deIso(iso);
  return d >= sumarDias(inicioDelDia(hoy), t.diasAnticipacionPedido) && d <= new Date(t.anio, 11, t.ultimoDia);
}
