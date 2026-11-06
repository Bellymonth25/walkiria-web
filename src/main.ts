import "./styles.css";
import type { Linea, ModoEntrega, Pedido, Presentacion, TamanoPavo } from "./types";
import { categorias, productos } from "./data/productos";
import { firebase, maquila, negocio, temporada } from "./data/temporada";
import { dinero } from "./lib/formato";
import { esPedidoTardio } from "./lib/fechas";
import { estaAgotado, leerAgotados } from "./lib/disponibilidad";
import {
  aumentar, disminuir, enlaceWhatsApp, faltantes, normalizarCantidad, normalizarKgPavo, nuevaLinea, textoFaltantes,
} from "./lib/pedido";
import { $, aviso, llenar } from "./ui/dom";
import { pintarChips, pintarMenu, pintarRenglon, textoDetalle, type Filtro, type VistaMenu } from "./ui/menu";
import { pintarOrden, textoPedido, type ContextoOrden } from "./ui/orden";
import { pintarCalendario } from "./ui/calendario";
import { iniciarNieve } from "./ui/nieve";

// ---------- Estado ----------
const pedido: Pedido = {
  lineas: {},
  nombre: "",
  modo: "tienda",
  zona: 0,
  direccion: "",
  referencias: "",
  nota: "",
  dia: null,
};
let filtro: Filtro = "todo";
let busqueda = "";
let agotados: ReadonlySet<string> = new Set(pruebaAgotados());

const ctx: ContextoOrden = {
  catalogo: productos,
  temporada,
  whatsapp: negocio.whatsapp,
  tardio: esPedidoTardio(new Date(), temporada.anio, temporada.diaLimite),
};

const vista = (): VistaMenu => ({
  categorias,
  catalogo: productos,
  filtro,
  busqueda,
  lineas: pedido.lineas,
  agotados: (p) => estaAgotado(p, agotados),
});

const producto = (id: string) => productos.find((p) => p.id === id);

function ponerLinea(id: string, linea: Linea | null): void {
  const { [id]: _quitar, ...resto } = pedido.lineas;
  pedido.lineas = linea ? { ...resto, [id]: linea } : resto;
}

const actualizarRenglon = (id: string) => {
  pintarRenglon(vista(), id);
  pintarOrden(pedido, ctx);
};

/** Mientras el cliente escribe: solo cambia el texto de abajo y el total, sin repintar el input. */
function actualizarInfo(id: string): void {
  const p = producto(id);
  const l = pedido.lineas[id];
  const info = document.querySelector(`[data-info="${id}"]`);
  if (p && l && info) info.textContent = textoDetalle(p, l);
  pintarOrden(pedido, ctx);
}

// ---------- Textos y datos fijos ----------
function llenarDatos(): void {
  llenar("anio", String(temporada.anio));
  llenar("limite", `${temporada.diaLimite} de diciembre`);
  llenar("tardio", `${temporada.diaTardio} de diciembre`);
  llenar("anticipo", temporada.anticipo);
  llenar("notaPrecios", temporada.notaPrecios);
  llenar("whatsapp", negocio.whatsappVisible);
  llenar("telefonos", negocio.telefonos);
  llenar("direccion", negocio.direccion);
  llenar("horario", negocio.horario);
  llenar("precioCocinar", dinero(maquila.precioCocinarKg));
  llenar("precioRelleno", dinero(maquila.precioRellenoKg));
  llenar("diasAnticipacion", String(maquila.diasAnticipacion));

  const general = enlaceWhatsApp(negocio.whatsapp, "Hola, quiero información de las cenas navideñas.");
  $<HTMLAnchorElement>("#topWa").href = general;
  $<HTMLAnchorElement>("#contactWa").href = general;
  $<HTMLAnchorElement>("#regaloWa").href = enlaceWhatsApp(
    negocio.whatsapp,
    "Hola, me regalaron un pavo (o carne) y quiero que me lo cocinen.\nNombre: \nProducto que voy a llevar: \n¿Con relleno?: \nDía de entrega: \nSé que debo llevarlo a la tienda al menos 2 días antes.",
  );

  const destino = encodeURIComponent(negocio.direccionMapas);
  $<HTMLAnchorElement>("#goMaps").href = `https://www.google.com/maps/dir/?api=1&travelmode=driving&destination=${destino}`;
  $<HTMLAnchorElement>("#goWaze").href = `https://waze.com/ul?navigate=yes&q=${destino}`;
  $<HTMLIFrameElement>("#mapFrame").src = `https://www.google.com/maps?q=${destino}&output=embed`;

  $("#zone").innerHTML = temporada.zonas
    .map((z, i) => `<option value="${i}">${z.nombre} · ${dinero(z.costo)}</option>`)
    .join("");
  $("#zonesTable").innerHTML = temporada.zonas.map((z) => `<tr><td>${z.nombre}</td><td>${dinero(z.costo)}</td></tr>`).join("");

  $("#cal").innerHTML = temporada.diasEntrega
    .filter((d) => d.dia >= temporada.diaLimite)
    .map((d) => {
      const [clase, texto] =
        d.dia === temporada.diaLimite ? ["due", "Último día para pedir en línea o por teléfono"]
        : d.dia === temporada.diaTardio ? ["", "Pedidos tardíos, sujetos a disponibilidad"]
        : d.soloTienda ? ["hot", "Solo entrega en tienda"]
        : ["", "Entregas y envíos"];
      return `<div class="day ${clase}"><b class="num">${d.dia}</b><span class="mes">de diciembre</span><small>${texto}</small></div>`;
    })
    .join("");

  // Foto de la cena: se muestra solo si existe public/img/cena.jpg
  const foto = $<HTMLImageElement>("#fotoImg");
  foto.addEventListener("load", () => ($("#foto").hidden = false));
  foto.src = `${import.meta.env.BASE_URL}img/cena.jpg`;
}

