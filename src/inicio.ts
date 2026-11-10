import { negocio, temporada } from "./data/temporada";
import { dinero } from "./lib/formato";
import { enlaceWhatsApp } from "./lib/pedido";
import { iniciarComun } from "./comun";
import { $ } from "./ui/dom";
import { iniciarVolante } from "./ui/volante";

// Medio árbol (24) y estrella de Belén (31) de fondo en la tarjeta, cortados por la orilla derecha.
const ICONO_ARBOL = `<svg class="day-ico arbol" viewBox="0 0 80 120" aria-hidden="true"><path d="M40 6c4 10 12 18 20 22-4 1-8 1-12 0 7 10 15 17 24 21-6 2-13 2-19 0 8 11 17 19 27 23-12 4-27 5-40 5s-28-1-40-5c10-4 19-12 27-23-6 2-13 2-19 0 9-4 17-11 24-21-4 1-8 1-12 0 8-4 16-12 20-22Z" fill="currentColor"/><rect x="34" y="78" width="12" height="16" rx="2" fill="currentColor"/><path d="m40 0 2.4 5 5.4.6-4 3.7 1.1 5.4L40 12l-4.9 2.7 1.1-5.4-4-3.7 5.4-.6Z" fill="currentColor"/></svg>`;
const ICONO_ESTRELLA = `<svg class="day-ico" viewBox="0 0 100 120" aria-hidden="true"><path d="M50 0Q54 56 90 60Q54 64 50 120Q46 64 10 60Q46 56 50 0Z" fill="currentColor"/><path d="M31 41 69 79M69 41 31 79" stroke="currentColor" stroke-width="3.5" stroke-linecap="round"/><circle cx="50" cy="60" r="6" fill="currentColor"/></svg>`;

iniciarComun();

$<HTMLAnchorElement>("#contactWa").href = enlaceWhatsApp(negocio.whatsapp, "Hola, quiero información de las cenas navideñas.");
const destino = encodeURIComponent(negocio.direccionMapas);
$<HTMLAnchorElement>("#goMaps").href = `https://www.google.com/maps/dir/?api=1&travelmode=driving&destination=${destino}`;
$<HTMLAnchorElement>("#goWaze").href = `https://waze.com/ul?navigate=yes&q=${destino}`;
$<HTMLIFrameElement>("#mapFrame").src = `https://www.google.com/maps?q=${destino}&output=embed`;

$("#zonesTable").innerHTML = temporada.zonas.map((z) => `<tr><td>${z.nombre}</td><td>${dinero(z.costo)}</td></tr>`).join("");

const textos = {
  limite: ["due", ""],
  sujeto: ["", "Sujeto a disponibilidad"],
  tienda: ["hot", "Sólo entrega en tienda"],
} as const;
$("#cal").innerHTML = temporada.diasEspeciales
  .map((d) => {
    const corte = temporada.cortes.find((c) => c.limite === d.dia);
    const [clase, base] = textos[d.tipo];
    const texto = corte ? `Último día para pedir en línea la cena de ${corte.para}` : base;
    const extra = d.tipo === "tienda" ? `<small class="sujeto">*Sujeto a disponibilidad</small>` : "";
    // 24: árbol de Navidad; 31: estrella de Año Nuevo.
    const icono = d.tipo === "tienda" ? (d.dia === 24 ? ICONO_ARBOL : ICONO_ESTRELLA) : "";
    return `<div class="day ${clase}">${icono}<b class="num">${d.dia}</b><span class="mes">de diciembre</span><small>${texto}</small>${extra}</div>`;
  })
  .join("");

// Galería: cada recuadro muestra public/img/galeria/<producto>.jpg. Mientras no exista la foto, se ve el recuadro de muestra.
document.querySelectorAll<HTMLElement>("[data-gal]").forEach((el) => {
  const url = `${import.meta.env.BASE_URL}img/galeria/${el.dataset.gal}.jpg`;
  const img = new Image();
  img.onload = () => {
    el.style.backgroundImage = `url("${url}")`;
    el.classList.add("con-foto");
  };
  img.src = url;
});

iniciarVolante(
  `${import.meta.env.BASE_URL}volante/volante-2600.webp`,
  `${import.meta.env.BASE_URL}volante/volante-walkiria-2026.png`,
);
