import "./styles.css";
import "./galeria.css";
import { iniciarComun } from "./comun";
import { iniciarVisor } from "./ui/visor";
import { iniciarFotos, pintarFotos } from "./ui/galeria";
import { fotosPlatillos } from "./data/galeria";

iniciarComun();
// Cada grupo abre el visor solo con sus fotos.
const visor = iniciarVisor();
const platillos = document.querySelector<HTMLElement>("#galPlatillos");
if (platillos) pintarFotos(platillos, fotosPlatillos);
// En celular la galería empieza plegada: se ven las primeras 8 fotos y un botón para el resto.
const plegable = document.querySelector<HTMLElement>("#galPlegable");
const resto = (platillos?.children.length ?? 0) - 8;
const n = document.querySelector("#galMasN");
if (n) n.textContent = `(${resto} más)`;
if (resto <= 0) plegable?.classList.remove("plegada");
document.querySelector("#galMas")?.addEventListener("click", () => plegable?.classList.remove("plegada"));
document.querySelectorAll<HTMLElement>(".gal-rejilla").forEach((g) => iniciarFotos(visor, g));