// ---------- Fecha y entrega ----------
const pintarDias = () =>
  pintarCalendario({ anio: temporada.anio, dias: temporada.diasEntrega, diaTardio: temporada.diaTardio, seleccionado: pedido.dia, hoy: new Date() });

function cambiarModo(modo: ModoEntrega): void {
  pedido.modo = modo;
  pintarOrden(pedido, ctx);
}

/** El 24 y el 31 de diciembre solo se entrega en tienda. */
function revisarDia(): void {
  const soloTienda = !!temporada.diasEntrega.find((d) => d.dia === pedido.dia)?.soloTienda;
  $<HTMLButtonElement>('#mode [data-mode="domicilio"]').disabled = soloTienda;
  const forzado = soloTienda && pedido.modo === "domicilio";
  if (forzado) cambiarModo("tienda");
  $("#warn").hidden = !forzado;
}

// ---------- Agotados ----------
async function cargarDisponibilidad(): Promise<void> {
  const leidos = await leerAgotados(firebase.proyecto, firebase.documento);
  if (!leidos) return;
  agotados = new Set([...leidos, ...pruebaAgotados()]);
  const quitados = productos.filter((p) => pedido.lineas[p.id] && estaAgotado(p, agotados));
  quitados.forEach((p) => ponerLinea(p.id, null));
  if (quitados.length) aviso(`Se agotó: ${quitados.map((p) => p.nombre).join(", ")}. Lo quitamos de tu pedido.`);
  pintarMenu(vista());
  pintarOrden(pedido, ctx);
}

