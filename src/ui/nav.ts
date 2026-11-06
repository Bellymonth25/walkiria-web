/**
 * Barra de secciones: marca la sección en la que va el visitante y mueve un indicador animado.
 * Estilos para comparar con ?nav=luces (default), ?nav=copo o ?nav=linea.
 */
type Estilo = "luces" | "copo" | "linea";
const ESTILOS: readonly Estilo[] = ["luces", "copo", "linea"];

const COPO = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M12 2v20M3.3 7l17.4 10M3.3 17 20.7 7M12 5l-2-2M12 5l2-2M12 19l-2 2M12 19l2 2"/></svg>`;

export function iniciarNav(nav: HTMLElement, altoBarra: () => number): void {
  const pedido = new URLSearchParams(location.search).get("nav") as Estilo | null;
  const estilo: Estilo = pedido && ESTILOS.includes(pedido) ? pedido : "luces";
  nav.dataset.estilo = estilo;
  const ind = nav.querySelector<HTMLElement>(".nav-ind");
  if (!ind) return;
  if (estilo === "copo") ind.innerHTML = COPO;

  const enlaces = [...nav.querySelectorAll<HTMLAnchorElement>("a[href^='#']")];
  const secciones = enlaces
    .map((a) => document.querySelector<HTMLElement>(a.getAttribute("href")!))
    .filter((s): s is HTMLElement => s !== null);
  let actual: HTMLAnchorElement | null = null;
  let quitarMov = 0;

  const mover = (a: HTMLAnchorElement | null) => {
    if (a === actual) return;
    const habia = actual !== null;
    actual = a;
    enlaces.forEach((x) => x.setAttribute("aria-current", String(x === a)));
    if (!a) return ind.classList.remove("on");
    // La primera vez aparece en su lugar; después se desliza.
    if (!habia) ind.style.transition = "none";
    ind.style.width = `${a.offsetWidth}px`;
    ind.style.transform = `translateX(${a.offsetLeft}px)`;
    void ind.offsetWidth;
    ind.style.transition = "";
    ind.classList.add("on");
    if (habia) {
      ind.classList.remove("moviendo");
      void ind.offsetWidth;
      ind.classList.add("moviendo");
      clearTimeout(quitarMov);
      quitarMov = window.setTimeout(() => ind.classList.remove("moviendo"), 600);
    }
  };

  // La sección actual es la última cuyo inicio ya pasó un poco por debajo de la barra.
  const revisar = () => {
    const linea = altoBarra() + window.innerHeight * 0.3;
    let i = -1;
    secciones.forEach((s, k) => {
      if (s.getBoundingClientRect().top <= linea) i = k;
    });
    // Al llegar al final de la página, la última sección.
    if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) i = secciones.length - 1;
    mover(i >= 0 ? (enlaces[i] ?? null) : null);
  };

  let pendiente = false;
  window.addEventListener("scroll", () => {
    if (pendiente) return;
    pendiente = true;
    requestAnimationFrame(() => {
      pendiente = false;
      revisar();
    });
  }, { passive: true });
  window.addEventListener("resize", () => {
    const a = actual;
    actual = null;
    mover(a);
    revisar();
  });
  revisar();
}
