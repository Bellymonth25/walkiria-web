/** Serie de luces bajo la barra: cada foco se prende y apaga al azar. */
const COLORES = ["var(--bulb-a)", "var(--bulb-b)", "var(--bulb-c)"];
const SEPARACION = 24;

export function iniciarLuces(contenedor: HTMLElement): void {
  let focos: HTMLElement[] = [];

  const colgar = () => {
    const n = Math.ceil(window.innerWidth / SEPARACION) + 1;
    if (n === focos.length) return;
    contenedor.innerHTML = Array.from(
      { length: n },
      (_, i) => `<i style="left:${i * SEPARACION + 9}px;--c:${COLORES[i % COLORES.length]}"></i>`,
    ).join("");
    focos = [...contenedor.querySelectorAll<HTMLElement>("i")];
  };

  // Cada tanto, unos cuantos focos al azar cambian de prendido a apagado (o al revés).
  // Casi siempre se prenden de vuelta, para que la serie se vea encendida la mayor parte del tiempo.
  const parpadear = () => {
    if (!document.hidden) {
      const cambios = 1 + Math.floor(Math.random() * Math.max(2, focos.length / 8));
      for (let k = 0; k < cambios; k++) {
        const f = focos[Math.floor(Math.random() * focos.length)];
        if (!f) continue;
        if (f.classList.contains("off")) f.classList.remove("off");
        else if (Math.random() < 0.55) f.classList.add("off");
      }
    }
    window.setTimeout(parpadear, 220 + Math.random() * 480);
  };

  colgar();
  window.addEventListener("resize", colgar);
  parpadear();
}
