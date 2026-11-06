import type { Categoria, CategoriaId, Linea, Presentacion, Producto } from "../types";
import { dinero, escapar, kilos, normalizar } from "../lib/formato";
import {
  empaquesDe, importeLinea, tieneCosto, variasLineas, llevaRelleno, nombrePresentacion, presentaciones, textoEmpaques,
} from "../lib/pedido";
import { maquila, pavo } from "../data/temporada";
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
        `<button class="chip" type="button" data-cat="${c.id}" aria-pressed="${v.filtro === c.id}">${escapar(c.id === "maquila" ? "Maquila" : c.nombre)}<span class="c">${cuenta(c.id)}</span></button>`,
    )
    .join("");
}

/** Texto bajo la cantidad: empaques y subtotal. Se actualiza mientras el cliente escribe. */
export function textoDetalle(p: Producto, l: Linea): string {
  const partes: string[] = [];
  if (presentaciones(p).length) partes.push(textoEmpaques(l.presentacion, empaquesDe(p, l)));
  if (p.maquila && llevaRelleno(l)) partes.push(`relleno ${kilos(l.kgRelleno)} (+${dinero(l.kgRelleno * maquila.precioRellenoKg)})`);
  partes.push(`Subtotal ${dinero(importeLinea(p, l))}`);
  return partes.join(" · ");
}

/** Lo que cuesta una presentación para esta línea: "mediana +$30", "2 grandes +$70". */
export function precioPresentacion(p: Producto, l: Linea, pr: Presentacion): string {
  if (!tieneCosto(pr)) return "sin costo";
  const es = empaquesDe(p, { ...l, presentacion: pr });
  const total = es.reduce((a, e) => a + e.piezas * e.precio, 0);
  const tam = es.map((e) => (e.piezas > 1 ? `${e.piezas} ${e.tamano}s` : e.tamano)).join(", ");
  return `${tam} +${dinero(total)}`;
}

/** Al escribir una cantidad, el precio de cada botón de presentación se actualiza sin repintar. */
export function actualizarPreciosPresentacion(p: Producto, id: string, l: Linea): void {
  for (const pr of presentaciones(p)) {
    const el = document.querySelector(`[data-presprecio="${id}:${pr}"]`);
    if (el) el.textContent = precioPresentacion(p, l, pr);
  }
}

function seg(nombre: string, id: string, opciones: [string, string][], actual: string): string {
  return `<div class="seg" role="group" aria-label="${nombre}">${opciones
    .map(([valor, texto]) => `<button type="button" data-${nombre}="${id}:${valor}" aria-pressed="${actual === valor}">${texto}</button>`)
    .join("")}</div>`;
}

function campoNumero(id: string, attr: string, valor: number, min: string, step: string, modo: string, etiqueta: string): string {
  return `<input id="${attr}-${id}" class="num" type="number" inputmode="${modo}" min="${min}" step="${step}" value="${valor}" data-${attr}="${id}" aria-label="${etiqueta}">`;
}

