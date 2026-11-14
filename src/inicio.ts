import { empaques, negocio, temporada } from "./data/temporada";
import { dinero } from "./lib/formato";
import { enlaceWhatsApp } from "./lib/pedido";
import { iniciarComun } from "./comun";
import { $ } from "./ui/dom";
import { iniciarVisor } from "./ui/visor";
import { iniciarFotos, pintarFotos } from "./ui/galeria";
import { iniciarCarrusel } from "./ui/carrusel";
import { fotosPlatillos } from "./data/galeria";
import { iniciarFondoVideo } from "./ui/fondo-video";
import { iniciarApariciones } from "./ui/aparecer";
import "./portadas.css";

// Medio árbol (24) y estrella de Belén (31) de fondo en la tarjeta, cortados por la orilla derecha.
const ICONO_ARBOL = `<svg class="day-ico arbol" viewBox="0 0 80 120" aria-hidden="true"><path d="M40 6c4 10 12 18 20 22-4 1-8 1-12 0 7 10 15 17 24 21-6 2-13 2-19 0 8 11 17 19 27 23-12 4-27 5-40 5s-28-1-40-5c10-4 19-12 27-23-6 2-13 2-19 0 9-4 17-11 24-21-4 1-8 1-12 0 8-4 16-12 20-22Z" fill="currentColor"/><rect x="34" y="78" width="12" height="16" rx="2" fill="currentColor"/><path d="m40 0 2.4 5 5.4.6-4 3.7 1.1 5.4L40 12l-4.9 2.7 1.1-5.4-4-3.7 5.4-.6Z" fill="currentColor"/></svg>`;
const ICONO_ESTRELLA = `<svg class="day-ico" viewBox="0 0 100 120" aria-hidden="true"><path d="M50 0Q54 56 90 60Q54 64 50 120Q46 64 10 60Q46 56 50 0Z" fill="currentColor"/><path d="M31 41 69 79M69 41 31 79" stroke="currentColor" stroke-width="3.5" stroke-linecap="round"/><circle cx="50" cy="60" r="6" fill="currentColor"/></svg>`;

iniciarComun();

$<HTMLAnchorElement>("#contactWa").href = enlaceWhatsApp(negocio.whatsapp, "Hola, quiero información de las cenas navideñas.");
const destino = encodeURIComponent(negocio.direccionMapas);
$<HTMLAnchorElement>("#goMaps").href = `https://www.google.com/maps/dir/?api=1&travelmode=driving&destination=${destino}`;
$<HTMLAnchorElement>("#goWaze").href = `https://waze.com/ul?navigate=yes&q=${destino}`;
$<HTMLIFrameElement>("#mapFrame").src = `https://www.google.com/maps?q=${destino}&output=embed`;

$("#zonesTable").innerHTML = temporada.zonas
  .map((z) => `<div class="zona"><div class="zona-top"><b>${z.nombre}</b><span class="num">${dinero(z.costo)}</span></div><small>${z.alcaldias.join(", ")}</small></div>`)
  .join("");
$<HTMLAnchorElement>("#zonaOtraWa").href = enlaceWhatsApp(negocio.whatsapp, "Hola, ¿hacen envíos a mi zona? Mi dirección es: ");

// Empaque con costo: mismo precio al vacío o en charola, según el tamaño.
const nombresTamano = { chica: "Chica", mediana: "Mediana", grande: "Grande" } as const;
$("#empaqueTabla").innerHTML = (Object.keys(nombresTamano) as (keyof typeof nombresTamano)[])
  .map((t) => `<tr><td><b>${nombresTamano[t]}</b><small>hasta ${empaques.capacidad[t]} kg</small></td><td>+${dinero(empaques.precio.charola[t])}</td></tr>`)
  .join("");

