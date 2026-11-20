import type { Visor } from "./visor";
import type { FotoVista } from "../lib/galeria";

/**
 * Fotos de la galería: cada recuadro [data-gal] muestra la foto de `data-src` (o, si no trae,
 * public/img/galeria/<id>.jpg). Mientras no exista la foto, se ve el recuadro de muestra. Al picar
 * uno se abre el visor con todas las fotos de su grupo, empezando por esa.
 */
const urlFoto = (el: HTMLElement): string => {
  const s = el.dataset.src ?? `img/galeria/${el.dataset.gal}.jpg`;
  return /^https?:\/\//.test(s) ? s : `${import.meta.env.BASE_URL}${s.replace(/^\//, "")}`;
};

export function iniciarFotos(visor: Visor, grupo: ParentNode): void {
  const recuadros = [...grupo.querySelectorAll<HTMLElement>("[data-gal]")];
  // Las copias del carrusel abren la misma foto que su original.
  const unicos = recuadros.filter((r) => !r.hasAttribute("data-copia"));
  const conFoto = new Set<string>();
  recuadros.forEach((el) => {
    const id = el.dataset.gal!;
    const url = urlFoto(el);
    const img = new Image();
    img.onload = () => {
      conFoto.add(id);
      el.style.backgroundImage = `url("${url}")`;
      // URL completa: dentro de una variable CSS una ruta relativa se resolvería contra la hoja de estilos.
      el.style.setProperty("--foto", `url("${new URL(url, location.href).href}")`);
      el.classList.add("con-foto");
    };
    img.src = url;
    el.addEventListener("click", () =>
      visor.abrir(
        unicos.map((r) => {
          const nombre = r.dataset.nombre ?? "";
          const titulo = r.hasAttribute("data-agotado") ? `${nombre} · Agotado por ahora` : nombre;
          return { titulo, alt: `Foto de ${nombre}`, media: conFoto.has(r.dataset.gal!) ? urlFoto(r) : undefined };
        }),
        Math.max(0, unicos.findIndex((r) => r.dataset.gal === id)),
      ),
    );
  });
}

/** Pinta un recuadro por foto dentro de `caja`. Las de productos agotados llevan la marca. */
export function pintarFotos(caja: HTMLElement, fotos: readonly FotoVista[]): void {
  caja.replaceChildren(
    ...fotos.map((f) => {
      const b = document.createElement("button");
      b.className = "gal-foto";
      b.type = "button";
      b.dataset.gal = f.clave;
      b.dataset.src = f.url;
      b.dataset.nombre = f.nombre;
      b.dataset.forma = f.forma;
      if (f.ancha) b.dataset.ancha = "";
      if (f.agotado) b.dataset.agotado = "";
      b.setAttribute("aria-label", `Ver foto de ${f.nombre} en grande${f.agotado ? " (agotado)" : ""}`);
      if (f.agotado) {
        const marca = document.createElement("span");
        marca.className = "gal-agotado";
        marca.textContent = "Agotado";
        b.append(marca);
      }
      const n = document.createElement("span");
      n.className = "gal-nombre";
      n.textContent = f.nombre;
      b.append(n);
      return b;
    }),
  );
}
