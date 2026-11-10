/** Volante: vista en grande a pantalla completa, con zoom al tocar. */
export function iniciarVolante(urlGrande: string): void {
  const visor = document.querySelector<HTMLDialogElement>("#visor");
  const img = document.querySelector<HTMLImageElement>("#visorImg");
  const lienzo = document.querySelector<HTMLElement>("#visorLienzo");
  if (!visor || !img || !lienzo) return;

  const abrir = () => {
    if (!img.src) img.src = urlGrande; // La imagen grande solo se descarga si la piden.
    lienzo.classList.remove("zoom");
    visor.showModal();
  };
  document.querySelector("#volanteVer")?.addEventListener("click", abrir);
  document.querySelector("#volanteMini")?.addEventListener("click", abrir);
  document.querySelector("#visorCerrar")?.addEventListener("click", () => visor.close());

  // Tocar acerca al punto tocado; volver a tocar aleja.
  img.addEventListener("click", (e) => {
    const r = img.getBoundingClientRect();
    const fx = (e.clientX - r.left) / r.width;
    const fy = (e.clientY - r.top) / r.height;
    const acercar = !lienzo.classList.contains("zoom");
    lienzo.classList.toggle("zoom", acercar);
    if (acercar) {
      lienzo.scrollLeft = fx * img.offsetWidth - lienzo.clientWidth / 2;
      lienzo.scrollTop = fy * img.offsetHeight - lienzo.clientHeight / 2;
    } else {
      lienzo.scrollTo(0, 0);
    }
  });
  // Clic fuera de la imagen (en el fondo) también cierra.
  lienzo.addEventListener("click", (e) => {
    if (e.target === lienzo) visor.close();
  });
}
