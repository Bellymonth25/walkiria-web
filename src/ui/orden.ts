import type { Pedido, Producto } from "../types";
import type { Temporada } from "../data/temporada";
import { cantidad, dinero, escapar } from "../lib/formato";
import { costoEnvio, enlaceWhatsApp, faltantes, mensaje, renglones, textoFaltantes, total } from "../lib/pedido";
import { nombreDia } from "../lib/fechas";
import { $ } from "./dom";

export interface ContextoOrden {
  catalogo: readonly Producto[];
  temporada: Temporada;
  whatsapp: string;
  tardio: boolean;
}

export function textoPedido(pedido: Pedido, ctx: ContextoOrden): string {
  const d = ctx.temporada.diasEntrega[pedido.dia];
  return mensaje(pedido, {
    catalogo: ctx.catalogo,
    zonas: ctx.temporada.zonas,
    nombreDia: d ? nombreDia(ctx.temporada.anio, d.dia) : "",
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
      .map(
        (r) =>
          `<li><span><span class="q num">${cantidad(r.cantidad, r.producto.unidad)}</span>${escapar(r.producto.nombre)}</span><span class="num">${dinero(r.importe)}</span></li>`,
      )
      .join("") +
    (envio ? `<li><span>Envío ${escapar(ctx.temporada.zonas[pedido.zona]!.nombre)}</span><span class="num">${dinero(envio)}</span></li>` : "");
  $("#total").textContent = dinero(t);
  $("#barTotal").textContent = dinero(t);
  $("#barCount").textContent = n ? `${n} ${n === 1 ? "producto" : "productos"}` : "Tu pedido";

  const falta = faltantes(pedido, ctx.catalogo);
  const listo = falta.length === 0;
  const enviar = $<HTMLAnchorElement>("#send");
  enviar.href = listo ? enlaceWhatsApp(ctx.whatsapp, textoPedido(pedido, ctx)) : "#";
  enviar.setAttribute("aria-disabled", String(!listo));
  enviar.style.opacity = listo ? "1" : ".5";
  const msg = $("#missing");
  msg.hidden = listo;
  msg.textContent = textoFaltantes(falta);

  const domicilio = pedido.modo === "domicilio";
  document.querySelectorAll<HTMLButtonElement>("#mode button").forEach((b) =>
    b.setAttribute("aria-pressed", String(b.dataset.mode === pedido.modo)),
  );
  $("#zoneField").hidden = !domicilio;
  $("#addrField").hidden = !domicilio;
}
