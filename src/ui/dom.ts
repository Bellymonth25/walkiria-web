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
export function aviso(texto: string): void {
  const el = $("#toast");
  el.textContent = texto;
  el.hidden = false;
  window.clearTimeout(temporizador);
  temporizador = window.setTimeout(() => (el.hidden = true), 2200);
}
