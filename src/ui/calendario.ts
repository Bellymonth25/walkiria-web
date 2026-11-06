import type { DiaEntrega } from "../types";
import { $ } from "./dom";

const SEMANA = ["L", "M", "M", "J", "V", "S", "D"];

export interface VistaCalendario {
  anio: number;
  dias: readonly DiaEntrega[];
  diaTardio: number;
  seleccionado: number | null;
  hoy: Date;
}

/** Calendario de diciembre: solo se pueden tocar los días de entrega que no han pasado. */
export function pintarCalendario(v: VistaCalendario): void {
  const primero = new Date(v.anio, 11, 1);
  const hueco = (primero.getDay() + 6) % 7; // lunes primero
  const inicioHoy = new Date(v.hoy.getFullYear(), v.hoy.getMonth(), v.hoy.getDate());
  const celdas: string[] = SEMANA.map((d) => `<span class="cal-wd" aria-hidden="true">${d}</span>`);
  for (let i = 0; i < hueco; i++) celdas.push(`<span></span>`);
  for (let d = 1; d <= 31; d++) {
    const info = v.dias.find((x) => x.dia === d);
    const pasado = new Date(v.anio, 11, d) < inicioHoy;
    if (!info || pasado) {
      celdas.push(`<span class="cal-day off" aria-hidden="true">${d}</span>`);
      continue;
    }
    const marca = info.soloTienda ? "Tienda" : d === v.diaTardio ? "Tardío" : "";
    const clases = ["cal-day", info.soloTienda ? "tienda" : "", d === v.diaTardio ? "tardio" : "", v.seleccionado === d ? "sel" : ""].join(" ");
    const etiqueta = `${d} de diciembre${info.soloTienda ? ", solo entrega en tienda" : ""}${d === v.diaTardio ? ", pedido tardío sujeto a disponibilidad" : ""}`;
    celdas.push(
      `<button type="button" class="${clases.trim()}" data-day="${d}" aria-pressed="${v.seleccionado === d}" aria-label="${etiqueta}">${d}${marca ? `<small>${marca}</small>` : ""}</button>`,
    );
  }
  $("#calendar").innerHTML = `<div class="cal-head">Diciembre ${v.anio}</div><div class="cal-grid">${celdas.join("")}</div>
    <div class="cal-legend"><span><i class="dot tienda"></i>Solo en tienda</span><span><i class="dot tardio"></i>Sujeto a disponibilidad</span></div>`;
}
