/**
 * Selector experimental de paletas 60/30/10 en el pie de página.
 * "original" quita data-paleta y deja los colores de siempre. La elección se guarda por navegador.
 */
const CLAVE = "walkiria-paleta";
export const PALETAS = [
  { id: "original", nombre: "Original", muestra: "#5C1418" },
  { id: "a", nombre: "A · Volante", muestra: "#D9AE52" },
  { id: "b", nombre: "B · Logo", muestra: "#C2202F" },
  { id: "c", nombre: "C · Café", muestra: "#3B2718" },
] as const;
type Paleta = (typeof PALETAS)[number]["id"];

const valida = (v: string | null): v is Paleta => PALETAS.some((p) => p.id === v);

function leer(): Paleta {
  try {
    const v = localStorage.getItem(CLAVE);
    return valida(v) ? v : "original";
  } catch {
    return "original";
  }
}

function guardar(p: Paleta): void {
  try {
    if (p === "original") localStorage.removeItem(CLAVE);
    else localStorage.setItem(CLAVE, p);
  } catch {
    /* sin almacenamiento: dura esta visita */
  }
}

export function aplicarPaleta(p: Paleta): void {
  if (p === "original") delete document.documentElement.dataset.paleta;
  else document.documentElement.dataset.paleta = p;
}

export function iniciarPaletas(pie: HTMLElement): void {
  const caja = document.createElement("div");
  caja.className = "paletas";
  caja.setAttribute("role", "group");
  caja.setAttribute("aria-label", "Paleta de colores de prueba");
  caja.innerHTML =
    `<span>Paleta de prueba:</span>` +
    PALETAS.map((p) => `<button type="button" data-paleta="${p.id}" aria-pressed="false"><i style="background:${p.muestra}"></i>${p.nombre}</button>`).join("");
  pie.append(caja);

  const botones = [...caja.querySelectorAll<HTMLButtonElement>("button")];
  const marcar = (p: Paleta) => botones.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.paleta === p)));
  const actual = leer();
  aplicarPaleta(actual);
  marcar(actual);
  caja.addEventListener("click", (e) => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>("button[data-paleta]");
    if (!b || !valida(b.dataset.paleta ?? null)) return;
    const p = b.dataset.paleta as Paleta;
    guardar(p);
    aplicarPaleta(p);
    marcar(p);
  });
}
