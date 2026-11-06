import "./styles.css";
import type { Linea, ModoEntrega, Pedido, Presentacion, TamanoPavo } from "./types";
import { categorias, productos } from "./data/productos";
import { firebase, maquila, negocio, temporada } from "./data/temporada";
import { dinero } from "./lib/formato";
import { esPedidoTardio } from "./lib/fechas";
import { sinDomicilio } from "./lib/entrega";
import { estaAgotado, leerAgotados } from "./lib/disponibilidad";
import {
  aumentar, conRellenoSugerido, disminuir, enlaceWhatsApp, faltantes, normalizarCantidad, normalizarKgPavo,
  normalizarKgRelleno, nuevaLinea, textoFaltantes, variasLineas,
} from "./lib/pedido";
import { $, aviso, llenar } from "./ui/dom";
import { actualizarPreciosPresentacion, pintarChips, pintarMenu, pintarRenglon, textoDetalle, type Filtro, type VistaMenu } from "./ui/menu";
import { pintarOrden, textoPedido, type ContextoOrden } from "./ui/orden";
import { pintarCalendario, rangoMeses } from "./ui/calendario";
import { iniciarNieve } from "./ui/nieve";
import { iniciarLuces } from "./ui/luces";
import { iniciarNav } from "./ui/nav";
import { iniciarHoja } from "./ui/hoja";
import { iniciarTema } from "./ui/tema";

// ---------- Estado ----------
const pedido: Pedido = {
  lineas: {},
  nombre: "",
  modo: "tienda",
  zona: 0,
  direccion: "",
  referencias: "",
  nota: "",
  fecha: null,
};
let filtro: Filtro = "todo";
let busqueda = "";
let agotados: ReadonlySet<string> = new Set(pruebaAgotados());
const hoy = new Date();
let mesVisto = { anio: hoy.getFullYear(), mes: hoy.getMonth() };
/** Siguiente número de línea para productos que se agregan varias veces (maquila-1, pavo-relleno-2…). */
const siguiente: Record<string, number> = {};

