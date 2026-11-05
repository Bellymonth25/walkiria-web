import type { Categoria, CategoriaId, Producto } from "../types";
import { cantidad, dinero, escapar, normalizar, sufijo } from "../lib/formato";
import { $ } from "./dom";

export type Filtro = CategoriaId | "todo";

export function pintarChips(categorias: readonly Categoria[], catalogo: readonly Producto[], activo: Filtro): void {
  const cuenta = (id: Filtro) => (id === "todo" ? catalogo.length : catalogo.filter((p) => p.categoria === id).length);
  $("#chips").innerHTML = [{ id: "todo" as Filtro, nombre: "Todo" }, ...categorias]
    .map(
      (c) =>
        `<button class="chip" type="button" data-cat="${c.id}" aria-pressed="${activo === c.id}">${escapar(c.nombre)}<span class="c">${cuenta(c.id)}</span></button>`,
    )
    .join("");
}

function renglon(p: Producto, q: number): string {
  const n = escapar(p.nombre);
  const medio = p.unidad === "kg" ? `<span class="num">½ kg ${dinero(p.precio / 2)}</span>` : "";
  const desc = p.descripcion ? `${escapar(p.descripcion)} ` : "";
  const control = q
    ? `<button type="button" data-dec="${p.id}" aria-label="Quitar ${n}">−</button><output class="num">${cantidad(q, p.unidad)}</output><button type="button" data-inc="${p.id}" aria-label="Agregar más ${n}">+</button>`
    : `<button type="button" class="add" data-inc="${p.id}">Agregar</button>`;
  return `<li class="row${q ? " in" : ""}">
    <div class="name">${n}${p.clasico ? '<span class="tag">Clásico</span>' : ""}<span class="meta">${desc}${medio}</span></div>
    <div class="price num"><b>${dinero(p.precio)}</b><span>/${sufijo(p.unidad)}</span></div>
    <div class="qty">${control}</div></li>`;
}

export function pintarMenu(
  categorias: readonly Categoria[],
  catalogo: readonly Producto[],
  filtro: Filtro,
  busqueda: string,
  cantidades: Readonly<Record<string, number>>,
): void {
  const q = normalizar(busqueda.trim());
  const visibles = catalogo.filter(
    (p) => (filtro === "todo" || p.categoria === filtro) && (!q || normalizar(p.nombre).includes(q)),
  );
  const menu = $("#menu");
  if (!visibles.length) {
    menu.innerHTML = `<div class="empty">No encontramos "${escapar(busqueda)}". Prueba con otra palabra o pregúntanos por WhatsApp.</div>`;
    return;
  }
  menu.innerHTML = categorias
    .map((c) => {
      const items = visibles.filter((p) => p.categoria === c.id);
      if (!items.length) return "";
      return `<div class="cat"><h3>${escapar(c.nombre)}<small>${items.length} ${items.length === 1 ? "producto" : "productos"}</small></h3>
        <ul class="rows">${items.map((p) => renglon(p, cantidades[p.id] ?? 0)).join("")}</ul></div>`;
    })
    .join("");
}
