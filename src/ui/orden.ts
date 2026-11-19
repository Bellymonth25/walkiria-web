import type { Pedido, Producto } from "../types";
import type { Temporada } from "../data/temporada";
import { dinero, escapar } from "../lib/formato";
import {
  costoEnvio, empaquesDe, enlaceWhatsApp, llevaEmpaque, type Renglon, envioPorConfirmar, faltantes, mensaje, nombreLinea, renglones, textoCantidad,
  resumenEmpaques, textoEmpaques, textoFaltantes, total, zonaDe,
} from "../lib/pedido";
import { nombreFecha } from "../lib/fechas";
import { tipoDeFecha } from "../lib/entrega";
import { $ } from "./dom";
import { textoDesglose } from "../lib/combo";

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
  $("#hintEdit").hidden = n === 0;
  // Mientras el cliente escribe una cantidad aquí, no se repinta la lista (perdería el cursor):
  // solo cambian precio y empaques de cada renglón.
  const foco = document.activeElement as HTMLElement | null;
  const escribiendo = !!foco?.dataset.lnqty && $("#lines").contains(foco) && filas.some((r) => r.id === foco.dataset.lnqty);
  if (escribiendo) {
    for (const r of filas) {
      const precio = document.querySelector(`[data-lnprecio="${r.id}"]`);
      const extra = document.querySelector(`[data-lnextra="${r.id}"]`);
      if (precio) precio.textContent = dinero(r.importe);
      if (extra) extra.textContent = textoExtra(r);
      const campo = document.querySelector<HTMLInputElement>(`[data-lnqty="${r.id}"]`);
      if (campo && campo !== foco) campo.value = String(r.linea.cantidad);
    }
  } else $("#lines").innerHTML =
    filas.map(lineaPedido).join("") +
    (envio
      ? `<li><span>Envío ${escapar(zonaDe(pedido.alcaldia, ctx.temporada.zonas)!.nombre)} <span class="q">· ${escapar(pedido.alcaldia)}</span></span><span class="num">${dinero(envio)}</span></li>`
      : envioPorConfirmar(pedido)
        ? `<li><span>Envío <span class="q">· otra zona</span></span><span class="num">Por confirmar</span></li>`
        : "");
  // Con charolas o bolsas al vacío, junto al total se desglosa cuánto es de productos y cuánto de empaques.
  const { productos: sub, empaques: emp } = resumenEmpaques(pedido, ctx.catalogo);
  const desglose = $("#desglose");
  desglose.hidden = emp.length === 0;
  desglose.innerHTML = emp.length
    ? `<li><span>Productos</span><span class="num">${dinero(sub)}</span></li>` +
      emp
        .map(
          (e) =>
            `<li><span>${escapar(e.nombre)} <span class="q">· ${e.piezas}</span><small>${escapar(e.tamanos)}</small></span><span class="num">${dinero(e.importe)}</span></li>`,
        )
        .join("")
    : "";
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

const BASURA = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>`;

/**
 * Un renglón de "Tu pedido" que se edita ahí mismo: − cantidad + y quitar, sin bajar a la lista
 * (como el carrito de las tiendas en línea). Lo que no es cantidad (tamaño del pavo, presentación,
 * maquila) se cambia en el producto: el nombre lleva ahí.
 */
function textoExtra(r: Renglon): string {
  const { producto: p, linea: l } = r;
  const extra: string[] = [];
  if (p.combo) extra.push(textoDesglose(l.cantidad));
  if (llevaEmpaque(p)) extra.push(textoEmpaques(l.presentacion, empaquesDe(p, l)));
  return extra.join(" · ");
}

/** Lo que va junto al número que escribe el cliente: "kg", "pzas", "personas". */
function unidadCampo(p: Renglon["producto"], cantidad: number): [string, string] {
  if (p.combo) return ["para", "personas"];
  if (p.pieza) return ["", cantidad === 1 ? p.pieza.nombre : p.pieza.plural];
  return ["", p.unidad === "pza" ? (cantidad === 1 ? "pza" : "pzas") : "kg"];
}

function lineaPedido(r: Renglon): string {
  const { producto: p, linea: l, id } = r;
  const nombre = escapar(nombreLinea(p, l));
  const extra = textoExtra(r);
  // Pavo entero y maquila no llevan − y +: cada pavo es su línea y la maquila pide datos.
  const conPasos = !p.pavoEntero && !p.maquila;
  const cantidad = escapar(textoCantidad(p, l));
  const control = conPasos
    ? `<div class="ln-qty" role="group" aria-label="Cantidad de ${nombre}">
        <button type="button" data-dec="${id}" aria-label="Menos ${nombre}">−</button>
        <label class="ln-campo">${unidadCampo(p, l.cantidad)[0] ? `<span>${unidadCampo(p, l.cantidad)[0]}</span>` : ""}<input class="num" type="text" inputmode="${p.unidad === "kg" && !p.pieza ? "decimal" : "numeric"}" enterkeyhint="done" autocomplete="off" value="${l.cantidad}" data-lnqty="${id}" aria-label="Cantidad de ${nombre}"><span>${unidadCampo(p, l.cantidad)[1]}</span></label>
        <button type="button" data-inc="${id}" aria-label="Más ${nombre}">+</button>
      </div>`
    : `<span class="ln-fija">${cantidad}</span>`;
  return `<li class="ln">
    <div class="ln-top"><button type="button" class="ln-nombre" data-ir="${p.id}" title="Ver y cambiar en la lista">${nombre}</button><span class="num ln-precio" data-lnprecio="${id}">${dinero(r.importe)}</span></div>
    ${extra ? `<small data-lnextra="${id}">${escapar(extra)}</small>` : ""}
    <div class="ln-ctl">${control}
      ${conPasos ? "" : `<button type="button" class="ln-editar" data-ir="${p.id}">Editar</button>`}
      <button type="button" class="ln-quitar" data-del="${id}" aria-label="Quitar ${nombre}">${BASURA}<span>Quitar</span></button></div>
  </li>`;
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
