import type { Pedido, Producto } from "../types";
import type { Temporada } from "../data/temporada";
import { dinero, escapar } from "../lib/formato";
import {
  costoEnvio, empaquesDe, enlaceWhatsApp, envioPorConfirmar, faltantes, mensaje, nombreLinea, presentaciones, renglones, textoCantidad,
  textoEmpaques, textoFaltantes, total, zonaDe,
} from "../lib/pedido";
import { nombreFecha } from "../lib/fechas";
import { tipoDeFecha } from "../lib/entrega";
import { $ } from "./dom";

export interface ContextoOrden {
  catalogo: readonly Producto[];
  temporada: Temporada;
  whatsapp: string;
  tardio: boolean;
}

export function textoPedido(pedido: Pedido, ctx: ContextoOrden): string {
  return mensaje(pedido, {
    catalogo: ctx.catalogo,
    zonas: ctx.temporada.zonas,
    nombreDia: pedido.fecha === null ? "" : nombreFecha(pedido.fecha),
    diaSujeto: pedido.fecha !== null && tipoDeFecha(pedido.fecha, ctx.temporada) === "sujeto",
    tardio: ctx.tardio,
  });
}

export function pintarOrden(pedido: Pedido, ctx: ContextoOrden): void {
  const filas = renglones(pedido, ctx.catalogo);
  const envio = costoEnvio(pedido, ctx.temporada.zonas);
  const t = total(pedido, ctx.catalogo, ctx.temporada.zonas);
  const n = filas.length;

  $("#order").dataset.empty = String(n === 0 && window.innerWidth <= 980);
  $("#hint").hidden = n > 0;
  $("#lines").innerHTML =
    filas
      .map((r) => {
        const pres = presentaciones(r.producto).length
          ? `<small>${escapar(textoEmpaques(r.linea.presentacion, empaquesDe(r.producto, r.linea)))}</small>`
          : "";
        return `<li><span>${escapar(nombreLinea(r.producto, r.linea))} <span class="q">· ${escapar(textoCantidad(r.producto, r.linea))}</span>${pres}</span><span class="num">${dinero(r.importe)}</span></li>`;
      })
      .join("") +
    (envio
      ? `<li><span>Envío ${escapar(zonaDe(pedido.alcaldia, ctx.temporada.zonas)!.nombre)} <span class="q">· ${escapar(pedido.alcaldia)}</span></span><span class="num">${dinero(envio)}</span></li>`
      : envioPorConfirmar(pedido)
        ? `<li><span>Envío <span class="q">· otra zona</span></span><span class="num">Por confirmar</span></li>`
        : "");
  $("#total").textContent = dinero(t);
  $("#barTotal").textContent = dinero(t);
  $("#barCount").textContent = n ? `${n} ${n === 1 ? "producto" : "productos"}` : "Tu pedido";

  const falta = faltantes(pedido, ctx.catalogo);
  const listo = falta.length === 0;
  const enviar = $<HTMLAnchorElement>("#send");
  enviar.href = listo ? enlaceWhatsApp(ctx.whatsapp, textoPedido(pedido, ctx)) : "#";
  enviar.setAttribute("aria-disabled", String(!listo));
  const msg = $("#missing");
  msg.hidden = listo;
  msg.textContent = textoFaltantes(falta);

  const domicilio = pedido.modo === "domicilio";
  document.querySelectorAll<HTMLButtonElement>("#mode button").forEach((b) =>
    b.setAttribute("aria-pressed", String(b.dataset.mode === pedido.modo)),
  );
  $("#zoneField").hidden = !domicilio;
  pintarZona(pedido, ctx);
  $("#domNote").hidden = !domicilio;
  $("#addrField").hidden = !domicilio;
}

/** Debajo de la alcaldía: la zona y el precio, o cómo preguntar si está fuera de zona. */
function pintarZona(pedido: Pedido, ctx: ContextoOrden): void {
  const info = $("#zoneInfo");
  const zona = zonaDe(pedido.alcaldia, ctx.temporada.zonas);
  info.dataset.tipo = zona ? "zona" : pedido.alcaldia ? "otra" : "";
  info.innerHTML = zona
    ? `<b>${escapar(zona.nombre)}</b> · envío <b class="num">${dinero(zona.costo)}</b>`
    : pedido.alcaldia
      ? `¿Otra zona? Pregúntanos por WhatsApp: al mandar tu pedido te confirmamos si llegamos y el costo del envío.`
      : "";
  info.hidden = !info.innerHTML;
}
