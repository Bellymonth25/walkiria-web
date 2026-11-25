/** querySelector que falla en desarrollo si el elemento no existe (evita errores silenciosos). */
export function $<T extends Element = HTMLElement>(sel: string, root: ParentNode = document): T {
  const el = root.querySelector<T>(sel);
  if (!el) throw new Error(`No existe el elemento ${sel}`);
  return el;
}

export function llenar(attr: string, valor: string): void {
  document.querySelectorAll<HTMLElement>(`[data-cfg="${attr}"]`).forEach((el) => (el.textContent = valor));
}

let temporizador: number | undefined;
/** Snackbar abajo de la pantalla: se lee completo y se va solo (o al tocarlo). */
export function aviso(texto: string): void {
  const el = $("#toast");
  el.hidden = true; // Reinicia la animación si ya había uno visible.
  el.textContent = texto;
  void el.offsetWidth;
  el.hidden = false;
  el.onclick = () => (el.hidden = true);
  window.clearTimeout(temporizador);
  // Más tiempo si el mensaje es largo, para alcanzar a leerlo.
  temporizador = window.setTimeout(() => (el.hidden = true), Math.min(7000, 2500 + texto.length * 40));
}
