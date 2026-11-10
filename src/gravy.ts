import "./styles.css";
import "./gravy.css";
import { negocio } from "./data/temporada";
import { enlaceWhatsApp } from "./lib/pedido";
import { iniciarComun } from "./comun";
import { iniciarVisor } from "./ui/visor";

/** Guion de la explicación. Los textos salen del instructivo impreso. */
interface Paso {
  titulo: string;
  texto: string;
  datos?: [string, string][];
  /** Segundos que dura en pantalla cuando avanza sola. */
  dura: number;
}

const PASOS: Paso[] = [
  {
    titulo: "¡Hola!",
    texto: "Te explico cómo preparar tu gravy. Viene concentrado, así que primero hay que diluirlo.",
    dura: 6,
  },
  {
    titulo: "Paso 1 · Diluye el gravy",
    texto: "Mézclalo mitad y mitad con jugo de naranja o naranjada. Debe quedar un poco espeso.",
    datos: [
      ["¿Prefieres un sabor seco?", "Usa vino blanco en lugar de naranjada."],
      ["¿No tienes jugo ni vino?", "Usa agua natural."],
    ],
    dura: 10,
  },
  {
    titulo: "Paso 2 · Baña tu carne",
    texto: "Ponla en una charola honda y báñala con suficiente gravy.",
    datos: [["Si es un pavo", "Mételo con todo y su funda, con la pechuga hacia abajo."]],
    dura: 9,
  },
  {
    titulo: "Paso 3 · Al horno",
    texto: "Precalienta el horno al máximo durante 15 minutos. Después bájalo a 200 °C y mete la charola cubierta con papel aluminio.",
    dura: 9,
  },
  {
    titulo: "¿Cuánto tiempo?",
    texto: "Depende de lo que vayas a calentar. A la mitad, voltéalo y báñalo otra vez con gravy.",
    datos: [
      ["Pavo de menos de 7 kg", "35 minutos, voltear y bañar, y otros 35 minutos."],
      ["Pavo de más de 7 kg", "45 minutos, voltear y bañar, y otros 45 minutos."],
      ["Lomo o costilla en trozo", "1 hora, volteando cada 30 minutos."],
      ["Lomo o costilla rebanado", "20 minutos."],
    ],
    dura: 14,
  },
  {
    titulo: "¡Tu cena está lista!",
    texto: "Al servir, baña otra vez la carne con una cucharada de gravy: conserva su sabor hasta el último bocado.",
    datos: [
      ["Si tu carne es adobada", "Diluye con jugo de naranja o naranjada, resalta más su sabor."],
      ["Experimenta", "El gravy también va muy bien con la pasta, el pan, los romeritos o la ensalada de manzana."],
    ],
    dura: 12,
  },
];

const $ = <T extends HTMLElement>(sel: string) => document.querySelector<T>(sel)!;

/** El árbol de Navidad crece hasta el borde de arriba de la escena, sea cual sea el tamaño de la pantalla. */
function ajustarArbol(): void {
  const arbol = document.getElementById("arbol");
  const svg = arbol?.closest("svg");
  const escena = svg?.parentElement;
  if (!arbol || !svg || !escena) return;
  const ajustar = () => {
    const r = svg.getBoundingClientRect();
    if (!r.width) return;
    const escala = r.width / 640;
    // Espacio visible arriba del dibujo (en compu la escena es más alta que el dibujo).
    const hueco = Math.max(0, (r.top - escena.getBoundingClientRect().top) / escala);
    const arriba = 4 - hueco;
    const sy = (304 - arriba) / 272;
    const sx = Math.min(1.55, sy * 1.3);
    arbol.setAttribute("transform", `translate(${(535 - sx * 578).toFixed(1)} ${(arriba - sy * 30).toFixed(1)}) scale(${sx.toFixed(3)} ${sy.toFixed(3)})`);
  };
  ajustar();
  if ("ResizeObserver" in window) new ResizeObserver(ajustar).observe(escena);
  else addEventListener("resize", ajustar);
}

