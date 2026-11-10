/**
 * Animaciones al bajar: cada elemento con [data-aparece] entra con un desvanecido la primera vez que se ve.
 * Ya aparecido, se queda así aunque se vuelva a subir. Con [data-aparece-hijos], sus hijos entran uno tras otro.
 * Si el visitante pidió menos movimiento, todo se muestra desde el inicio.
 */
export function iniciarApariciones(): void {
  const raiz = document.documentElement;
  const quieto = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (quieto || !("IntersectionObserver" in window)) return;

  // Los hijos de [data-aparece-hijos] (ej. las fechas, que se pintan con JS) se escalonan.
  document.querySelectorAll<HTMLElement>("[data-aparece-hijos]").forEach((padre) => {
    [...padre.children].forEach((h, n) => {
      const el = h as HTMLElement;
      el.dataset.aparece ??= "";
      el.style.setProperty("--retraso", `${n * 90}ms`);
    });
  });
  // Tarjetas hermanas (ej. "Antes de pedir") también entran escalonadas.
  document.querySelectorAll<HTMLElement>("[data-aparece]").forEach((el) => {
    if (el.style.getPropertyValue("--retraso")) return;
    const hermanos = el.parentElement ? [...el.parentElement.children].filter((x) => x.hasAttribute("data-aparece")) : [];
    const n = hermanos.indexOf(el);
    if (n > 0) el.style.setProperty("--retraso", `${n * 110}ms`);
  });

  raiz.classList.add("con-apariciones");
  const vistos = new IntersectionObserver(
    (entradas) => {
      for (const e of entradas) {
        if (!e.isIntersecting) continue;
        const el = e.target as HTMLElement;
        el.classList.add("visto");
        vistos.unobserve(el);
        // Al terminar de entrar se quitan las marcas, para que el hover y los demás estilos funcionen normal.
        const espera = 1000 + (parseInt(el.style.getPropertyValue("--retraso")) || 0);
        window.setTimeout(() => {
          el.removeAttribute("data-aparece");
          el.classList.remove("visto");
          el.style.removeProperty("--retraso");
        }, espera);
      }
    },
    { threshold: 0.12, rootMargin: "0px 0px -6% 0px" },
  );
  document.querySelectorAll("[data-aparece]").forEach((el) => vistos.observe(el));
}