function detalle(p: Producto, id: string, l: Linea, numero: number): string {
  const n = escapar(p.nombre);
  const porKilo = p.unidad === "kg" && !p.pavoEntero && !p.pieza;
  const unidad = p.pieza ? (l.cantidad === 1 ? p.pieza.nombre : p.pieza.plural) : p.unidad === "pza" ? "pzas" : "kg";
  const partes: string[] = [];
  // Con varios pavos o maquilas, cada uno lleva su número para no confundirlos.
  if (numero > 0) partes.push(`<div class="dnum dwide">${p.maquila ? "Maquila" : "Pavo"} ${numero}</div>`);

  if (p.maquila) {
    const opciones = maquila.tipos
      .map((t) => `<option value="${escapar(t)}"${l.tipoMaquila === t ? " selected" : ""}>${t === "Otro" ? "Otro (especificar)" : escapar(t)}</option>`)
      .join("");
    partes.push(`<div class="dfield dwide"><label class="dlabel" for="tipo-${id}">¿Qué nos trae?</label>
      <select id="tipo-${id}" data-tipo="${id}"><option value=""${l.tipoMaquila ? "" : " selected"} disabled>Elige una opción</option>${opciones}</select>
      ${l.tipoMaquila === "Otro" ? `<input type="text" id="otro-${id}" data-otro="${id}" value="${escapar(l.otroMaquila)}" placeholder="Especificar: qué carne y cómo la quiere">` : ""}</div>`);
  }

  if (p.pavoEntero) {
    partes.push(`<div class="dfield"><span class="dlabel">Tamaño</span>${seg("size", id, [
      ["completo", `Completo <small>desde ${pavo.kgMinimoCompleto} kg</small>`],
      ["medio", `Medio pavo <small>${pavo.kgMedio.min} a ${pavo.kgMedio.max} kg</small>`],
    ], l.tamano)}</div>`);
  }

  // Cada pavo es su propia línea: no lleva cantidad, solo tamaño y peso.
  if (!p.pavoEntero) partes.push(`<div class="dfield"><label class="dlabel" for="qty-${id}">${p.maquila ? "Kilos aprox. de su carne" : "Cantidad"}</label>
    <div class="qty">
      <button type="button" data-dec="${id}" aria-label="Menos ${n}">−</button>
      ${p.maquila
        ? `<input id="qty-${id}" class="num" type="number" inputmode="decimal" min="0" step="0.25" value="${l.cantidad > 0 ? l.cantidad : ""}" placeholder="Ej. 6" data-qty="${id}" aria-label="Kilos aproximados de su carne">`
        : campoNumero(id, "qty", l.cantidad, porKilo ? "0.25" : "1", porKilo ? "0.25" : "1", porKilo ? "decimal" : "numeric", `Cantidad de ${n}`)}
      <button type="button" data-inc="${id}" aria-label="Más ${n}">+</button>
      <span class="unit">${unidad}</span>
    </div></div>`);

  if (p.pavoEntero && l.tamano === "completo") {
    partes.push(`<div class="dfield"><label class="dlabel" for="kgpavo-${id}">Kilos aprox. por pavo</label>
      <div class="qty">${campoNumero(id, "kgpavo", l.kgPorPavo, String(pavo.kgMinimoCompleto), "0.5", "decimal", "Kilos por pavo")}<span class="unit">kg (mín. ${pavo.kgMinimoCompleto})</span></div></div>`);
  }

  if (p.maquila && llevaRelleno(l)) {
    partes.push(`<div class="dfield"><label class="dlabel" for="relleno-${id}">Kilos de relleno</label>
      <div class="qty">${campoNumero(id, "relleno", l.kgRelleno, "0", "0.25", "decimal", "Kilos de relleno")}<span class="unit">kg · ${dinero(maquila.precioRellenoKg)}/kg</span></div>
      <span class="dhint">Sugerido: 1 kg para pavos de 5 a 7 kg, 1.5 kg de 7 a 9 kg; más grande, más relleno.</span></div>`);
  }

  const pres = presentaciones(p);
  if (pres.length) {
    partes.push(`<div class="dfield"><span class="dlabel">Presentación</span>${seg(
      "pres",
      id,
      pres.map((x) => [x, `${nombrePresentacion[x]} <small data-presprecio="${id}:${x}">${escapar(precioPresentacion(p, l, x))}</small>`]),
      l.presentacion,
    )}</div>`);
  }

  if (p.maquila) {
    partes.push(`<div class="dfield dwide"><label class="dlabel" for="nota-${id}">Indicaciones para esta maquila (opcional)</label>
      <input type="text" id="nota-${id}" data-notalinea="${id}" value="${escapar(l.nota)}" placeholder="Ej. Con poca sal, partido en rebanadas"></div>`);
  }

  return `<div class="detail" data-line="${id}">${partes.join("")}
    <div class="dfoot"><span class="dinfo" data-info="${id}">${escapar(textoDetalle(p, l))}</span>
    <button type="button" class="del" data-del="${id}">Quitar</button></div></div>`;
}

export function renglon(p: Producto, lineas: readonly [string, Linea][], agotado: boolean): string {
  const n = escapar(p.nombre);
  const enPedido = lineas.length > 0;
  const accion = agotado
    ? `<span class="soldout">Agotado</span>`
    : variasLineas(p)
      ? `<button type="button" class="add" data-add="${p.id}">${enPedido ? (p.maquila ? "Agregar otra" : "Agregar otro") : "Agregar"}</button>`
      : enPedido
        ? `<span class="inorder">En tu pedido</span>`
        : `<button type="button" class="add" data-add="${p.id}">Agregar</button>`;
  return `<li class="row${enPedido ? " in" : ""}${agotado ? " agotado" : ""}" data-row="${p.id}">
    <div class="name">${n}${p.clasico ? '<span class="tag">Clásico</span>' : ""}${p.descripcion ? `<span class="meta">${escapar(p.descripcion)}</span>` : ""}</div>
    <div class="price num"><b>${dinero(p.precio)}</b><span>/${p.unidad}</span></div>
    <div class="action">${accion}</div>
    ${agotado ? "" : lineas.map(([id, l], i) => detalle(p, id, l, lineas.length > 1 ? i + 1 : 0)).join("")}</li>`;
}

const lineasDe = (v: VistaMenu, p: Producto): [string, Linea][] =>
  Object.entries(v.lineas).filter(([, l]) => l.productoId === p.id);

export function pintarRenglon(v: VistaMenu, productoId: string): void {
  const p = v.catalogo.find((x) => x.id === productoId);
  const el = document.querySelector(`[data-row="${productoId}"]`);
  if (p && el) el.outerHTML = renglon(p, lineasDe(v, p), v.agotados(p));
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
      return `<div class="cat${c.id === "maquila" ? " cat-maquila" : ""}" id="cat-${c.id}"><h3>${escapar(c.nombre)}<small>${items.length} ${items.length === 1 ? "producto" : "productos"}</small></h3>
        <ul class="rows">${items.map((p) => renglon(p, lineasDe(v, p), v.agotados(p))).join("")}</ul></div>`;
    })
    .join("");
}
