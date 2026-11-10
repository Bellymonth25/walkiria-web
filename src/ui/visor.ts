/**
 * Visor de imágenes en grande: se abre encima de la página (se ve el fondo), con zoom al tocar,
 * flechas cuando hay varias imágenes y cierre al picar fuera.
 */
export interface Lamina {
  titulo: string;
  alt: string;
  /** Imagen que se muestra al abrir. Sin ella se ve un recuadro de "foto próximamente". */
  media?: string;
  /** Versión de más resolución, que solo se descarga al acercar. */
  grande?: string;
  /** Imagen alargada: se ajusta al ancho y se recorre con scroll. */
  alta?: boolean;
  descargas?: ReadonlyArray<{ texto: string; href: string; archivo: string }>;
}

export interface Visor {
  abrir(laminas: readonly Lamina[], indice?: number): void;
}

export function iniciarVisor(): Visor {
  const q = <T extends HTMLElement>(sel: string) => document.querySelector<T>(sel)!;
  const visor = q<HTMLDialogElement>("#visor");
  const img = q<HTMLImageElement>("#visorImg");
  const vacio = q("#visorVacio");
  const lienzo = q("#visorLienzo");
  const titulo = q("#visorTitulo");
  const descargas = q("#visorDescargas");
  const ayuda = q("#visorAyuda");
  const ant = q<HTMLButtonElement>("#visorAnt");
  const sig = q<HTMLButtonElement>("#visorSig");

  let laminas: readonly Lamina[] = [];
  let i = 0;

  const mostrar = (n: number) => {
    i = (n + laminas.length) % laminas.length;
    const l = laminas[i]!;
    lienzo.classList.remove("zoom");
    lienzo.classList.toggle("alta", !!l.alta);
    lienzo.scrollTo(0, 0);
    titulo.textContent = laminas.length > 1 ? `${l.titulo} · ${i + 1} de ${laminas.length}` : l.titulo;
    img.hidden = !l.media;
    vacio.hidden = !!l.media;
    if (l.media) {
      img.src = l.media;
      img.alt = l.alt;
    } else {
      vacio.textContent = `Pronto: foto de ${l.titulo}`;
    }
    ayuda.textContent = !l.media
      ? "Usa las flechas para ver las demás fotos."
      : laminas.length > 1
        ? "Toca la imagen para acercar. Cambia de foto con las flechas."
        : "Toca la imagen para acercar o alejar.";
    descargas.replaceChildren(
      ...(l.descargas ?? []).map((d, n) => {
        const a = document.createElement("a");
        a.className = `btn btn-sm ${n === 0 ? "btn-gold" : "btn-ghost"}`;
        a.href = d.href;
        a.download = d.archivo;
        a.textContent = d.texto;
        return a;
      }),
    );
  };

  q("#visorCerrar").addEventListener("click", () => visor.close());
  ant.addEventListener("click", () => mostrar(i - 1));
  sig.addEventListener("click", () => mostrar(i + 1));
  visor.addEventListener("keydown", (e) => {
    if (laminas.length < 2) return;
    if (e.key === "ArrowLeft") mostrar(i - 1);
    else if (e.key === "ArrowRight") mostrar(i + 1);
  });
  // Picar fuera del visor (en el fondo oscuro) o en el espacio vacío junto a la imagen lo cierra.
  visor.addEventListener("click", (e) => {
    if (e.target === visor || e.target === lienzo) visor.close();
  });

  // Tocar acerca al punto tocado; volver a tocar aleja.
  img.addEventListener("click", (e) => {
    const l = laminas[i]!;
    const r = img.getBoundingClientRect();
    const fx = (e.clientX - r.left) / r.width;
    const fy = (e.clientY - r.top) / r.height;
    const acercar = lienzo.classList.toggle("zoom");
    if (acercar && l.grande && !img.src.endsWith(l.grande)) img.src = l.grande;
    if (acercar) {
      lienzo.scrollLeft = fx * img.offsetWidth - lienzo.clientWidth / 2;
      lienzo.scrollTop = fy * img.offsetHeight - lienzo.clientHeight / 2;
    } else {
      lienzo.scrollTo(0, 0);
    }
  });

  return {
    abrir(nuevas, indice = 0) {
      if (!nuevas.length) return;
      laminas = nuevas;
      ant.hidden = sig.hidden = laminas.length < 2;
      mostrar(indice);
      visor.showModal();
    },
  };
}
