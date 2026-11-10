import "./styles.css";
import type { Linea, ModoEntrega, Pedido, Presentacion, TamanoPavo } from "./types";
import { categorias, productos } from "./data/productos";
import { firebase, negocio, temporada } from "./data/temporada";
import { dinero } from "./lib/formato";
import { esPedidoTardio } from "./lib/fechas";
import { sinDomicilio } from "./lib/entrega";
import { estaAgotado, leerAgotados } from "./lib/disponibilidad";
import {
  aumentar, conRellenoSugerido, disminuir, enlaceWhatsApp, faltantes, normalizarCantidad, normalizarKgPavo,
  normalizarKgRelleno, nuevaLinea, textoFaltantes, variasLineas,
} from "./lib/pedido";
import { $, aviso } from "./ui/dom";
import { actualizarPreciosPresentacion, pintarChips, pintarMenu, pintarRenglon, textoDetalle, type Filtro, type VistaMenu } from "./ui/menu";
import { pintarOrden, textoPedido, type ContextoOrden } from "./ui/orden";
import { pintarCalendario, rangoMeses } from "./ui/calendario";
import { iniciarHoja } from "./ui/hoja";
import { iniciarCalculadora, type Agregado } from "./ui/calculadora";
import { iniciarComun } from "./comun";

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

/** El pedido se guarda mientras dure la visita, para no perderlo al ir a otra página (Inicio, Gravy) y volver. */
const CLAVE = "walkiria-pedido";
function pintarPedido(): void {
  pintarOrden(pedido, ctx);
  try {
    sessionStorage.setItem(CLAVE, JSON.stringify(pedido));
  } catch {
    /* sin almacenamiento: el pedido dura mientras no cambie de página */
  }
}

function restaurar(): void {
  let g: Partial<Pedido>;
  try {
    g = JSON.parse(sessionStorage.getItem(CLAVE) ?? "null") ?? {};
  } catch {
    return;
  }
  if (typeof g !== "object") return;
  const lineas: Record<string, Linea> = {};
  for (const [id, l] of Object.entries(g.lineas ?? {})) {
    if (!l || !productos.some((p) => p.id === l.productoId)) continue;
    lineas[id] = l;
    const n = Number(id.slice(l.productoId.length + 1));
    if (n > 0) siguiente[l.productoId] = Math.max(siguiente[l.productoId] ?? 0, n);
  }
  pedido.lineas = lineas;
  pedido.nombre = typeof g.nombre === "string" ? g.nombre : "";
  pedido.modo = g.modo === "domicilio" ? "domicilio" : "tienda";
  pedido.zona = typeof g.zona === "number" && temporada.zonas[g.zona] ? g.zona : 0;
  pedido.direccion = typeof g.direccion === "string" ? g.direccion : "";
  pedido.referencias = typeof g.referencias === "string" ? g.referencias : "";
  pedido.nota = typeof g.nota === "string" ? g.nota : "";
  pedido.fecha = typeof g.fecha === "string" && /^\d{4}-\d{2}-\d{2}$/.test(g.fecha) ? g.fecha : null;
  $<HTMLInputElement>("#cname").value = pedido.nombre;
  $<HTMLTextAreaElement>("#addr").value = pedido.direccion;
  $<HTMLInputElement>("#ref").value = pedido.referencias;
  $<HTMLTextAreaElement>("#nota").value = pedido.nota;
}

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
  pintarPedido();
};

/** Mientras el cliente escribe: solo cambia el texto de abajo y el total, sin repintar el campo. */
function actualizarInfo(id: string): void {
  const x = deLinea(id);
  const info = document.querySelector(`[data-info="${id}"]`);
  if (x && info) info.textContent = textoDetalle(x.p, x.l);
  if (x) actualizarPreciosPresentacion(x.p, id, x.l);
  pintarPedido();
}

// ---------- Textos y datos fijos ----------
function llenarDatos(): void {
  $<HTMLAnchorElement>("#avisoWa").href = enlaceWhatsApp(negocio.whatsapp, "Hola, quiero saber si todavía hay disponibilidad para un pedido.");
  $("#zone").innerHTML = temporada.zonas
    .map((z, i) => `<option value="${i}">${z.nombre} · ${dinero(z.costo)}</option>`)
    .join("");

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
  pintarPedido();
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
  pintarPedido();
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

/** Lo que arma la calculadora entra al pedido (si el producto ya estaba, se cambia su cantidad). */
function agregarDeCalculadora(items: readonly Agregado[]): void {
  let n = 0;
  for (const { productoId, cambios } of items) {
    const p = producto(productoId);
    if (!p || estaAgotado(p, agotados)) continue;
    let id = p.id;
    if (variasLineas(p)) {
      siguiente[p.id] = (siguiente[p.id] ?? 0) + 1;
      id = `${p.id}-${siguiente[p.id]}`;
    }
    ponerLinea(id, { ...(pedido.lineas[id] ?? nuevaLinea(p)), ...cambios });
    n++;
  }
  if (!n) return;
  filtro = "todo";
  busqueda = "";
  $<HTMLInputElement>("#q").value = "";
  pintarChips(vista());
  pintarMenu(vista());
  pintarPedido();
  aviso(`Listo: agregamos ${n} ${n === 1 ? "producto" : "productos"} a tu pedido. Puedes ajustarlos aquí.`);
  $<HTMLDetailsElement>("#calcCaja").open = false;
  $("#precios").scrollIntoView({ behavior: "smooth" });
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
    pintarPedido();
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
  } else if (t.getAttribute("href") === "#calcCaja") {
    $<HTMLDetailsElement>("#calcCaja").open = true;
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
    pintarPedido();
  });
enlazarTexto("#cname", "nombre");
enlazarTexto("#addr", "direccion");
enlazarTexto("#ref", "referencias");
enlazarTexto("#nota", "nota");

$<HTMLSelectElement>("#zone").addEventListener("change", (e) => {
  pedido.zona = Number((e.target as HTMLSelectElement).value);
  pintarPedido();
});
window.addEventListener("resize", () => pintarPedido());
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) void cargarDisponibilidad();
});

// ---------- Inicio ----------
iniciarComun();
restaurar();
llenarDatos();
$<HTMLSelectElement>("#zone").value = String(pedido.zona);
if (pedido.fecha) mesVisto = { anio: Number(pedido.fecha.slice(0, 4)), mes: Number(pedido.fecha.slice(5, 7)) - 1 };
pintarChips(vista());
pintarMenu(vista());
pintarDias();
revisarDia();
pintarPedido();
iniciarCalculadora($("#calc"), productos, (p) => estaAgotado(p, agotados), agregarDeCalculadora);
iniciarHoja($("#order"), $<HTMLButtonElement>("#bar"), $("#barBtn"));



// Desde el inicio: "¿Le regalaron el pavo?" llega con ?agregar=maquila y la maquila ya puesta.
const pedir = new URLSearchParams(location.search).get("agregar");
if (pedir && producto(pedir)) {
  $<HTMLDetailsElement>("#calcCaja").open = false;
  const ya = Object.values(pedido.lineas).some((l) => l.productoId === pedir);
  if (!ya) agregar(pedir);
  history.replaceState(null, "", location.pathname);
  requestAnimationFrame(() => document.querySelector(`[data-row="${pedir}"]`)?.scrollIntoView({ block: "center" }));
}
void cargarDisponibilidad();
