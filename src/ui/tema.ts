/** Botón de tema claro/oscuro. Sin elección guardada, sigue al sistema. */
const CLAVE = "walkiria-tema";
type Tema = "light" | "dark";

const sistema = (): Tema => (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");

function leer(): Tema | null {
  try {
    const v = localStorage.getItem(CLAVE);
    return v === "light" || v === "dark" ? v : null;
  } catch {
    return null;
  }
}

function guardar(t: Tema): void {
  try {
    localStorage.setItem(CLAVE, t);
  } catch {
    /* sin almacenamiento: dura esta visita */
  }
}

export function iniciarTema(boton: HTMLButtonElement): void {
  const aplicar = (t: Tema) => {
    document.documentElement.dataset.theme = t;
    boton.setAttribute("aria-checked", String(t === "dark"));
    boton.setAttribute("aria-label", t === "dark" ? "Cambiar a tema claro" : "Cambiar a tema oscuro");
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", t === "dark" ? "#3E0C14" : "#5E111C");
  };
  let actual: Tema = leer() ?? sistema();
  aplicar(actual);
  boton.addEventListener("click", () => {
    actual = actual === "dark" ? "light" : "dark";
    guardar(actual);
    aplicar(actual);
  });
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
    if (!leer()) aplicar((actual = sistema()));
  });
}
