import "./styles.css";
import "./galeria.css";
import { iniciarComun } from "./comun";
import { iniciarVisor } from "./ui/visor";
import { iniciarFotos } from "./ui/galeria";

iniciarComun();
// Cada grupo abre el visor solo con sus fotos.
const visor = iniciarVisor();
document.querySelectorAll<HTMLElement>(".gal-rejilla").forEach((g) => iniciarFotos(visor, g));
