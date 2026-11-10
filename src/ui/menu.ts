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
  /** Grupos (lomos, pechuga…) que el cliente abrió para elegir su versión. */
  abiertos: ReadonlySet<string>;
}

/** Una opción dentro de un grupo: un producto de la familia o una versión del producto. */
export interface Opcion {
  producto: Producto;
  version: string;
  etiqueta: string;
}

/** Un renglón de la lista: un producto solo, o un grupo con opciones. */
export interface Fila {
  clave: string;
  nombre: string;
  productos: Producto[];
  opciones: Opcion[] | null;
}

/** Clave del renglón donde vive un producto: la familia, o el propio producto. */
export const claveFila = (p: Producto): string => (p.familia ? `f-${normalizar(p.familia).replace(/[^a-z0-9]+/g, "-")}` : p.id);

/** Agrupa el catálogo en renglones, respetando el orden de la lista. */
export function filas(catalogo: readonly Producto[]): Fila[] {
  const salida: Fila[] = [];
  for (const p of catalogo) {
    const clave = claveFila(p);
    const ya = salida.find((f) => f.clave === clave);
    if (ya) {
      ya.productos.push(p);
      ya.opciones!.push({ producto: p, version: "", etiqueta: p.opcion ?? p.nombre });
      continue;
    }
    if (p.familia) salida.push({ clave, nombre: p.familia, productos: [p], opciones: [{ producto: p, version: "", etiqueta: p.opcion ?? p.nombre }] });
    else if (p.versiones?.length) salida.push({ clave, nombre: p.nombre, productos: [p], opciones: p.versiones.map((ver) => ({ producto: p, version: ver, etiqueta: ver })) });
    else salida.push({ clave, nombre: p.nombre, productos: [p], opciones: null });
  }
  return salida;
}

