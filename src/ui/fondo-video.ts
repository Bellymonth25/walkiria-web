// Fondo de la portada: los videos de cenas navideñas pasan uno tras otro, con un fundido entre cada uno.
// La lista se baraja una vez al abrir la página y se recorre en ese orden: ninguno se repite hasta que
// han pasado todos. Se pausan cuando la portada no se ve.
const videos = [1, 3, 4, 5, 6].map((n) => `${import.meta.env.BASE_URL}video/cena-${n}.mp4`);

/** Baraja la lista (Fisher-Yates). */
function barajar<T>(lista: T[]): T[] {
  const r = [...lista];
  for (let i = r.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [r[i], r[j]] = [r[j]!, r[i]!];
  }
  return r;
}

// Cola de reproducción: se recorre en orden y, al terminar, se vuelve a barajar
// cuidando que el primero de la nueva ronda no sea el último que acaba de pasar.
let cola: string[] = [];
function siguienteVideo(): string {
  if (!cola.length) {
    const ultimo = anterior;
    cola = barajar(videos);
    if (ultimo && cola[0] === ultimo && cola.length > 1) cola.push(cola.shift()!);
  }
  anterior = cola.shift()!;
  return anterior;
}
let anterior: string | null = null;

export function iniciarFondoVideo(): void {
  const caja = document.querySelector<HTMLElement>(".hero-fondo");
  if (!caja) return;
  caja.style.backgroundImage = `url("${import.meta.env.BASE_URL}video/cena-poster.jpg")`;

  // Los videos corren aunque la computadora tenga desactivadas las animaciones
  // (Windows y Chrome lo piden así a menudo sin que el visitante lo sepa). Solo se omiten con ahorro de datos.
  const ahorroDatos = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData;
  if (ahorroDatos) return;

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
    fuente = siguienteVideo();
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
    // El que entra se funde ENCIMA del que sale; el de abajo sigue visible hasta el final,
    // así nunca se asoma el rojo del fondo a medio cambio.
    sale.classList.remove("arriba");
    entra.classList.add("activo", "arriba");
    setTimeout(() => {
      sale.classList.remove("activo");
      sale.pause();
    }, 1400);
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

  fuente = siguienteVideo();
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
