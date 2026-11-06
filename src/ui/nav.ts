/** Barra de secciones: marca la sección en la que va el visitante con un subrayado dorado que se desliza. */

export function iniciarNav(nav: HTMLElement, altoBarra: () => number): void {
  const ind = nav.querySelector<HTMLElement>(".nav-ind");
  if (!ind) return;

  const enlaces = [...nav.querySelectorAll<HTMLAnchorElement>("a[href^='#']")];
  const secciones = enlaces
    .map((a) => document.querySelector<HTMLElement>(a.getAttribute("href")!))
    .filter((s): s is HTMLElement => s !== null);
  let actual: HTMLAnchorElement | null = null;

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
  };

  // La sección actual es la última cuyo inicio ya pasó un poco por debajo de la barra.
  const revisar = () => {
    const linea = altoBarra() + window.innerHeight * 0.3;
    let i = -1;
    secciones.forEach((s, k) => {
      if (s.getBoundingClientRect().top <= linea) i = k;
    });
    // Al llegar al final de la página, la última sección.
    // (Si el visitante tocó otra sección en el menú, esa se respeta: ver "fijada" abajo).
    if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) i = secciones.length - 1;
    mover(i >= 0 ? (enlaces[i] ?? null) : null);
  };

  // Al tocar una sección, esa queda marcada mientras la página baja (no la que se asome después).
  let fijada = false;
  let finScroll = 0;
  enlaces.forEach((a) =>
    a.addEventListener("click", () => {
      mover(a);
      fijada = true;
      // Si la página ya estaba ahí y no se mueve, se libera solo.
      clearTimeout(finScroll);
      finScroll = window.setTimeout(() => (fijada = false), 1000);
    }),
  );

  let pendiente = false;
  window.addEventListener("scroll", () => {
    if (fijada) {
      // Se libera un momento después de que la página deja de moverse.
      clearTimeout(finScroll);
      finScroll = window.setTimeout(() => (fijada = false), 200);
      return;
    }
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