function iniciarExplicacion(): void {
  const caja = $("#expl");
  const paso = $("#explPaso");
  const texto = $("#explTexto");
  const datos = $("#explDatos");
  const puntos = $("#explPuntos");
  const pausa = $<HTMLButtonElement>("#explPausa");

  const verBtn = $<HTMLButtonElement>("#explVer");
  let actual = 0;
  let corriendo = false;
  let reloj = 0;

  puntos.innerHTML = PASOS.map(
    (p, i) => `<button type="button" data-ir="${i}" aria-label="${i + 1}. ${p.titulo}"></button>`,
  ).join("");

  const programar = () => {
    window.clearTimeout(reloj);
    caja.style.setProperty("--dura", `${PASOS[actual]!.dura}s`);
    if (!corriendo) return;
    reloj = window.setTimeout(() => {
      if (actual < PASOS.length - 1) ir(actual + 1);
      else terminar();
    }, PASOS[actual]!.dura * 1000);
  };

  const poner = (v: boolean) => {
    corriendo = v;
    caja.dataset.estado = v ? "corriendo" : "pausa";
    pausa.textContent = v ? "❚❚" : "▶";
    pausa.setAttribute("aria-label", v ? "Pausar" : "Reproducir");
    programar();
  };

  // Al acabar el último paso aparece el botón para verla otra vez.
  const terminar = () => {
    poner(false);
    caja.dataset.estado = "fin";
    verBtn.lastChild!.textContent = " Ver explicación de nuevo";
  };

  function ir(i: number): void {
    actual = Math.max(0, Math.min(PASOS.length - 1, i));
    if (caja.dataset.estado === "fin") caja.dataset.estado = "pausa";
    const p = PASOS[actual]!;
    caja.dataset.paso = String(actual);
    paso.textContent = p.titulo;
    texto.textContent = p.texto;
    datos.hidden = !p.datos;
    datos.replaceChildren(
      ...(p.datos ?? []).map(([a, b]) => {
        const li = document.createElement("li");
        const fuerte = document.createElement("b");
        fuerte.textContent = a;
        li.append(fuerte, ` ${b}`);
        return li;
      }),
    );
    puntos.querySelectorAll("button").forEach((b, n) => b.setAttribute("aria-current", String(n === actual)));
    programar();
  }

  verBtn.addEventListener("click", () => {
    ir(0);
    // Avanza sola aunque el sistema tenga "reducir movimiento": el cliente pidió ver la explicación.
    poner(true);
  });
  pausa.addEventListener("click", () => {
    if (!corriendo && actual === PASOS.length - 1) ir(0);
    poner(!corriendo);
  });
  $("#explAnt").addEventListener("click", () => ir(actual - 1));
  $("#explSig").addEventListener("click", () => ir(actual + 1));
  puntos.addEventListener("click", (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>("[data-ir]");
    if (b) ir(Number(b.dataset.ir));
  });
  // Si cambian de pestaña, no se sigue pasando sola.
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && corriendo) poner(false);
  });

  // Portada: el pavo saluda con el primer texto.
  paso.textContent = PASOS[0]!.titulo;
  texto.textContent = "Soy el pavo de La Walkiria. Toca «Ver explicación» y te enseño cómo preparar tu gravy, paso a paso.";
}

/** Instructivo en grande: la versión alargada, que en pantalla se lee mejor que la de tamaño carta. */
function iniciarInstructivo(): void {
  const visor = iniciarVisor();
  const base = `${import.meta.env.BASE_URL}gravy/`;
  const abrir = () =>
    visor.abrir([
      {
        titulo: "Instructivo del gravy",
        alt: "Instrucciones para su gravy",
        media: `${base}instructivo-celular-2400.webp`,
        alta: true,
        descargas: [
          { texto: "Descargar PDF", href: `${base}instructivo-gravy-celular.pdf`, archivo: "Instructivo gravy La Walkiria.pdf" },
          { texto: "Para imprimir", href: `${base}instructivo-gravy-carta.pdf`, archivo: "Instructivo gravy La Walkiria (carta).pdf" },
        ],
      },
    ]);
  $("#instVer").addEventListener("click", abrir);
  $("#instMini").addEventListener("click", abrir);
}

iniciarComun();
$<HTMLAnchorElement>("#topWa").href = enlaceWhatsApp(negocio.whatsapp, "Hola, tengo una duda sobre cómo preparar el gravy.");
iniciarExplicacion();
ajustarArbol();
iniciarInstructivo();