const ctx: ContextoOrden = {
  catalogo: productos,
  temporada,
  whatsapp: negocio.whatsapp,
  tardio: esPedidoTardio(hoy, temporada.anio, temporada.cortes.map((c) => c.limite)),
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
/** Producto y línea a partir del id de la línea. */
function deLinea(id: string) {
  const l = pedido.lineas[id];
  const p = l ? producto(l.productoId) : undefined;
  return p && l ? { p, l } : null;
}

function ponerLinea(id: string, linea: Linea | null): void {
  const { [id]: _quitar, ...resto } = pedido.lineas;
  pedido.lineas = linea ? { ...resto, [id]: linea } : resto;
}

const repintar = (productoId: string) => {
  pintarRenglon(vista(), productoId);
  pintarOrden(pedido, ctx);
};

/** Mientras el cliente escribe: solo cambia el texto de abajo y el total, sin repintar el campo. */
function actualizarInfo(id: string): void {
  const x = deLinea(id);
  const info = document.querySelector(`[data-info="${id}"]`);
  if (x && info) info.textContent = textoDetalle(x.p, x.l);
  if (x) actualizarPreciosPresentacion(x.p, id, x.l);
  pintarOrden(pedido, ctx);
}

// ---------- Textos y datos fijos ----------
// Medio árbol (24) y estrella de Belén (31) de fondo en la tarjeta, cortados por la orilla derecha.
const ICONO_ARBOL = `<svg class="day-ico arbol" viewBox="0 0 80 120" aria-hidden="true"><path d="M40 6c4 10 12 18 20 22-4 1-8 1-12 0 7 10 15 17 24 21-6 2-13 2-19 0 8 11 17 19 27 23-12 4-27 5-40 5s-28-1-40-5c10-4 19-12 27-23-6 2-13 2-19 0 9-4 17-11 24-21-4 1-8 1-12 0 8-4 16-12 20-22Z" fill="currentColor"/><rect x="34" y="78" width="12" height="16" rx="2" fill="currentColor"/><path d="m40 0 2.4 5 5.4.6-4 3.7 1.1 5.4L40 12l-4.9 2.7 1.1-5.4-4-3.7 5.4-.6Z" fill="currentColor"/></svg>`;
const ICONO_ESTRELLA = `<svg class="day-ico" viewBox="0 0 100 120" aria-hidden="true"><path d="M50 0Q54 56 90 60Q54 64 50 120Q46 64 10 60Q46 56 50 0Z" fill="currentColor"/><path d="M31 41 69 79M69 41 31 79" stroke="currentColor" stroke-width="3.5" stroke-linecap="round"/><circle cx="50" cy="60" r="6" fill="currentColor"/></svg>`;
function llenarDatos(): void {
  llenar("anio", String(temporada.anio));
  llenar(
    "cortes",
    temporada.cortes
      .map((c) => `Para ${c.para}, hasta el ${c.limite} de diciembre; el ${c.tardio} se reciben sujetos a disponibilidad.`)
      .join(" "),
  );
  // En "Antes de pedir" cada corte va en su propio renglón para que no se vea cargado.
  document.querySelectorAll<HTMLElement>('[data-cfg="cortesLineas"]').forEach((el) => {
    el.innerHTML = temporada.cortes
      .map((c) => `<span class="corte">Para ${c.para}, hasta el <b>${c.limite} de diciembre</b>; el ${c.tardio} se reciben sujetos a disponibilidad.</span>`)
      .join("");
  });
  llenar("anticipo", temporada.anticipo);
  llenar("notaPrecios", temporada.notaPrecios);
  llenar("whatsapp", negocio.whatsappVisible);
  llenar("telefonos", negocio.telefonos);
  document.querySelectorAll<HTMLElement>('[data-cfg="telLinks"]').forEach((el) => {
    el.innerHTML = negocio.telefonosMarcar
      .map((n) => `<a class="tel" href="tel:+52${n}">${n.slice(0, 2)} ${n.slice(2, 6)} ${n.slice(6)}</a>`)
      .join(" / ");
  });
  llenar("direccion", negocio.direccion);
  llenar("horario", negocio.horario);
  llenar("precioCocinar", dinero(maquila.precioCocinarKg));
  llenar("precioRelleno", dinero(maquila.precioRellenoKg));
  llenar("diasAnticipacion", String(maquila.diasAnticipacion));
  llenar("diasAviso", String(temporada.diasAvisoDomicilio));
  llenar("diasPedido", String(temporada.diasAnticipacionPedido));

  const general = enlaceWhatsApp(negocio.whatsapp, "Hola, quiero información de las cenas navideñas.");
  $<HTMLAnchorElement>("#topWa").href = general;
  $<HTMLAnchorElement>("#contactWa").href = general;
  $<HTMLAnchorElement>("#avisoWa").href = enlaceWhatsApp(negocio.whatsapp, "Hola, quiero saber si todavía hay disponibilidad para un pedido.");

  const destino = encodeURIComponent(negocio.direccionMapas);
  $<HTMLAnchorElement>("#goMaps").href = `https://www.google.com/maps/dir/?api=1&travelmode=driving&destination=${destino}`;
  $<HTMLAnchorElement>("#goWaze").href = `https://waze.com/ul?navigate=yes&q=${destino}`;
  $<HTMLIFrameElement>("#mapFrame").src = `https://www.google.com/maps?q=${destino}&output=embed`;

  $("#zone").innerHTML = temporada.zonas
    .map((z, i) => `<option value="${i}">${z.nombre} · ${dinero(z.costo)}</option>`)
    .join("");
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

  // Foto de la cena: se muestra solo si existe public/img/cena.jpg
  const foto = $<HTMLImageElement>("#fotoImg");
  foto.addEventListener("load", () => ($("#foto").hidden = false));
  foto.src = `${import.meta.env.BASE_URL}img/cena.jpg`;

  // Fotos de presentación: public/img/presentaciones/<tipo>.jpg. Mientras no existan, se ve el recuadro de muestra.
  document.querySelectorAll<HTMLElement>("[data-foto]").forEach((el) => {
    const url = `${import.meta.env.BASE_URL}img/presentaciones/${el.dataset.foto}.jpg`;
    const img = new Image();
    img.onload = () => {
      el.style.backgroundImage = `url("${url}")`;
      el.classList.add("con-foto");
    };
    img.src = url;
  });
}

// ---------- Fecha y entrega ----------
const pintarDias = () =>
  pintarCalendario({ temporada, anio: mesVisto.anio, mes: mesVisto.mes, seleccionado: pedido.fecha, hoy });

function cambiarModo(modo: ModoEntrega): void {
  pedido.modo = modo;
  pintarOrden(pedido, ctx);
}

/** 24 y 31 de diciembre: solo tienda. A domicilio: con al menos N días de anticipación. */
function revisarDia(): void {
  const motivo = pedido.fecha ? sinDomicilio(pedido.fecha, hoy, temporada) : null;
  $<HTMLButtonElement>('#mode [data-mode="domicilio"]').disabled = motivo !== null;
  const forzado = motivo !== null && pedido.modo === "domicilio";
  if (forzado) cambiarModo("tienda");
  const warn = $("#warn");
  warn.hidden = motivo === null;
  warn.textContent =
    motivo === "tienda"
      ? "El 24 de diciembre y el 31 de diciembre sólo entregamos en tienda."
      : motivo === "aviso"
        ? `Para envío a domicilio pide con al menos ${temporada.diasAvisoDomicilio} días de anticipación. Para esta fecha solo podemos entregarte en tienda.`
        : "";
  if (forzado) warn.textContent += ' Cambiamos tu pedido a "Recojo en tienda".';
}

// ---------- Agotados ----------
async function cargarDisponibilidad(): Promise<void> {
  const leidos = await leerAgotados(firebase.proyecto, firebase.documento);
  if (!leidos) return;
  agotados = new Set([...leidos, ...pruebaAgotados()]);
  const quitados = Object.entries(pedido.lineas).filter(([, l]) => {
    const p = producto(l.productoId);
    return p && estaAgotado(p, agotados);
  });
  quitados.forEach(([id]) => ponerLinea(id, null));
  const nombres = [...new Set(quitados.map(([, l]) => producto(l.productoId)!.nombre))];
  if (nombres.length) aviso(`Se agotó: ${nombres.join(", ")}. Lo quitamos de tu pedido.`);
  pintarMenu(vista());
  pintarOrden(pedido, ctx);
}

/** Para probar en local: ?agotados=PROD_001,PROD_008 */
function pruebaAgotados(): string[] {
  return (new URLSearchParams(location.search).get("agotados") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
}

// ---------- Eventos ----------
function agregar(productoId: string): void {
  const p = producto(productoId);
  if (!p || estaAgotado(p, agotados)) return;
  let id = p.id;
  if (variasLineas(p)) {
    siguiente[p.id] = (siguiente[p.id] ?? 0) + 1;
    id = `${p.id}-${siguiente[p.id]}`;
  }
  ponerLinea(id, nuevaLinea(p));
  repintar(p.id);
  if (p.maquila) document.querySelector<HTMLSelectElement>(`#tipo-${id}`)?.focus();
}

document.addEventListener("click", (e) => {
  const t = (e.target as Element).closest<HTMLElement>("button, a");
  if (!t) return;
  const d = t.dataset;

  if (d.cat) {
    filtro = d.cat as Filtro;
    pintarChips(vista());
    pintarMenu(vista());
  } else if (d.add) {
    agregar(d.add);
  } else if (d.inc || d.dec) {
    const id = (d.inc ?? d.dec)!;
    const x = deLinea(id);
    if (!x) return;
    const n = d.inc ? aumentar(x.p, x.l.cantidad) : disminuir(x.p, x.l.cantidad);
    if (x.p.maquila) ponerLinea(id, conRellenoSugerido({ ...x.l, cantidad: n }));
    else ponerLinea(id, n > 0 ? { ...x.l, cantidad: n } : null);
    repintar(x.p.id);
  } else if (d.del) {
    const x = deLinea(d.del);
    ponerLinea(d.del, null);
    if (x) repintar(x.p.id);
  } else if (d.size || d.pres) {
    const [id, valor] = (d.size ?? d.pres)!.split(":") as [string, string];
    const x = deLinea(id);
    if (!x) return;
    ponerLinea(id, d.size ? { ...x.l, tamano: valor as TamanoPavo } : { ...x.l, presentacion: valor as Presentacion });
    repintar(x.p.id);
  } else if (d.fecha) {
    pedido.fecha = d.fecha;
    pintarDias();
    revisarDia();
    pintarOrden(pedido, ctx);
  } else if (d.mes && !(t as HTMLButtonElement).disabled) {
    const n = new Date(mesVisto.anio, mesVisto.mes + Number(d.mes), 1);
    const { desde, hasta } = rangoMeses(temporada, hoy);
    const i = n.getFullYear() * 12 + n.getMonth();
    if (i < desde[0] * 12 + desde[1] || i > hasta[0] * 12 + hasta[1]) return;
    mesVisto = { anio: n.getFullYear(), mes: n.getMonth() };
    pintarDias();
  } else if (d.mode && !(t as HTMLButtonElement).disabled) {
    cambiarModo(d.mode as ModoEntrega);
    revisarDia();
  } else if (t.id === "regaloAdd") {
    e.preventDefault();
    filtro = "todo";
    busqueda = "";
    $<HTMLInputElement>("#q").value = "";
    pintarChips(vista());
    pintarMenu(vista());
    agregar("maquila");
    document.querySelector('[data-row="maquila"]')?.scrollIntoView({ block: "center", behavior: "smooth" });
  } else if (t.id === "send" && t.getAttribute("aria-disabled") === "true") {
    e.preventDefault();
    const falta = faltantes(pedido, productos);
    aviso(textoFaltantes(falta));
    if (falta.includes("qué carne nos trae para la maquila")) document.querySelector<HTMLElement>('[data-tipo]')?.focus();
    else if (!pedido.nombre.trim()) $("#cname").focus();
    else if (pedido.fecha === null) $("#calendar").scrollIntoView({ block: "center", behavior: "smooth" });
    else $("#addr").focus();
  } else if (t.id === "copy") {
    if (!Object.keys(pedido.lineas).length) return aviso("Agrega al menos un producto");
    navigator.clipboard
      .writeText(textoPedido(pedido, ctx))
      .then(() => aviso("Pedido copiado"))
      .catch(() => aviso("No se pudo copiar. Usa el botón de WhatsApp."));
  }
});

// Campos dentro de un producto. "input" mientras escribe (sin repintar), "change" al terminar.
document.addEventListener("input", (e) => {
  const el = e.target as HTMLInputElement;
  const d = el.dataset;
  const id = d.qty ?? d.kgpavo ?? d.relleno ?? d.otro ?? d.notalinea;
  if (!id) return;
  const x = deLinea(id);
  if (!x) return;
  const num = Number(el.value.replace(",", "."));
  if (d.qty) {
    const n = el.value.trim() === "" && x.p.maquila ? 0 : normalizarCantidad(x.p, num);
    if (n !== null) ponerLinea(id, x.p.maquila ? conRellenoSugerido({ ...x.l, cantidad: n }) : { ...x.l, cantidad: n });
    // El relleno sugerido cambia con el peso: actualizar su campo sin repintar.
    const r = document.querySelector<HTMLInputElement>(`#relleno-${id}`);
    if (r && pedido.lineas[id]) r.value = String(pedido.lineas[id]!.kgRelleno);
  } else if (d.kgpavo) {
    if (Number.isFinite(num) && num > 0) ponerLinea(id, { ...x.l, kgPorPavo: normalizarKgPavo(num) });
  } else if (d.relleno) {
    if (el.value.trim() !== "") ponerLinea(id, { ...x.l, kgRelleno: normalizarKgRelleno(num), rellenoManual: true });
  } else if (d.otro) {
    ponerLinea(id, { ...x.l, otroMaquila: el.value });
  } else {
    ponerLinea(id, { ...x.l, nota: el.value });
  }
  actualizarInfo(id);
});

document.addEventListener("change", (e) => {
  const el = e.target as HTMLInputElement | HTMLSelectElement;
  const d = el.dataset;
  if (d.tipo) {
    const x = deLinea(d.tipo);
    if (!x) return;
    ponerLinea(d.tipo, conRellenoSugerido({ ...x.l, tipoMaquila: el.value }));
    repintar(x.p.id);
    if (el.value === "Otro") document.querySelector<HTMLInputElement>(`#otro-${d.tipo}`)?.focus();
    return;
  }
  // Al salir del campo se muestra el valor ya limpio (ej. 0 → 0.25, 4 → 5 kg por pavo).
  // No se repinta el renglón para no perder el clic que el cliente esté dando en otro botón.
  const id = d.qty ?? d.kgpavo ?? d.relleno;
  const l = id ? pedido.lineas[id] : undefined;
  if (!id || !l) return;
  const limpio = d.qty ? l.cantidad : d.kgpavo ? l.kgPorPavo : l.kgRelleno;
  el.value = d.qty && limpio === 0 ? "" : String(limpio);
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
iniciarTema($<HTMLButtonElement>("#themeToggle"));
llenarDatos();
pintarChips(vista());
pintarMenu(vista());
pintarDias();
pintarOrden(pedido, ctx);
iniciarNieve($<HTMLCanvasElement>("#snow"), $<HTMLButtonElement>("#snowToggle"));
iniciarLuces($(".lights"));
iniciarHoja($("#order"), $<HTMLButtonElement>("#bar"), $("#barBtn"));

// Lo que mide la barra de arriba (con luces), para que la búsqueda y el pedido se peguen justo debajo.
const barra = $("header.top");
new ResizeObserver(() => {
  document.documentElement.style.setProperty("--alto-top", `${barra.getBoundingClientRect().bottom}px`);
}).observe(barra);
iniciarNav($(".nav"), () => barra.getBoundingClientRect().bottom);
void cargarDisponibilidad();
