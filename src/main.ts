import "./styles.css";
import type { ModoEntrega, Pedido } from "./types";
import { categorias, productos } from "./data/productos";
import { negocio, temporada } from "./data/temporada";
import { dinero } from "./lib/formato";
import { esPedidoTardio, nombreDia } from "./lib/fechas";
import { aumentar, disminuir, enlaceWhatsApp, faltantes, textoFaltantes } from "./lib/pedido";
import { $, aviso, llenar } from "./ui/dom";
import { pintarChips, pintarMenu, type Filtro } from "./ui/menu";
import { pintarOrden, textoPedido, type ContextoOrden } from "./ui/orden";

// ---------- Estado ----------
const pedido: Pedido = {
  cantidades: {},
  nombre: "",
  modo: "tienda",
  zona: 0,
  direccion: "",
  referencias: "",
  dia: temporada.diaPorDefecto,
};
let filtro: Filtro = "todo";
let busqueda = "";

const ctx: ContextoOrden = {
  catalogo: productos,
  temporada,
  whatsapp: negocio.whatsapp,
  tardio: esPedidoTardio(new Date(), temporada.anio, temporada.diaLimite),
};

const cambiarCantidad = (id: string, nueva: number) => {
  const { [id]: _, ...resto } = pedido.cantidades;
  pedido.cantidades = nueva > 0 ? { ...resto, [id]: nueva } : resto;
};

const pintarMenuYOrden = () => {
  pintarMenu(categorias, productos, filtro, busqueda, pedido.cantidades);
  pintarOrden(pedido, ctx);
};

// ---------- Textos y datos fijos ----------
function llenarDatos(): void {
  llenar("anio", String(temporada.anio));
  llenar("limite", `${temporada.diaLimite} de diciembre`);
  llenar("tardio", String(temporada.diaTardio));
  llenar("anticipo", temporada.anticipo);
  llenar("notaPrecios", temporada.notaPrecios);
  llenar("whatsapp", negocio.whatsappVisible);
  llenar("telefonos", negocio.telefonos);
  llenar("direccion", negocio.direccion);
  llenar("horario", negocio.horario);

  const general = enlaceWhatsApp(negocio.whatsapp, "Hola, quiero información de las cenas navideñas.");
  $<HTMLAnchorElement>("#topWa").href = general;
  $<HTMLAnchorElement>("#contactWa").href = general;

  const destino = encodeURIComponent(negocio.direccionMapas);
  $<HTMLAnchorElement>("#goMaps").href = `https://www.google.com/maps/dir/?api=1&travelmode=driving&destination=${destino}`;
  $<HTMLAnchorElement>("#goWaze").href = `https://waze.com/ul?navigate=yes&q=${destino}`;
  $<HTMLIFrameElement>("#mapFrame").src = `https://www.google.com/maps?q=${destino}&output=embed`;

  $("#zone").innerHTML = temporada.zonas
    .map((z, i) => `<option value="${i}">${z.nombre} · ${dinero(z.costo)}</option>`)
    .join("");
  $("#zonesTable").innerHTML = temporada.zonas.map((z) => `<tr><td>${z.nombre}</td><td>${dinero(z.costo)}</td></tr>`).join("");

  const dia = $<HTMLSelectElement>("#day");
  dia.innerHTML = temporada.diasEntrega
    .map((d, i) => `<option value="${i}">${nombreDia(temporada.anio, d.dia)}${d.soloTienda ? " · solo tienda" : ""}</option>`)
    .join("");
  dia.value = String(pedido.dia);

  $("#cal").innerHTML = temporada.diasEntrega
    .filter((d) => d.dia >= temporada.diaLimite)
    .map((d) => {
      const [clase, texto] =
        d.dia === temporada.diaLimite ? ["due", "Último día para pedir en línea o por teléfono"]
        : d.dia === temporada.diaTardio ? ["", "Pedidos tardíos, sujetos a disponibilidad"]
        : d.soloTienda ? ["hot", "Solo en tienda"]
        : ["", "Entregas y envíos"];
      return `<div class="day ${clase}"><b class="num">${d.dia}</b><small>${texto}</small></div>`;
    })
    .join("");
}

// ---------- Reglas de entrega ----------
function cambiarModo(modo: ModoEntrega): void {
  pedido.modo = modo;
  pintarOrden(pedido, ctx);
}

/** El 24 y el 31 solo se entrega en tienda. */
function revisarDia(): void {
  const soloTienda = !!temporada.diasEntrega[pedido.dia]?.soloTienda;
  $<HTMLButtonElement>('#mode [data-mode="domicilio"]').disabled = soloTienda;
  const forzado = soloTienda && pedido.modo === "domicilio";
  if (forzado) cambiarModo("tienda");
  $("#warn").hidden = !forzado;
}

// ---------- Eventos ----------
document.addEventListener("click", (e) => {
  const t = (e.target as Element).closest<HTMLElement>("button, a");
  if (!t) return;
  const { cat, inc, dec, mode } = t.dataset;

  if (cat) {
    filtro = cat as Filtro;
    pintarChips(categorias, productos, filtro);
    pintarMenu(categorias, productos, filtro, busqueda, pedido.cantidades);
  } else if (inc || dec) {
    const p = productos.find((x) => x.id === (inc ?? dec));
    if (!p) return;
    const actual = pedido.cantidades[p.id] ?? 0;
    cambiarCantidad(p.id, inc ? aumentar(actual, p.unidad) : disminuir(actual, p.unidad));
    pintarMenuYOrden();
  } else if (mode && !(t as HTMLButtonElement).disabled) {
    cambiarModo(mode as ModoEntrega);
    revisarDia();
  } else if (t.id === "bar") {
    const abierto = $("#order").classList.toggle("open");
    t.setAttribute("aria-expanded", String(abierto));
  } else if (t.id === "send" && t.getAttribute("aria-disabled") === "true") {
    e.preventDefault();
    aviso(textoFaltantes(faltantes(pedido, productos)));
    (pedido.nombre.trim() ? $("#addr") : $("#cname")).focus();
  } else if (t.id === "copy") {
    if (!Object.keys(pedido.cantidades).length) return aviso("Agrega al menos un producto");
    navigator.clipboard
      .writeText(textoPedido(pedido, ctx))
      .then(() => aviso("Pedido copiado"))
      .catch(() => aviso("No se pudo copiar. Usa el botón de WhatsApp."));
  }
});

$<HTMLInputElement>("#q").addEventListener("input", (e) => {
  busqueda = (e.target as HTMLInputElement).value;
  pintarMenu(categorias, productos, filtro, busqueda, pedido.cantidades);
});

const enlazarTexto = (sel: string, campo: "nombre" | "direccion" | "referencias") =>
  $<HTMLInputElement>(sel).addEventListener("input", (e) => {
    pedido[campo] = (e.target as HTMLInputElement).value;
    pintarOrden(pedido, ctx);
  });
enlazarTexto("#cname", "nombre");
enlazarTexto("#addr", "direccion");
enlazarTexto("#ref", "referencias");

$<HTMLSelectElement>("#zone").addEventListener("change", (e) => {
  pedido.zona = Number((e.target as HTMLSelectElement).value);
  pintarOrden(pedido, ctx);
});
$<HTMLSelectElement>("#day").addEventListener("change", (e) => {
  pedido.dia = Number((e.target as HTMLSelectElement).value);
  revisarDia();
  pintarOrden(pedido, ctx);
});
window.addEventListener("resize", () => pintarOrden(pedido, ctx));

// ---------- Inicio ----------
llenarDatos();
pintarChips(categorias, productos, filtro);
pintarMenuYOrden();
revisarDia();
