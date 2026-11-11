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
document.querySelectorAll<HTMLElement>(".gal-rejilla").forEach((g) => iniciarFotos(visor, g));