/** Para probar en local: ?agotados=PROD_001,PROD_008 */
function pruebaAgotados(): string[] {
  return (new URLSearchParams(location.search).get("agotados") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
}

// ---------- Eventos ----------
document.addEventListener("click", (e) => {
  const t = (e.target as Element).closest<HTMLElement>("button, a");
  if (!t) return;
  const d = t.dataset;

  if (d.cat) {
    filtro = d.cat as Filtro;
    pintarChips(vista());
    pintarMenu(vista());
  } else if (d.add) {
    const p = producto(d.add);
    if (!p || estaAgotado(p, agotados)) return;
    ponerLinea(p.id, nuevaLinea(p));
    actualizarRenglon(p.id);
  } else if (d.inc || d.dec) {
    const id = (d.inc ?? d.dec)!;
    const p = producto(id);
    const l = pedido.lineas[id];
    if (!p || !l) return;
    const n = d.inc ? aumentar(p, l.cantidad) : disminuir(p, l.cantidad);
    ponerLinea(id, n > 0 ? { ...l, cantidad: n } : null);
    actualizarRenglon(id);
  } else if (d.del) {
    ponerLinea(d.del, null);
    actualizarRenglon(d.del);
  } else if (d.size || d.pres) {
    const [id, valor] = (d.size ?? d.pres)!.split(":") as [string, string];
    const l = pedido.lineas[id];
    if (!l) return;
    ponerLinea(id, d.size ? { ...l, tamano: valor as TamanoPavo } : { ...l, presentacion: valor as Presentacion });
    actualizarRenglon(id);
  } else if (d.day) {
    pedido.dia = Number(d.day);
    pintarDias();
    revisarDia();
    pintarOrden(pedido, ctx);
  } else if (d.mode && !(t as HTMLButtonElement).disabled) {
    cambiarModo(d.mode as ModoEntrega);
    revisarDia();
  } else if (t.id === "bar") {
    const abierto = $("#order").classList.toggle("open");
    t.setAttribute("aria-expanded", String(abierto));
    $("#barBtn").textContent = abierto ? "Ocultar" : "Ver pedido";
  } else if (t.id === "send" && t.getAttribute("aria-disabled") === "true") {
    e.preventDefault();
    aviso(textoFaltantes(faltantes(pedido, productos)));
    if (!pedido.nombre.trim()) $("#cname").focus();
    else if (pedido.dia === null) $("#calendar").scrollIntoView({ block: "center", behavior: "smooth" });
    else $("#addr").focus();
  } else if (t.id === "copy") {
    if (!Object.keys(pedido.lineas).length) return aviso("Agrega al menos un producto");
    navigator.clipboard
      .writeText(textoPedido(pedido, ctx))
      .then(() => aviso("Pedido copiado"))
      .catch(() => aviso("No se pudo copiar. Usa el botón de WhatsApp."));
  }
});

// Cantidades escritas a mano: "input" mientras escribe, "change" al salir del campo.
document.addEventListener("input", (e) => {
  const el = e.target as HTMLInputElement;
  const id = el.dataset.qty ?? el.dataset.kgpavo;
  if (!id) return;
  const p = producto(id);
  const l = pedido.lineas[id];
  if (!p || !l) return;
  const valor = Number(el.value.replace(",", "."));
  if (el.dataset.qty) {
    const n = normalizarCantidad(p, valor);
    if (n !== null) ponerLinea(id, { ...l, cantidad: n });
  } else if (Number.isFinite(valor) && valor > 0) {
    ponerLinea(id, { ...l, kgPorPavo: normalizarKgPavo(valor) });
  }
  actualizarInfo(id);
});
// Al salir del campo se muestra el valor ya limpio (ej. 0 → 0.25, 4 → 5 kg por pavo).
// No se repinta el renglón para no perder el clic que el cliente esté dando en otro botón.
document.addEventListener("change", (e) => {
  const el = e.target as HTMLInputElement;
  const id = el.dataset?.qty ?? el.dataset?.kgpavo;
  const l = id ? pedido.lineas[id] : undefined;
  if (!id || !l) return;
  el.value = String(el.dataset.qty ? l.cantidad : l.kgPorPavo);
  actualizarInfo(id);
});

$<HTMLInputElement>("#q").addEventListener("input", (e) => {
  busqueda = (e.target as HTMLInputElement).value;
  pintarMenu(vista());
});

const enlazarTexto = (sel: string, campo: "nombre" | "direccion" | "referencias" | "nota") =>
  $<HTMLInputElement>(sel).addEventListener("input", (e) => {
    pedido[campo] = (e.target as HTMLInputElement).value;
    pintarOrden(pedido, ctx);
  });
enlazarTexto("#cname", "nombre");
enlazarTexto("#addr", "direccion");
enlazarTexto("#ref", "referencias");
enlazarTexto("#nota", "nota");

$<HTMLSelectElement>("#zone").addEventListener("change", (e) => {
  pedido.zona = Number((e.target as HTMLSelectElement).value);
  pintarOrden(pedido, ctx);
});
window.addEventListener("resize", () => pintarOrden(pedido, ctx));
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) void cargarDisponibilidad();
});

// ---------- Inicio ----------
llenarDatos();
pintarChips(vista());
pintarMenu(vista());
pintarDias();
pintarOrden(pedido, ctx);
iniciarNieve($<HTMLCanvasElement>("#snow"), $<HTMLButtonElement>("#snowToggle"));
void cargarDisponibilidad();
