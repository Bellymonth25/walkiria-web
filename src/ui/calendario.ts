import type { Temporada } from "../data/temporada";
import { aIso, inicioDelDia, tituloMes } from "../lib/fechas";
import { fechaElegible, tipoDeFecha } from "../lib/entrega";
import { $ } from "./dom";

const SEMANA = ["L", "M", "M", "J", "V", "S", "D"];
const ETIQUETA = { limite: "Límite", sujeto: "Sujeto", tienda: "Tienda" } as const;

export interface VistaCalendario {
  temporada: Temporada;
  /** Mes que se está viendo. */
  anio: number;
  mes: number;
  seleccionado: string | null;
  hoy: Date;
}

/** Primer y último mes que se pueden ver: el mes de hoy y diciembre de la temporada. */
export function rangoMeses(t: Temporada, hoy: Date): { desde: [number, number]; hasta: [number, number] } {
  return { desde: [hoy.getFullYear(), hoy.getMonth()], hasta: [t.anio, 11] };
}

const indice = (a: number, m: number) => a * 12 + m;

export function pintarCalendario(v: VistaCalendario): void {
  const { desde, hasta } = rangoMeses(v.temporada, v.hoy);
  const actual = indice(v.anio, v.mes);
  const puedeAtras = actual > indice(...desde);
  const puedeAdelante = actual < indice(...hasta);
  const hoyIso = aIso(inicioDelDia(v.hoy));

  const primero = new Date(v.anio, v.mes, 1);
  const hueco = (primero.getDay() + 6) % 7; // lunes primero
  const diasMes = new Date(v.anio, v.mes + 1, 0).getDate();
  const celdas: string[] = SEMANA.map((d) => `<span class="cal-wd" aria-hidden="true">${d}</span>`);
  for (let i = 0; i < hueco; i++) celdas.push(`<span></span>`);

  for (let d = 1; d <= diasMes; d++) {
    const iso = aIso(new Date(v.anio, v.mes, d));
    const esHoy = iso === hoyIso;
    if (!fechaElegible(iso, v.hoy, v.temporada)) {
      celdas.push(`<span class="cal-day off${esHoy ? " hoy" : ""}" aria-hidden="true">${d}${esHoy ? "<small>Hoy</small>" : ""}</span>`);
      continue;
    }
    const tipo = tipoDeFecha(iso, v.temporada);
    const marca = tipo ? ETIQUETA[tipo] : esHoy ? "Hoy" : "";
    const sel = v.seleccionado === iso;
    const clases = ["cal-day", tipo ?? "", esHoy ? "hoy" : "", sel ? "sel" : ""].filter(Boolean).join(" ");
    const extra = tipo === "tienda" ? ", sólo entrega en tienda" : tipo === "sujeto" ? ", sujeto a disponibilidad" : esHoy ? ", hoy" : "";
    celdas.push(
      `<button type="button" class="${clases}" data-fecha="${iso}" aria-pressed="${sel}" aria-label="${d}${extra}">${d}${marca ? `<small>${marca}</small>` : ""}</button>`,
    );
  }

  $("#calendar").innerHTML = `<div class="cal-head">
      <button type="button" class="cal-nav" data-mes="-1" aria-label="Mes anterior"${puedeAtras ? "" : " disabled"}>‹</button>
      <span>${tituloMes(v.anio, v.mes)}</span>
      <button type="button" class="cal-nav" data-mes="1" aria-label="Mes siguiente"${puedeAdelante ? "" : " disabled"}>›</button>
    </div>
    <div class="cal-grid">${celdas.join("")}</div>
    <div class="cal-legend"><span><i class="dot hoy"></i>Hoy</span><span><i class="dot limite"></i>Último día para pedir</span><span><i class="dot tienda"></i>Sólo en tienda</span><span><i class="dot sujeto"></i>Sujeto a disponibilidad</span></div>`;
}
