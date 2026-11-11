import { escapar } from "../lib/formato";

export interface Pregunta {
  titulo: string;
  texto: string;
  /** Texto del botón que confirma. */
  si: string;
  /** Texto del botón que cancela. */
  no?: string;
  /** Pinta el botón de confirmar en rojo (para quitar o borrar). */
  peligro?: boolean;
}

/**
 * Diálogo propio de la página para confirmar algo (en lugar del confirm() del navegador).
 * Regresa true si el cliente confirma; false si cancela, pica afuera o presiona Esc.
 * En celular sale desde abajo, como hoja.
 */
export function confirmar(p: Pregunta): Promise<boolean> {
  const d = document.createElement("dialog");
  d.className = "confirma";
  d.setAttribute("aria-labelledby", "confirmaTitulo");
  d.setAttribute("aria-describedby", "confirmaTexto");
  d.innerHTML = `
    <div class="confirma-ico${p.peligro ? " peligro" : ""}" aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14M10 11v6M14 11v6"/></svg>
    </div>
    <h2 id="confirmaTitulo">${escapar(p.titulo)}</h2>
    <p id="confirmaTexto">${escapar(p.texto)}</p>
    <div class="confirma-btns">
      <button type="button" class="btn confirma-no" value="no">${escapar(p.no ?? "Cancelar")}</button>
      <button type="button" class="btn ${p.peligro ? "btn-red" : "btn-gold"} confirma-si" value="si">${escapar(p.si)}</button>
    </div>`;
  document.body.append(d);

  return new Promise((resolver) => {
    let respuesta = false;
    const cerrar = (si: boolean) => {
      respuesta = si;
      d.classList.add("saliendo");
      window.setTimeout(() => d.close(), 160);
    };
    d.addEventListener("click", (e) => {
      const b = (e.target as Element).closest<HTMLButtonElement>("button");
      if (b) cerrar(b.value === "si");
      else if (e.target === d) cerrar(false); // clic en el fondo
    });
    d.addEventListener("cancel", (e) => {
      e.preventDefault();
      cerrar(false);
    });
    d.addEventListener("close", () => {
      d.remove();
      resolver(respuesta);
    });
    d.showModal();
    d.querySelector<HTMLButtonElement>(".confirma-no")!.focus();
  });
}
