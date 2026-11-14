/**
 * Visor de imágenes en grande: se abre encima de la página (se ve el fondo), con botones de zoom
 * (− / + / ajustar), la manita para mover la imagen ya acercada, flechas cuando hay varias imágenes
 * y cierre al picar fuera.
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

  // ---------- Zoom con botones ----------
  const NIVELES = [1, 1.5, 2, 3, 4];
  let nivel = 0;
  let anchoBase = 0;
  const zoom = document.createElement("div");
  zoom.className = "visor-zoom";
  zoom.setAttribute("role", "group");
  zoom.setAttribute("aria-label", "Zoom");
  zoom.innerHTML = `<button type="button" data-z="-1" aria-label="Alejar">−</button>
    <output aria-live="polite">100%</output>
    <button type="button" data-z="1" aria-label="Acercar">+</button>
    <button type="button" data-z="0" aria-label="Ajustar a la pantalla"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg></button>`;
  visor.append(zoom);
  const porcentaje = zoom.querySelector("output")!;
  const [menos, mas, ajustar] = [...zoom.querySelectorAll<HTMLButtonElement>("button")] as [HTMLButtonElement, HTMLButtonElement, HTMLButtonElement];
  img.draggable = false;

  // ---------- Indicador de carga: se ve mientras baja la foto ----------
  const cargando = document.createElement("div");
  cargando.className = "visor-cargando";
  cargando.setAttribute("role", "status");
  cargando.innerHTML = `<span class="visor-spinner" aria-hidden="true"></span><span class="visor-cargando-txt">Cargando foto…</span>`;
  cargando.hidden = true;
  visor.append(cargando);
  const terminarCarga = () => {
    cargando.hidden = true;
    visor.classList.remove("cargando");
  };
  img.addEventListener("load", terminarCarga);
  img.addEventListener("error", () => {
    terminarCarga();
    ayuda.textContent = "No se pudo cargar la foto. Revisa tu conexión e inténtalo de nuevo.";
  });
  /** Cambia la foto y muestra el indicador hasta que termine de bajar (si ya estaba en caché no parpadea). */
  const cargarImagen = (src: string) => {
    if (img.src.endsWith(src) && img.complete && img.naturalWidth > 0) return;
    cargando.hidden = false;
    visor.classList.add("cargando");
    img.src = src;
    if (img.complete && img.naturalWidth > 0) terminarCarga();
  };

  /** Cambia el zoom manteniendo el mismo punto al centro de la pantalla. */
  const ponerZoom = (n: number) => {
    const l = laminas[i];
    if (!l?.media) return;
    if (nivel === 0) anchoBase = img.getBoundingClientRect().width;
    const centroX = (lienzo.scrollLeft + lienzo.clientWidth / 2) / Math.max(1, lienzo.scrollWidth);
    const centroY = (lienzo.scrollTop + lienzo.clientHeight / 2) / Math.max(1, lienzo.scrollHeight);
    nivel = Math.max(0, Math.min(NIVELES.length - 1, n));
    const factor = NIVELES[nivel]!;
    if (nivel > 0 && l.grande && !img.src.endsWith(l.grande)) cargarImagen(l.grande);
    lienzo.classList.toggle("zoom", nivel > 0);
    img.style.width = nivel > 0 ? `${Math.round(anchoBase * factor)}px` : "";
    porcentaje.textContent = `${Math.round(factor * 100)}%`;
    menos.disabled = ajustar.disabled = nivel === 0;
    mas.disabled = nivel === NIVELES.length - 1;
    if (nivel > 0) {
      lienzo.scrollLeft = centroX * lienzo.scrollWidth - lienzo.clientWidth / 2;
      lienzo.scrollTop = centroY * lienzo.scrollHeight - lienzo.clientHeight / 2;
    } else lienzo.scrollTo(0, 0);
  };
  zoom.addEventListener("click", (e) => {
    const b = (e.target as Element).closest<HTMLButtonElement>("button");
    if (!b) return;
    const z = Number(b.dataset.z);
    ponerZoom(z === 0 ? 0 : nivel + z);
  });

  // ---------- La manita: arrastrar para mover la imagen acercada (con el dedo se usa el scroll normal) ----------
  let arrastre: { x: number; y: number; sl: number; st: number; movio: boolean } | null = null;
  let ignorarClic = false;
  lienzo.addEventListener("pointerdown", (e) => {
    if (nivel === 0 || e.pointerType === "touch" || e.button !== 0) return;
    arrastre = { x: e.clientX, y: e.clientY, sl: lienzo.scrollLeft, st: lienzo.scrollTop, movio: false };
    lienzo.setPointerCapture(e.pointerId);
    lienzo.classList.add("arrastrando");
  });
  lienzo.addEventListener("pointermove", (e) => {
    if (!arrastre) return;
    const dx = e.clientX - arrastre.x;
    const dy = e.clientY - arrastre.y;
    if (Math.abs(dx) + Math.abs(dy) > 4) arrastre.movio = true;
    lienzo.scrollLeft = arrastre.sl - dx;
    lienzo.scrollTop = arrastre.st - dy;
  });
  const soltar = () => {
    if (!arrastre) return;
    ignorarClic = arrastre.movio;
    arrastre = null;
    lienzo.classList.remove("arrastrando");
  };
  lienzo.addEventListener("pointerup", soltar);
  lienzo.addEventListener("pointercancel", soltar);

  const mostrar = (n: number) => {
    i = (n + laminas.length) % laminas.length;
    const l = laminas[i]!;
    nivel = 0;
    lienzo.classList.remove("zoom");
    img.style.width = "";
    lienzo.classList.toggle("alta", !!l.alta);
    lienzo.scrollTo(0, 0);
    titulo.textContent = laminas.length > 1 ? `${l.titulo} · ${i + 1} de ${laminas.length}` : l.titulo;
    img.hidden = !l.media;
    vacio.hidden = !!l.media;
    if (l.media) {
      img.alt = l.alt;
      cargarImagen(l.media);
    } else {
      terminarCarga();
      vacio.textContent = `Pronto: foto de ${l.titulo}`;
    }
    zoom.hidden = !l.media;
    porcentaje.textContent = "100%";
    menos.disabled = ajustar.disabled = true;
    mas.disabled = false;
    ayuda.textContent = !l.media
      ? "Usa las flechas para ver las demás fotos."
      : laminas.length > 1
        ? "Acerca con + y mueve la imagen arrastrándola. Cambia de foto con las flechas."
        : "Acerca con + y mueve la imagen arrastrándola.";
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
    if (e.key === "+" || e.key === "=") return ponerZoom(nivel + 1);
    if (e.key === "-") return ponerZoom(nivel - 1);
    if (laminas.length < 2) return;
    if (e.key === "ArrowLeft") mostrar(i - 1);
    else if (e.key === "ArrowRight") mostrar(i + 1);
  });
  // Picar fuera del visor (en el fondo oscuro) o en el espacio vacío junto a la imagen lo cierra.
  visor.addEventListener("click", (e) => {
    if (ignorarClic) {
      ignorarClic = false;
      return;
    }
    if (e.target === visor || e.target === lienzo) visor.close();
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