// Fechas: cada fiesta con el mismo semáforo del volante (2 días antes, 1 día antes, el mismo día).
const semaforo = {
  limite: { clase: "ok", chip: "Apartado", texto: (fiesta: string) => `Último día para apartar tu cena de ${fiesta}.` },
  sujeto: { clase: "mid", chip: "Sin garantía", texto: () => "Pedidos según disponibilidad." },
  tienda: {
    clase: "no hot",
    chip: "Solo en tienda",
    texto: () => "Recoge tu pedido en tienda. No hay envío a domicilio.",
  },
} as const;
const fiestas = [
  { para: "Navidad", dia: 24, icono: ICONO_ARBOL },
  { para: "Año Nuevo", dia: 31, icono: ICONO_ESTRELLA },
];
$("#cal").innerHTML = fiestas
  .map((f) => {
    const dias = temporada.diasEspeciales.filter((d) => d.dia > f.dia - 3 && d.dia <= f.dia);
    const tarjetas = dias
      .map((d) => {
        const s = semaforo[d.tipo];
        const icono = d.tipo === "tienda" ? f.icono : "";
        return `<div class="day ${s.clase}">${icono}<b class="num">${d.dia}</b><span class="mes">de diciembre</span><span class="chip">${s.chip}</span><small>${s.texto(f.para)}</small></div>`;
      })
      .join("");
    return `<div class="fiesta"><h3>${f.para}</h3><div class="fiesta-dias">${tarjetas}</div></div>`;
  })
  .join("");

// Galería: un carrusel que corre solo; al picar una foto se abre en grande.
const visor = iniciarVisor();
const pista = document.querySelector<HTMLElement>("#carrusel");
if (pista) {
  pintarFotos(pista, fotosPlatillos.filter((f) => f.carrusel !== false));
  iniciarCarrusel(pista.parentElement!, pista);
  iniciarFotos(visor, pista);
  // Al cerrar el visor el foco regresa a la foto; se suelta para que el carrusel siga corriendo.
  document.querySelector("#visor")?.addEventListener("close", () => {
    setTimeout(() => {
      const activo = document.activeElement;
      if (activo instanceof HTMLElement && pista.contains(activo)) activo.blur();
    });
  });
}

const base = `${import.meta.env.BASE_URL}volante/`;
/**
 * Versión del volante. Los archivos conservan su nombre, así que el navegador puede seguir mostrando
 * la imagen vieja que guardó. Al cambiar el volante, sube esta versión y la de index.html (?v=…).
 */
const VERSION_VOLANTE = "20261114c";
const archivoVolante = (nombre: string) => `${base}${nombre}?v=${VERSION_VOLANTE}`;
const abrirVolante = () =>
  visor.abrir([
    {
      titulo: `Menú ${temporada.anio}`,
      alt: `Volante Cenas de Fin de Año ${temporada.anio} de La Walkiria`,
      media: archivoVolante("volante-2600.webp"),
      grande: archivoVolante("volante-walkiria-2026.png"),
      descargas: [
        { texto: "Descargar PDF", href: archivoVolante("volante-walkiria-2026.pdf"), archivo: `Volante La Walkiria ${temporada.anio}.pdf` },
        { texto: "Imagen", href: archivoVolante("volante-walkiria-2026.png"), archivo: `Volante La Walkiria ${temporada.anio}.png` },
      ],
    },
  ]);
$("#volanteVer").addEventListener("click", abrirVolante);
$("#volanteMini").addEventListener("click", abrirVolante);

// Las secciones aparecen con una animación al bajar, solo la primera vez.
iniciarApariciones();
// ?mascara=1..4 en la dirección cambia qué tan rojo se ve el video, para compararlas.
const mascara = new URLSearchParams(location.search).get("mascara");
if (mascara && /^[1-4]$/.test(mascara)) document.querySelector<HTMLElement>(".hero")?.setAttribute("data-mascara", mascara);
iniciarFondoVideo();

// La barra de arriba es transparente sobre la portada y se vuelve sólida (con logo) al bajar.
const barra = document.querySelector<HTMLElement>("header.top-video");
const portadaEl = document.querySelector<HTMLElement>(".hero");
if (barra && portadaEl) {
  let pendiente = false;
  const revisar = () => {
    pendiente = false;
    barra.classList.toggle("solida", window.scrollY > portadaEl.offsetHeight - barra.offsetHeight * 2);
  };
  window.addEventListener("scroll", () => {
    if (!pendiente) {
      pendiente = true;
      requestAnimationFrame(revisar);
    }
  }, { passive: true });
  revisar();
}
