import type { Visor } from "./visor";
import type { FotoGaleria } from "../data/galeria";

/**
 * Fotos de la galería: cada recuadro [data-gal] muestra public/img/galeria/<id>.jpg.
 * Mientras no exista la foto, se ve el recuadro de muestra. Al picar uno se abre el visor
 * con todas las fotos de su grupo, empezando por esa.
 */
const urlFoto = (id: string) => `${import.meta.env.BASE_URL}img/galeria/${id}.jpg`;

export function iniciarFotos(visor: Visor, grupo: ParentNode): void {
  const recuadros = [...grupo.querySelectorAll<HTMLElement>("[data-gal]")];
  // Las copias del carrusel abren la misma foto que su original.
  const unicos = recuadros.filter((r) => !r.hasAttribute("data-copia"));
  const conFoto = new Set<string>();
  recuadros.forEach((el) => {
    const id = el.dataset.gal!;
    const img = new Image();
    img.onload = () => {
      conFoto.add(id);
      el.style.backgroundImage = `url("${urlFoto(id)}")`;
      // URL completa: dentro de una variable CSS una ruta relativa se resolvería contra la hoja de estilos.
      el.style.setProperty("--foto", `url("${new URL(urlFoto(id), location.href).href}")`);
      el.classList.add("con-foto");
    };
    img.src = urlFoto(id);
    el.addEventListener("click", () =>
      visor.abrir(
        unicos.map((r) => {
          const rid = r.dataset.gal!;
          const nombre = r.dataset.nombre ?? "";
          return { titulo: nombre, alt: `Foto de ${nombre}`, media: conFoto.has(rid) ? urlFoto(rid) : undefined };
        }),
        Math.max(0, unicos.findIndex((r) => r.dataset.gal === id)),
      ),
    );
  });
}

/** Pinta un recuadro por foto disponible dentro de `caja`. */
export function pintarFotos(caja: HTMLElement, fotos: FotoGaleria[]): void {
  caja.replaceChildren(
    ...fotos
      .filter((f) => f.disponible !== false)
      .map((f) => {
        const b = document.createElement("button");
        b.className = "gal-foto";
        b.type = "button";
        b.dataset.gal = f.id;
        b.dataset.nombre = f.nombre;
        b.dataset.forma = f.forma;
        if (f.ancha) b.dataset.ancha = "";
        b.setAttribute("aria-label", `Ver foto de ${f.nombre} en grande`);
        const n = document.createElement("span");
        n.className = "gal-nombre";
        n.textContent = f.nombre;
        b.append(n);
        return b;
      }),
  );
}
