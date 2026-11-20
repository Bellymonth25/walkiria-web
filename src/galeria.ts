import "./styles.css";
import "./galeria.css";
import { iniciarComun } from "./comun";
import { iniciarVisor } from "./ui/visor";
import { iniciarFotos, pintarFotos } from "./ui/galeria";
import { galeriaViva } from "./ui/galeria-viva";
import type { FotoVista } from "./lib/galeria";

/**
 * Cuántas fotos se ven con la galería plegada (celular, 2 columnas). Al ocultarse un producto cambia
 * la cuadrícula; se busca el número más cercano a 8 que no deje huecos (verticales miden 2 de alto,
 * anchas 2 de ancho), acomodando como lo hace el navegador (grid-auto-flow: dense).
 */
function cuantasPlegada(fotos: readonly FotoVista[]): number {
  const sinHuecos = (k: number): boolean => {
    const ocupado: boolean[][] = [];
    const libre = (r: number, c: number) => !ocupado[r]?.[c];
    let celdas = 0;
    for (const f of fotos.slice(0, k)) {
      const w = f.ancha ? 2 : 1;
      const h = f.forma === "v" ? 2 : 1;
      for (let r = 0; ; r++) {
        const c = [0, 1].find((c0) => c0 + w <= 2 && [...Array(h).keys()].every((dr) => [...Array(w).keys()].every((dc) => libre(r + dr, c0 + dc))));
        if (c === undefined) continue;
        for (let dr = 0; dr < h; dr++) for (let dc = 0; dc < w; dc++) (ocupado[r + dr] ??= [])[c + dc] = true;
        celdas += w * h;
        break;
      }
    }
    return celdas === ocupado.length * 2;
  };
  for (const d of [0, 1, -1, 2, -2, 3]) if (8 + d <= fotos.length && sinHuecos(8 + d)) return 8 + d;
  return Math.min(8, fotos.length);
}

iniciarComun();
// Cada grupo abre el visor solo con sus fotos.
const visor = iniciarVisor();
const platillos = document.querySelector<HTMLElement>("#galPlatillos");
const plegable = document.querySelector<HTMLElement>("#galPlegable");
// Las fotos siguen al súper panel: sin productos ocultos y con la marca de agotado.
if (platillos) {
  galeriaViva((fotos) => {
    pintarFotos(platillos, fotos);
    iniciarFotos(visor, platillos);
    // En celular la galería empieza plegada: se ven unas 8 fotos (las que llenen la cuadrícula sin huecos) y un botón para el resto.
    const k = cuantasPlegada(fotos);
    [...platillos.children].forEach((el, i) => el.toggleAttribute("data-resto", i >= k));
    const resto = fotos.length - k;
    const n = document.querySelector("#galMasN");
    if (n) n.textContent = `(${resto} más)`;
    if (resto <= 0) plegable?.classList.remove("plegada");
  });
}
document.querySelector("#galMas")?.addEventListener("click", () => plegable?.classList.remove("plegada"));
document.querySelectorAll<HTMLElement>(".gal-rejilla:not(#galPlatillos)").forEach((g) => iniciarFotos(visor, g));
