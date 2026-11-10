// Fondo de la portada: los videos de cenas navideñas pasan uno tras otro, en orden al azar,
// con un fundido entre cada uno. Se pausan cuando la portada no se ve.
const videos = [1, 2, 3, 4].map((n) => `${import.meta.env.BASE_URL}video/cena-${n}.mp4`);

function siguienteAlAzar(anterior: string | null): string {
  const opciones = videos.filter((v) => v !== anterior);
  return opciones[Math.floor(Math.random() * opciones.length)] ?? videos[0]!;
}

export function iniciarFondoVideo(): void {
  const caja = document.querySelector<HTMLElement>(".hero-fondo");
  if (!caja) return;
  caja.style.backgroundImage = `url("${import.meta.env.BASE_URL}video/cena-poster.jpg")`;

  const sinMovimiento = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const ahorroDatos = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData;
  if (sinMovimiento || ahorroDatos) return;

  const [a, b] = [...caja.querySelectorAll("video")];
  if (!a || !b) return;
  let actual = a;
  let otro = b;
  let fuente: string | null = null;
  let preparado = false;
  let visible = true;

  const reproducir = (v: HTMLVideoElement) => v.play().catch(() => {});

  const preparar = () => {
    if (preparado) return;
    preparado = true;
    fuente = siguienteAlAzar(fuente);
    otro.src = fuente;
    otro.preload = "auto";
    otro.load();
  };

  const cambiar = () => {
    if (!preparado) preparar();
    const entra = otro;
    const sale = actual;
    entra.currentTime = 0;
    reproducir(entra);
    entra.classList.add("activo");
    sale.classList.remove("activo");
    setTimeout(() => sale.pause(), 1400);
    actual = entra;
    otro = sale;
    preparado = false;
  };

  for (const v of [a, b]) {
    v.muted = true;
    v.addEventListener("timeupdate", () => {
      if (v !== actual || !v.duration) return;
      const falta = v.duration - v.currentTime;
      if (falta < 4) preparar();
      if (falta < 1.2) cambiar();
    });
    v.addEventListener("ended", () => v === actual && cambiar());
  }

  fuente = siguienteAlAzar(null);
  a.src = fuente;
  a.preload = "auto";
  a.addEventListener("playing", () => a.classList.add("activo"), { once: true });
  reproducir(a);

  // Solo se reproduce mientras la portada está en pantalla y la pestaña abierta.
  const segun = () => (visible && !document.hidden ? reproducir(actual) : actual.pause());
  if ("IntersectionObserver" in window) {
    new IntersectionObserver((entradas) => {
      visible = entradas.some((e) => e.isIntersecting);
      segun();
    }).observe(caja);
  }
  document.addEventListener("visibilitychange", segun);
}
