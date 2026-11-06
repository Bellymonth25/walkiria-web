/**
 * "Tu pedido" en celular como bottom sheet: se abre o cierra tocando la barra,
 * o arrastrándola (o la rayita de arriba) hacia arriba o abajo.
 */
const VISIBLE = 106;

export function iniciarHoja(hoja: HTMLElement, barra: HTMLButtonElement, textoBoton: HTMLElement): void {
  const movil = window.matchMedia("(max-width: 980px)");
  const agarre = hoja.querySelector<HTMLElement>(".grip");

  const poner = (abierta: boolean) => {
    hoja.classList.toggle("open", abierta);
    barra.setAttribute("aria-expanded", String(abierta));
    textoBoton.textContent = abierta ? "Ocultar" : "Ver pedido";
    if (!abierta) hoja.scrollTop = 0;
  };

  // Cuánto baja la hoja cuando está cerrada: solo asoman la rayita y la barra.
  const cerradaY = () => hoja.offsetHeight - VISIBLE;
  const desplazado = () => new DOMMatrixReadOnly(getComputedStyle(hoja).transform).m42;

  let inicioY = 0;
  let base = 0;
  let ultimoY = 0;
  let ultimoT = 0;
  let velocidad = 0;
  let arrastrando = false;
  let movido = false;

  const bajar = (e: PointerEvent) => {
    if (!movil.matches || hoja.dataset.empty === "true") return;
    arrastrando = true;
    movido = false;
    inicioY = ultimoY = e.clientY;
    ultimoT = e.timeStamp;
    velocidad = 0;
    base = desplazado();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const mover = (e: PointerEvent) => {
    if (!arrastrando) return;
    const dy = e.clientY - inicioY;
    if (!movido && Math.abs(dy) < 6) return;
    if (!movido) {
      movido = true;
      hoja.classList.add("arrastrando");
    }
    const y = Math.min(Math.max(base + dy, 0), cerradaY());
    hoja.style.transform = `translateY(${y}px)`;
    const dt = e.timeStamp - ultimoT;
    if (dt > 0) velocidad = (e.clientY - ultimoY) / dt;
    ultimoY = e.clientY;
    ultimoT = e.timeStamp;
  };

  const soltar = () => {
    if (!arrastrando) return;
    arrastrando = false;
    if (!movido) return; // Fue un toque: lo maneja el clic.
    hoja.classList.remove("arrastrando");
    const y = desplazado();
    hoja.style.transform = "";
    // Un movimiento rápido decide; si no, gana el lado más cercano.
    const abrir = velocidad < -0.4 ? true : velocidad > 0.4 ? false : y < cerradaY() / 2;
    poner(abrir);
  };

  for (const el of [barra, agarre]) {
    if (!el) continue;
    el.addEventListener("pointerdown", bajar);
    el.addEventListener("pointermove", mover);
    el.addEventListener("pointerup", soltar);
    el.addEventListener("pointercancel", soltar);
  }

  barra.addEventListener("click", (e) => {
    if (movido) {
      movido = false;
      e.preventDefault();
      return;
    }
    poner(!hoja.classList.contains("open"));
  });

  // Cerrada, la hoja no se desplaza por dentro: deslizar hacia arriba la abre.
  hoja.addEventListener(
    "touchmove",
    (e) => {
      if (movil.matches && !hoja.classList.contains("open")) e.preventDefault();
    },
    { passive: false },
  );
}