export function pintarChips(v: VistaMenu): void {
  const todas = filas(v.catalogo);
  const cuenta = (id: Filtro) => (id === "todo" ? todas.length : todas.filter((f) => f.productos[0]!.categoria === id).length);
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

function detalle(p: Producto, id: string, l: Linea, numero: number, titulo = ""): string {
  const n = escapar(p.nombre);
  const porKilo = p.unidad === "kg" && !p.pavoEntero && !p.pieza;
  const unidad = p.pieza ? (l.cantidad === 1 ? p.pieza.nombre : p.pieza.plural) : p.unidad === "pza" ? "pzas" : "kg";
  const partes: string[] = [];
  // Con varios pavos o maquilas, cada uno lleva su número para no confundirlos.
  if (numero > 0) partes.push(`<div class="dnum dwide">${p.maquila ? "Maquila" : "Pavo"} ${numero}</div>`);
  if (titulo) partes.push(`<div class="dnum dwide">${escapar(titulo)}</div>`);

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

/** Renglón de un grupo: al picar "Agregar" aparecen sus versiones; cada una se pide por separado. */
function renglonGrupo(v: VistaMenu, f: Fila): string {
  const opciones = f.opciones!;
  const lineas = f.productos.flatMap((p) => lineasDe(v, p));
  const enPedido = lineas.length > 0;
  const todoAgotado = f.productos.every((p) => v.agotados(p));
  const abierto = !todoAgotado && (enPedido || v.abiertos.has(f.clave));
  const precios = [...new Set(f.productos.map((p) => p.precio))];
  const primero = f.productos[0]!;
  const unidad = primero.unidad;
  // "Mechado, adobado o a la ciruela."
  const enO = (xs: string[]) => (xs.length <= 1 ? (xs[0] ?? "") : `${xs.slice(0, -1).join(", ")} o ${xs[xs.length - 1]}`);
  const texto = enO(opciones.map((o) => o.etiqueta.toLowerCase()));
  const desc = f.productos.length > 1 ? `${texto.charAt(0).toUpperCase()}${texto.slice(1)}.` : (primero.descripcion ?? "");
  const accion = todoAgotado
    ? `<span class="soldout">Agotado</span>`
    : enPedido
      ? `<span class="inorder">En tu pedido</span>`
      : `<button type="button" class="add" data-abrir="${f.clave}" aria-expanded="${abierto}">${abierto ? "Elige abajo" : "Agregar"}</button>`;
  const lineaDe = (o: Opcion) => lineas.find(([, l]) => l.productoId === o.producto.id && (l.version ?? "") === o.version);
  const chips = opciones
    .map((o) => {
      const ya = Boolean(lineaDe(o));
      const no = v.agotados(o.producto);
      const precio = precios.length > 1 ? `<small>${dinero(o.producto.precio)}/${unidad}</small>` : "";
      return `<button type="button" class="vchip" data-addv="${o.producto.id}|${escapar(o.version)}" aria-pressed="${ya}"${no ? " disabled" : ""}>${ya ? "✓ " : "+ "}${escapar(o.etiqueta)}${no ? " <small>agotado</small>" : precio}</button>`;
    })
    .join("");
  const detalles = opciones
    .map((o) => {
      const x = lineaDe(o);
      return x ? detalle(o.producto, x[0], x[1], 0, `${f.nombre} ${o.etiqueta.toLowerCase()}`) : "";
    })
    .join("");
  return `<li class="row grupo${enPedido ? " in" : ""}${todoAgotado ? " agotado" : ""}" data-row="${f.clave}">
    <div class="name">${escapar(f.nombre)}${f.productos.some((p) => p.clasico) ? '<span class="tag">Clásico</span>' : ""}${desc ? `<span class="meta">${escapar(desc)}</span>` : ""}</div>
    <div class="price num">${precios.length > 1 ? "<small>desde</small> " : ""}<b>${dinero(Math.min(...precios))}</b><span>/${unidad}</span></div>
    <div class="action">${accion}</div>
    ${abierto ? `<div class="versiones"><span class="dlabel">${enPedido ? "¿Quieres otra?" : "¿Cuál quieres? Puedes elegir varias"}</span><div class="vchips">${chips}</div></div>` : ""}
    ${detalles}</li>`;
}

const pintarFila = (v: VistaMenu, f: Fila): string =>
  f.opciones ? renglonGrupo(v, f) : renglon(f.productos[0]!, lineasDe(v, f.productos[0]!), v.agotados(f.productos[0]!));

export function pintarRenglon(v: VistaMenu, productoId: string): void {
  const p = v.catalogo.find((x) => x.id === productoId);
  if (!p) return;
  const f = filas(v.catalogo).find((x) => x.clave === claveFila(p));
  const el = document.querySelector(`[data-row="${claveFila(p)}"]`);
  if (f && el) el.outerHTML = pintarFila(v, f);
}

/** Repinta un grupo por su clave (al abrirlo). */
export function pintarFilaPorClave(v: VistaMenu, clave: string): void {
  const f = filas(v.catalogo).find((x) => x.clave === clave);
  const el = document.querySelector(`[data-row="${clave}"]`);
  if (f && el) el.outerHTML = pintarFila(v, f);
}

export function pintarMenu(v: VistaMenu): void {
  const q = normalizar(v.busqueda.trim());
  const coincide = (f: Fila) =>
    !q || [f.nombre, ...f.productos.map((p) => p.nombre), ...(f.opciones ?? []).map((o) => o.etiqueta)].some((t) => normalizar(t).includes(q));
  const visibles = filas(v.catalogo).filter((f) => (v.filtro === "todo" || f.productos[0]!.categoria === v.filtro) && coincide(f));
  const menu = $("#menu");
  if (!visibles.length) {
    menu.innerHTML = `<div class="empty">No encontramos "${escapar(v.busqueda)}". Prueba con otra palabra o pregúntanos por WhatsApp.</div>`;
    return;
  }
  menu.innerHTML = v.categorias
    .map((c) => {
      const items = visibles.filter((f) => f.productos[0]!.categoria === c.id);
      if (!items.length) return "";
      return `<div class="cat${c.id === "maquila" ? " cat-maquila" : ""}" id="cat-${c.id}"><h3>${escapar(c.nombre)}<small>${items.length} ${items.length === 1 ? "producto" : "productos"}</small></h3>
        <ul class="rows">${items.map((f) => pintarFila(v, f)).join("")}</ul></div>`;
    })
    .join("");
}
