import type { Visor } from "./visor";

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

/** Carrusel que corre solo: se duplican las fotos para que la vuelta no se note. */
export function iniciarCarrusel(pista: HTMLElement): void {
  const originales = [...pista.children] as HTMLElement[];
  for (const el of originales) {
    const copia = el.cloneNode(true) as HTMLElement;
    copia.setAttribute("data-copia", "");
    copia.setAttribute("aria-hidden", "true");
    copia.tabIndex = -1;
    pista.append(copia);
  }
}
