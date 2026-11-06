/** Nieve ligera en un canvas. Se apaga con prefers-reduced-motion y con el botón del pie de página. */
interface Copo {
  x: number;
  y: number;
  r: number;
  vy: number;
  fase: number;
  a: number;
}

const CLAVE = "walkiria-nieve";

export function iniciarNieve(canvas: HTMLCanvasElement, boton: HTMLButtonElement): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const reducir = window.matchMedia("(prefers-reduced-motion: reduce)");
  let encendida = leer() && !reducir.matches;
  let copos: Copo[] = [];
  let raf = 0;
  let ultimo = 0;

  const ajustar = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = window.innerWidth * dpr;
    canvas.height = window.innerHeight * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const n = Math.round(Math.min(70, (window.innerWidth * window.innerHeight) / 22000));
    copos = Array.from({ length: n }, () => nuevo(true));
  };

  const nuevo = (cualquierAltura: boolean): Copo => ({
    x: Math.random() * window.innerWidth,
    y: cualquierAltura ? Math.random() * window.innerHeight : -6,
    r: 1 + Math.random() * 2.2,
    vy: 18 + Math.random() * 30,
    fase: Math.random() * Math.PI * 2,
    a: 0.35 + Math.random() * 0.45,
  });

  const cuadro = (t: number) => {
    const dt = Math.min(0.05, (t - (ultimo || t)) / 1000);
    ultimo = t;
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    for (const c of copos) {
      c.y += c.vy * dt;
      c.fase += dt * 0.8;
      c.x += Math.sin(c.fase) * 12 * dt;
      if (c.y > window.innerHeight + 6) Object.assign(c, nuevo(false));
      ctx.beginPath();
      ctx.arc(c.x, c.y, c.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(214,222,236,${c.a})`;
      ctx.fill();
    }
    raf = requestAnimationFrame(cuadro);
  };

  const aplicar = () => {
    cancelAnimationFrame(raf);
    ultimo = 0;
    canvas.hidden = !encendida;
    boton.setAttribute("aria-pressed", String(encendida));
    boton.textContent = encendida ? "Nieve: encendida" : "Nieve: apagada";
    if (encendida && !document.hidden) {
      ajustar();
      raf = requestAnimationFrame(cuadro);
    } else {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  };

  boton.addEventListener("click", () => {
    encendida = !encendida;
    guardar(encendida);
    aplicar();
  });
  window.addEventListener("resize", () => encendida && ajustar());
  document.addEventListener("visibilitychange", aplicar);
  reducir.addEventListener("change", () => {
    if (reducir.matches) encendida = false;
    aplicar();
  });
  aplicar();
}

function leer(): boolean {
  try {
    return localStorage.getItem(CLAVE) !== "0";
  } catch {
    return true;
  }
}

function guardar(v: boolean): void {
  try {
    localStorage.setItem(CLAVE, v ? "1" : "0");
  } catch {
    /* sin almacenamiento: solo dura esta visita */
  }
}
