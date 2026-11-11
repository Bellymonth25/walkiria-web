/**
 * Carrusel al estilo Material 3 ("multi-browse"): fotos grandes al inicio, luego una mediana y una chica.
 * Como pide Material, la foto no se encoge: se recorta (máscara) cuando su recuadro se hace chico.
 * Avanza solo cada pocos segundos; se pausa con el mouse encima. En celular se desliza con el dedo.
 * Al picar una foto chica o mediana, el carrusel avanza hasta ella; al picar una grande se abre en el visor.
 */
const ESPACIO = 8;

export function iniciarCarrusel(caja: HTMLElement, pista: HTMLElement): void {
  const originales = [...pista.children] as HTMLElement[];
  const n = originales.length;
  if (!n) return;
  // Tres vueltas seguidas para que el carrusel nunca se acabe: se trabaja en la de en medio.
  const copiar = () =>
    originales.map((el) => {
      const c = el.cloneNode(true) as HTMLElement;
      c.setAttribute("data-copia", "");
      c.setAttribute("aria-hidden", "true");
      c.tabIndex = -1;
      return c;
    });
  pista.prepend(...copiar());
  pista.append(...copiar());
  const fotos = [...pista.children] as HTMLElement[];

  let actual = n; // primera foto grande
  let grandes = 3;
  let anchos = { chica: 56, mediana: 200, grande: 300 };

  const medir = () => {
    const ancho = caja.clientWidth;
    grandes = ancho >= 1000 ? 3 : ancho >= 620 ? 2 : 1;
    const chica = ancho < 620 ? 40 : 56;
    const factorMediana = grandes === 1 ? 0.42 : 0.55;
    const grande = (ancho - chica - (grandes + 1) * ESPACIO) / (grandes + factorMediana);
    anchos = { chica, mediana: grande * factorMediana, grande };
    caja.style.setProperty("--ancho-grande", `${grande}px`);
  };

  const pintar = (animar = true) => {
    pista.classList.toggle("sin-animar", !animar);
    let x = 0;
    fotos.forEach((f, i) => {
      const d = i - actual;
      let tam: keyof typeof anchos = "chica";
      if (d >= 0 && d < grandes) tam = "grande";
      else if (d === grandes) tam = "mediana";
      f.style.width = `${anchos[tam]}px`;
      f.dataset.tam = tam;
      if (i < actual) x += anchos.chica + ESPACIO;
    });
    pista.style.transform = `translateX(${-x}px)`;
    if (!animar) void pista.offsetWidth;
  };

  const ir = (destino: number) => {
    actual = destino;
    pintar();
    // Al salir de la vuelta de en medio, regresa sin que se note.
    if (actual >= 2 * n || actual < n) {
      const regreso = actual >= 2 * n ? actual - n : actual + n;
      setTimeout(() => {
        actual = regreso;
        pintar(false);
        pista.classList.remove("sin-animar");
      }, 560);
    }
  };
  const siguiente = () => ir(actual + 1);
  const anterior = () => ir(actual - 1);

  // Avance automático, en pausa con el mouse encima, con el teclado dentro o fuera de pantalla.
  let encima = false;
  let visible = true;
  setInterval(() => {
    const teclado = caja.matches(":has(:focus-visible)");
    if (!encima && visible && !teclado && !document.hidden) siguiente();
  }, 3200);
  if (matchMedia("(hover:hover)").matches) {
    caja.addEventListener("mouseenter", () => (encima = true));
    caja.addEventListener("mouseleave", () => (encima = false));
  }
  if ("IntersectionObserver" in window) {
    new IntersectionObserver((e) => (visible = e.some((x) => x.isIntersecting))).observe(caja);
  }

  // Deslizar con el dedo o arrastrando.
  let inicio: number | null = null;
  let arrastro = false;
  pista.addEventListener("pointerdown", (e) => {
    inicio = e.clientX;
    arrastro = false;
  });
  pista.addEventListener("pointerup", (e) => {
    if (inicio === null) return;
    const dx = e.clientX - inicio;
    inicio = null;
    if (Math.abs(dx) > 40) {
      arrastro = true;
      dx < 0 ? siguiente() : anterior();
    }
  });
  pista.addEventListener("dragstart", (e) => e.preventDefault());

  // Picar una foto chica o mediana la trae al frente en lugar de abrirla.
  pista.addEventListener(
    "click",
    (e) => {
      const foto = (e.target as HTMLElement).closest<HTMLElement>(".gal-foto");
      if (!foto) return;
      if (arrastro) {
        arrastro = false;
        e.stopImmediatePropagation();
        return;
      }
      if (foto.dataset.tam !== "grande") {
        e.stopImmediatePropagation();
        const i = fotos.indexOf(foto);
        ir(i < actual ? i : Math.max(actual + 1, i - grandes + 1));
      }
    },
    true,
  );

  caja.parentElement?.querySelector<HTMLButtonElement>("[data-carrusel='ant']")?.addEventListener("click", anterior);
  caja.parentElement?.querySelector<HTMLButtonElement>("[data-carrusel='sig']")?.addEventListener("click", siguiente);

  medir();
  pintar(false);
  pista.classList.remove("sin-animar");
  new ResizeObserver(() => {
    medir();
    pintar(false);
    pista.classList.remove("sin-animar");
  }).observe(caja);
}
