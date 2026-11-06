import type { Categoria, CategoriaId, Linea, Producto } from "../types";
import { dinero, escapar, kilos, normalizar } from "../lib/formato";
import { empaquesDe, importeLinea, nombrePresentacion, presentaciones, textoEmpaques } from "../lib/pedido";
import { pavo } from "../data/temporada";
import { $ } from "./dom";

export type Filtro = CategoriaId | "todo";

export interface VistaMenu {
  categorias: readonly Categoria[];
  catalogo: readonly Producto[];
  filtro: Filtro;
  busqueda: string;
  lineas: Readonly<Record<string, Linea>>;
  agotados: (p: Producto) => boolean;
}

export function pintarChips(v: VistaMenu): void {
  const cuenta = (id: Filtro) => (id === "todo" ? v.catalogo.length : v.catalogo.filter((p) => p.categoria === id).length);
  $("#chips").innerHTML = [{ id: "todo" as Filtro, nombre: "Todo" }, ...v.categorias]
    .map(
      (c) =>
        `<button class="chip" type="button" data-cat="${c.id}" aria-pressed="${v.filtro === c.id}">${escapar(c.nombre)}<span class="c">${cuenta(c.id)}</span></button>`,
    )
    .join("");
}

/** Texto bajo la cantidad: empaques y subtotal. Se actualiza mientras el cliente escribe. */
export function textoDetalle(p: Producto, l: Linea): string {
  const partes: string[] = [];
  if (presentaciones(p).length) partes.push(textoEmpaques(l.presentacion, empaquesDe(p, l)));
  partes.push(`Subtotal ${dinero(importeLinea(p, l))}`);
  return partes.join(" · ");
}

function seg(nombre: string, id: string, opciones: [string, string][], actual: string): string {
  return `<div class="seg seg-${opciones.length}" role="group" aria-label="${nombre}">${opciones
    .map(([valor, texto]) => `<button type="button" data-${nombre}="${id}:${valor}" aria-pressed="${actual === valor}">${texto}</button>`)
    .join("")}</div>`;
}

function detalle(p: Producto, l: Linea): string {
  const n = escapar(p.nombre);
  const unidad = p.pavoEntero ? (l.cantidad === 1 ? "pavo" : "pavos") : p.unidad === "pza" ? "pzas" : "kg";
  const paso = p.unidad === "kg" && !p.pavoEntero ? "0.25" : "1";
  const modo = p.unidad === "kg" && !p.pavoEntero ? "decimal" : "numeric";
  const partes: string[] = [];

  if (p.pavoEntero) {
    partes.push(`<div class="dfield"><span class="dlabel">Tamaño</span>${seg("size", p.id, [
      ["completo", `Completo <small>desde ${pavo.kgMinimoCompleto} kg</small>`],
      ["medio", `Medio pavo <small>${pavo.kgMedio.min} a ${pavo.kgMedio.max} kg</small>`],
    ], l.tamano)}</div>`);
  }

  partes.push(`<div class="dfield"><label class="dlabel" for="qty-${p.id}">Cantidad</label>
    <div class="qty">
      <button type="button" data-dec="${p.id}" aria-label="Quitar ${n}">−</button>
      <input id="qty-${p.id}" class="num" type="number" inputmode="${modo}" min="${paso}" step="${paso}" value="${l.cantidad}" data-qty="${p.id}" aria-label="Cantidad de ${n}">
      <button type="button" data-inc="${p.id}" aria-label="Agregar más ${n}">+</button>
      <span class="unit">${unidad}</span>
    </div></div>`);

  if (p.pavoEntero && l.tamano === "completo") {
    partes.push(`<div class="dfield"><label class="dlabel" for="kgp-${p.id}">Kilos aprox. por pavo</label>
      <div class="qty"><input id="kgp-${p.id}" class="num" type="number" inputmode="decimal" min="${pavo.kgMinimoCompleto}" step="0.5" value="${l.kgPorPavo}" data-kgpavo="${p.id}"><span class="unit">kg (mín. ${kilos(pavo.kgMinimoCompleto)})</span></div></div>`);
  }

  const pres = presentaciones(p);
  if (pres.length) {
    partes.push(`<div class="dfield"><span class="dlabel">Presentación</span>${seg(
      "pres",
      p.id,
      pres.map((x) => [x, x === "acrilico" || x === "bolsa" ? `${nombrePresentacion[x]} <small>sin costo</small>` : nombrePresentacion[x]]),
      l.presentacion,
    )}</div>`);
  }

  return `<div class="detail">${partes.join("")}
    <div class="dfoot"><span class="dinfo" data-info="${p.id}">${escapar(textoDetalle(p, l))}</span>
    <button type="button" class="del" data-del="${p.id}">Quitar</button></div></div>`;
}

export function renglon(p: Producto, l: Linea | undefined, agotado: boolean): string {
  const n = escapar(p.nombre);
  const accion = agotado
    ? `<span class="soldout">Agotado</span>`
    : l
      ? `<span class="inorder">En tu pedido</span>`
      : `<button type="button" class="add" data-add="${p.id}">Agregar</button>`;
  return `<li class="row${l ? " in" : ""}${agotado ? " agotado" : ""}" data-row="${p.id}">
    <div class="name">${n}${p.clasico ? '<span class="tag">Clásico</span>' : ""}${p.descripcion ? `<span class="meta">${escapar(p.descripcion)}</span>` : ""}</div>
    <div class="price num"><b>${dinero(p.precio)}</b><span>/${p.unidad}</span></div>
    <div class="action">${accion}</div>
    ${l && !agotado ? detalle(p, l) : ""}</li>`;
}

export function pintarRenglon(v: VistaMenu, id: string): void {
  const p = v.catalogo.find((x) => x.id === id);
  const el = document.querySelector(`[data-row="${id}"]`);
  if (p && el) el.outerHTML = renglon(p, v.lineas[id], v.agotados(p));
}

export function pintarMenu(v: VistaMenu): void {
  const q = normalizar(v.busqueda.trim());
  const visibles = v.catalogo.filter(
    (p) => (v.filtro === "todo" || p.categoria === v.filtro) && (!q || normalizar(p.nombre).includes(q)),
  );
  const menu = $("#menu");
  if (!visibles.length) {
    menu.innerHTML = `<div class="empty">No encontramos "${escapar(v.busqueda)}". Prueba con otra palabra o pregúntanos por WhatsApp.</div>`;
    return;
  }
  menu.innerHTML = v.categorias
    .map((c) => {
      const items = visibles.filter((p) => p.categoria === c.id);
      if (!items.length) return "";
      return `<div class="cat"><h3>${escapar(c.nombre)}<small>${items.length} ${items.length === 1 ? "producto" : "productos"}</small></h3>
        <ul class="rows">${items.map((p) => renglon(p, v.lineas[p.id], v.agotados(p))).join("")}</ul></div>`;
    })
    .join("");
}
