/**
 * Analítica con Microsoft Clarity: grabaciones de sesión, mapas de calor y algunos eventos con nombre.
 * Solo se carga en la página publicada (no en `npm run dev`) y solo si hay un ID de proyecto.
 * Si Clarity no carga (bloqueador, sin red), la página funciona igual: `evento` no hace nada.
 */

/**
 * ID del proyecto en clarity.microsoft.com → Settings → Overview → "Project ID".
 * No es secreto: va en el código de la página. Vacío = Clarity no se carga.
 */
export const CLARITY_ID = "zg68gw9z0h";

/** Eventos que se ven en Clarity (filtros, embudos y grabaciones). */
export type Evento =
  | "producto_agregado"
  | "calculadora_usada"
  | "foto_abierta"
  | "pedido_whatsapp"
  | "whatsapp_dudas";

type Clarity = ((...args: unknown[]) => void) & { q?: unknown[][] };

declare global {
  interface Window {
    clarity?: Clarity;
  }
}

/** Carga Clarity sin frenar la página. Llamar una vez por página. */
export function iniciarAnalitica(id: string = CLARITY_ID, activa: boolean = import.meta.env.PROD): void {
  if (!id || !activa || window.clarity) return;
  // La cola guarda los eventos que pasen antes de que termine de bajar el script.
  const cola: Clarity = (...args: unknown[]) => {
    (cola.q ??= []).push(args);
  };
  window.clarity = cola;
  const s = document.createElement("script");
  s.async = true;
  s.src = `https://www.clarity.ms/tag/${encodeURIComponent(id)}`;
  document.head.appendChild(s);
}

/** Anota un evento con nombre. Sin Clarity no hace nada. */
export function evento(nombre: Evento): void {
  try {
    window.clarity?.("event", nombre);
  } catch {
    // La analítica nunca debe romper la página.
  }
}

/**
 * Cualquier botón de WhatsApp que no sea "Enviar pedido" cuenta como "whatsapp_dudas"
 * (encabezado, contacto, otra zona, disponibilidad, gravy).
 */
export function escucharWhatsAppDudas(): void {
  document.addEventListener("click", (e) => {
    const a = (e.target as Element | null)?.closest?.<HTMLAnchorElement>('a[href^="https://wa.me/"]');
    if (a && a.id !== "send") evento("whatsapp_dudas");
  });
}
