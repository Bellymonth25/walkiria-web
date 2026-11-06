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

interface Grande {
  x: number;
  y: number;
  r: number;
  vy: number;
  fase: number;
  giro: number;
  vg: number;
  a: number;
}

function nuevoGrande(): Grande {
  return {
    x: 30 + Math.random() * (window.innerWidth - 60),
    y: -30,
    r: 9 + Math.random() * 7,
    vy: 22 + Math.random() * 14,
    fase: Math.random() * Math.PI * 2,
    giro: Math.random() * Math.PI,
    vg: (Math.random() - 0.5) * 0.8,
    a: 0.55 + Math.random() * 0.3,
  };
}

/** Copo de seis brazos con ramitas. */
function dibujarCopo(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, giro: number, a: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(giro);
  ctx.strokeStyle = `rgba(214,222,236,${a})`;
  ctx.lineWidth = Math.max(1.2, r / 8);
  ctx.lineCap = "round";
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    ctx.moveTo(0, 0);
    ctx.lineTo(0, -r);
    for (const k of [0.45, 0.72]) {
      const largo = r * (k === 0.45 ? 0.32 : 0.24);
      ctx.moveTo(0, -r * k);
      ctx.lineTo(-largo, -r * k - largo);
      ctx.moveTo(0, -r * k);
      ctx.lineTo(largo, -r * k - largo);
    }
    ctx.rotate(Math.PI / 3);
  }
  ctx.stroke();
  ctx.restore();
}

export function iniciarNieve(canvas: HTMLCanvasElement, boton: HTMLButtonElement): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const reducir = window.matchMedia("(prefers-reduced-motion: reduce)");
  let encendida = leer() && !reducir.matches;
  let copos: Copo[] = [];
  let raf = 0;
  let ultimo = 0;
  let grandes: Grande[] = [];
  let proximoGrande = 0;

  const ajustar = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = window.innerWidth * dpr;
    canvas.height = window.innerHeight * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // ~10% más que la primera versión
    const n = Math.round(Math.min(77, (window.innerWidth * window.innerHeight) / 20000));
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
    // De vez en cuando, un copo grande que cae girando (máximo 2 a la vez).
    if (t > proximoGrande && grandes.length < 2) {
      grandes.push(nuevoGrande());
      proximoGrande = t + 7000 + Math.random() * 9000;
    }
    grandes = grandes.filter((g) => g.y < window.innerHeight + 40);
    for (const g of grandes) {
      g.y += g.vy * dt;
      g.fase += dt * 0.6;
      g.giro += g.vg * dt;
      dibujarCopo(ctx, g.x + Math.sin(g.fase) * 18, g.y, g.r, g.giro, g.a);
    }
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
    grandes = [];
    proximoGrande = performance.now() + 2500;
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
