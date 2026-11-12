import type { Linea, Presentacion, Producto } from "../types";
import { calculadora as cfg } from "../data/temporada";
import { calcularCena, pavosPara, repartirCarne, type Cena, type Grupo, type Personas } from "../lib/calculadora";
import { dinero, escapar, kilos } from "../lib/formato";
import { importeLinea, kgMinimoPavo, nuevaLinea, presentaciones } from "../lib/pedido";

/** Lo que la calculadora agrega al pedido: un producto y cómo queda su línea. */
export interface Agregado {
  productoId: string;
  cambios: Partial<Linea>;
}

const GRUPOS: Array<[Grupo, string, string]> = [
  ["personas", "Personas", "Niños, adultos y personas mayores"],
  ["adolescentes", "Adolescentes", "Suelen comer más"],
];

/** Presentación para todo el pedido. El pavo entero no cabe en acrílico: va en bolsa o caja. */
const PRESENTACIONES: Array<[Presentacion, string, string]> = [
  ["acrilico", "Acrílico", "Sin costo"],
  ["vacio", "Al vacío", "Con costo"],
  ["charola", "Charola", "Con costo"],
];

/** Una carne de la lista: producto y, en la pechuga, cómo se prepara. */
interface Carne {
  id: string;
  productoId: string;
  estilo?: string;
}

const MAX = 60;

export function iniciarCalculadora(
  raiz: HTMLElement,
  catalogo: readonly Producto[],
  agotado: (p: Producto) => boolean,
  alAgregar: (items: Agregado[], personas: number) => void,
): void {
  const p = (id: string) => catalogo.find((x) => x.id === id);

  // Carnes que se pueden elegir. Las que tienen versiones (pechuga, pierna) van en cada una.
  const carnes: Carne[] = [];
  for (const x of catalogo) {
    if (x.pieza || x.maquila || (x.categoria !== "pavo" && x.categoria !== "cerdo")) continue;
    if (x.versiones?.length) {
      for (const e of x.versiones) carnes.push({ id: `${x.id}:${e}`, productoId: x.id, estilo: e });
    } else carnes.push({ id: x.id, productoId: x.id });
  }
  const carne = (id: string) => carnes.find((c) => c.id === id) ?? carnes[0]!;
  const nombreCarne = (c: Carne) => `${p(c.productoId)?.nombre ?? ""}${c.estilo ? ` ${c.estilo.toLowerCase()}` : ""}`;

  const personas: Personas = { personas: cfg.sugeridas[0], adolescentes: 0 };
  const total = () => personas.personas + personas.adolescentes;
  const recomendada = () => (total() <= cfg.hastaPechuga ? "pechuga-pavo:Horneada" : "pavo-relleno");
  /** La primera carne sigue a la recomendación hasta que el cliente la cambie. */
  let elegidas: string[] = [recomendada()];
  let primeraTocada = false;
  const espagueti = p("espagueti");
  let pastaId = espagueti?.versiones?.[0] ? `espagueti:${espagueti.versiones[0]}` : "espagueti";
  let conRomeritos = true;
  let conBacalao = true;
  let presentacion: Presentacion = "acrilico";

  const variasPermitidas = () => total() >= cfg.desdeVariasCarnes;

  const opcionesCarne = (actual: string) => {
    const grupo = (cat: string, titulo: string) =>
      `<optgroup label="${titulo}">${carnes
        .filter((c) => p(c.productoId)?.categoria === cat)
        .map((c) => {
          const x = p(c.productoId)!;
          const no = agotado(x);
          return `<option value="${c.id}"${c.id === actual ? " selected" : ""}${no ? " disabled" : ""}>${escapar(nombreCarne(c))}${no ? " (agotado)" : ""}</option>`;
        })
        .join("")}</optgroup>`;
    return grupo("pavo", "Pavo") + grupo("cerdo", "Cerdo");
  };

  /** La línea que quedaría en el pedido, con la presentación elegida (si el producto la acepta). */
  const linea = (x: Producto, cambios: Partial<Linea>): Linea => {
    const opciones = presentaciones(x);
    const pres = opciones.includes(presentacion) ? presentacion : (opciones[0] ?? "acrilico");
    return { ...nuevaLinea(x), presentacion: pres, ...cambios };
  };

  type Fila = { nombre: string; cantidad: string; importe: number; agregado: Agregado[] };

  /** Renglones del resultado con lo que se agregaría. */
  const plan = (c: Cena): Fila[] => {
    const filas: Fila[] = [];
    const partes = repartirCarne(c.carne, elegidas.length);
    elegidas.forEach((id, n) => {
      const ca = carne(id);
      const x = p(ca.productoId);
      const kg = partes[n];
      if (!x || !kg) return;
      if (x.pavoEntero) {
        const pavos = pavosPara(kg, kgMinimoPavo(x), !x.soloCompleto);
        const lineas = pavos.map((v) => linea(x, { cantidad: 1, tamano: v.tamano, kgPorPavo: v.kgPorPavo }));
        filas.push({
          nombre: nombreCarne(ca),
          cantidad: pavos[0]?.tamano === "medio" ? "medio pavo (3 a 4 kg)" : `${pavos.length} ${pavos.length === 1 ? "pavo" : "pavos"} de aprox. ${kilos(pavos[0]!.kgPorPavo)}`,
          importe: lineas.reduce((a, l) => a + importeLinea(x, l), 0),
          agregado: lineas.map((l) => ({ productoId: x.id, cambios: l })),
        });
      } else {
        const l = linea(x, { cantidad: kg, version: ca.estilo ?? "" });
        filas.push({ nombre: nombreCarne(ca), cantidad: kilos(kg), importe: importeLinea(x, l), agregado: [{ productoId: x.id, cambios: l }] });
      }
    });
    const porKilo = (id: string, kg: number, version = "") => {
      const x = p(id);
      if (!x || !kg) return;
      const l = linea(x, { cantidad: kg, version });
      filas.push({ nombre: version ? `${x.nombre} ${version.toLowerCase()}` : x.nombre, cantidad: kilos(kg), importe: importeLinea(x, l), agregado: [{ productoId: id, cambios: l }] });
    };
    const [pastaProd, pastaVer = ""] = pastaId.split(":") as [string, string?];
    porKilo(pastaProd, c.pasta, pastaVer);
    porKilo("ensalada-manzana", c.ensalada);
    if (conRomeritos) porKilo("romeritos", c.romeritos);
    if (conBacalao) porKilo("bacalao", c.bacalao);
    const piezas = (id: string, n: number, extra = "") => {
      const x = p(id);
      if (!x || !n) return;
      filas.push({ nombre: x.nombre, cantidad: `${n} ${n === 1 ? "pza" : "pzas"}${extra}`, importe: n * x.precio, agregado: [{ productoId: id, cambios: { cantidad: n } }] });
    };
    piezas("strudel", c.strudelGrande, " (para 10)");
    piezas("strudel-individual", c.strudelIndividual);
    return filas;
  };

  /** Si dos carnes son el mismo producto y versión, se suman en una sola línea. Versiones distintas van aparte. */
  const juntar = (items: Agregado[]): Agregado[] => {
    const salida: Agregado[] = [];
    for (const it of items) {
      const x = p(it.productoId);
      const igual = x && !x.pavoEntero
        ? salida.find((s) => s.productoId === it.productoId && (s.cambios.version ?? "") === (it.cambios.version ?? ""))
        : undefined;
      if (igual) igual.cambios.cantidad = (igual.cambios.cantidad ?? 0) + (it.cambios.cantidad ?? 0);
      else salida.push({ productoId: it.productoId, cambios: { ...it.cambios } });
    }
    return salida;
  };

  const res = () => raiz.querySelector<HTMLElement>("#calcRes")!;

  const pintarResultado = () => {
    const c = calcularCena(personas);
    const hayPavo = elegidas.some((id) => p(carne(id).productoId)?.pavoEntero);
    raiz.querySelector<HTMLElement>("#calcNotaPavo")!.hidden = !(hayPavo && presentacion === "acrilico");
    raiz.querySelectorAll<HTMLButtonElement>("[data-sugerida]").forEach((b) => b.setAttribute("aria-pressed", String(Number(b.dataset.sugerida) === c.personas)));
    if (!c.personas) {
      res().innerHTML = `<p class="calc-vacio">Dinos cuántos serán en tu cena y te decimos cuánto pedir.</p>`;
      return;
    }
    const filas = plan(c);
    const suma = filas.reduce((a, f) => a + f.importe, 0);
    res().innerHTML = `
      <h3>Para ${c.personas} ${c.personas === 1 ? "persona" : "personas"} te sugerimos</h3>
      <ul class="calc-lista">${filas
        .map((f) => `<li><span>${escapar(f.nombre)}</span><b>${escapar(f.cantidad)}</b><span class="num">${dinero(Math.round(f.importe))}</span></li>`)
        .join("")}
        <li class="calc-pan"><span>Panecillo</span><b>${c.panes} ${c.panes === 1 ? "pza" : "pzas"}</b><span>1 por persona</span></li>
      </ul>
      <div class="calc-total"><span>Total aproximado</span><b class="num">${dinero(Math.round(suma))}</b></div>
      <button class="btn btn-wa" type="button" id="calcAgregar">Agregar todo a mi pedido</button>
      <p class="calc-aviso"><b>Es una recomendación.</b> La hacemos con nuestra experiencia de muchos años, calculando un promedio para que todos coman bien y puedan repetir un poco. Cada familia y cada cena es diferente, así que no podemos garantizar que no falte o sobre comida. Después de agregarlo puedes subir o bajar cada producto en tu pedido.</p>`;
    res().querySelector("#calcAgregar")?.addEventListener("click", () => alAgregar(juntar(filas.flatMap((f) => f.agregado)), c.personas));
  };

  const pintarCarnes = () => {
    const caja = raiz.querySelector<HTMLElement>("#calcCarnes")!;
    if (!variasPermitidas() && elegidas.length > 1) elegidas = elegidas.slice(0, 1);
    caja.innerHTML =
      elegidas
        .map(
          (id, n) => `<div class="calc-carne">
            <select data-carne="${n}" aria-label="Carne ${n + 1}">${opcionesCarne(id)}</select>
            ${n > 0 ? `<button type="button" class="calc-quitar" data-quitar="${n}" aria-label="Quitar esta carne">✕</button>` : ""}
          </div>`,
        )
        .join("") +
      (variasPermitidas() && elegidas.length < cfg.maxCarnes
        ? `<button type="button" class="calc-mas" id="calcMas"><span aria-hidden="true">+</span> Agregar otra carne <small>${elegidas.length === 1 ? "mitad y mitad" : "en partes iguales"}</small></button>`
        : "") +
      (elegidas.length > 1 ? `<p class="calc-nota">La carne se reparte en partes iguales, mínimo 250 g de cada una.</p>` : "");
  };

  /** Cuando cambia el número de personas: la carne recomendada y si se pueden poner varias. */
  const alCambiarPersonas = () => {
    if (!primeraTocada) elegidas[0] = recomendada();
    pintarCarnes();
    pintarResultado();
  };

  raiz.innerHTML = `
    <div class="calc-form">
      <div class="calc-sugeridas">
        <span class="calc-etq">¿Cuántos son?</span>
        <div class="seg">${cfg.sugeridas
          .map((n) => `<button type="button" data-sugerida="${n}" aria-pressed="false">${n} <small>personas</small></button>`)
          .join("")}</div>
      </div>
      <div class="calc-grupos">${GRUPOS.map(
        ([g, nombre, nota]) => `<div class="calc-grupo">
          <span class="calc-nombre">${nombre}<small>${nota}</small></span>
          <div class="qty"><button type="button" data-calc="${g}:-1" aria-label="Menos ${nombre.toLowerCase()}">−</button>
          <input class="num" type="number" inputmode="numeric" min="0" max="${MAX}" value="${personas[g]}" data-calcn="${g}" aria-label="${nombre}">
          <button type="button" data-calc="${g}:1" aria-label="Más ${nombre.toLowerCase()}">+</button></div></div>`,
      ).join("")}</div>
      <div class="calc-elige">
        <div class="calc-campo"><span class="calc-etq">Carne</span><div id="calcCarnes"></div></div>
        <label class="calc-campo"><span class="calc-etq">Pasta</span><select id="calcPasta">${["espagueti", "ravioles"]
          .map((id) => p(id))
          .filter((x): x is Producto => !!x)
          .flatMap((x) => (x.versiones?.length ? x.versiones.map((ver) => [x, ver] as const) : [[x, ""] as const]))
          .map(([x, ver]) => {
            const valor = ver ? `${x.id}:${ver}` : x.id;
            return `<option value="${escapar(valor)}"${valor === pastaId ? " selected" : ""}${agotado(x) ? " disabled" : ""}>${escapar(ver ? `${x.nombre} ${ver.toLowerCase()}` : x.nombre)}</option>`;
          })
          .join("")}</select></label>
        <fieldset class="calc-campo"><legend class="calc-etq">Extra</legend>
          <div class="calc-extras">
            <label class="calc-chk"><input type="checkbox" id="calcRom" checked><span>Romeritos</span></label>
            <label class="calc-chk"><input type="checkbox" id="calcBac" checked><span>Bacalao</span></label>
          </div>
        </fieldset>
        <div class="calc-campo"><span class="calc-etq">Presentación para todo</span>
          <div class="seg seg-3" id="calcPres">${PRESENTACIONES.map(
            ([v, t, s]) => `<button type="button" data-pres-calc="${v}" aria-pressed="${v === presentacion}">${t}<small>${s}</small></button>`,
          ).join("")}</div>
          <p class="calc-nota" id="calcNotaPavo" hidden>El pavo entero no cabe en acrílico: va en bolsa o caja de cartón, sin costo.</p>
        </div>
      </div>
    </div>
    <div class="calc-res" id="calcRes" aria-live="polite"></div>`;

  raiz.addEventListener("click", (e) => {
    const t = (e.target as Element).closest<HTMLButtonElement>("button");
    if (!t) return;
    const d = t.dataset;
    if (d.calc) {
      const [g, paso] = d.calc.split(":") as [Grupo, string];
      personas[g] = Math.min(MAX, Math.max(0, personas[g] + Number(paso)));
      raiz.querySelector<HTMLInputElement>(`[data-calcn="${g}"]`)!.value = String(personas[g]);
      alCambiarPersonas();
    } else if (d.sugerida) {
      // Se ajusta el número de personas y se respetan los adolescentes que ya puso.
      const n = Number(d.sugerida);
      personas.adolescentes = Math.min(personas.adolescentes, n);
      personas.personas = n - personas.adolescentes;
      GRUPOS.forEach(([g]) => (raiz.querySelector<HTMLInputElement>(`[data-calcn="${g}"]`)!.value = String(personas[g])));
      alCambiarPersonas();
    } else if (t.id === "calcMas") {
      const usadas = new Set(elegidas);
      const otra = carnes.find((c) => !usadas.has(c.id) && !agotado(p(c.productoId)!) && c.productoId !== carne(elegidas[0]!).productoId);
      elegidas.push(otra?.id ?? carnes[0]!.id);
      pintarCarnes();
      pintarResultado();
    } else if (d.quitar) {
      elegidas.splice(Number(d.quitar), 1);
      pintarCarnes();
      pintarResultado();
    } else if (d.presCalc) {
      presentacion = d.presCalc as Presentacion;
      raiz.querySelectorAll("[data-pres-calc]").forEach((b) => b.setAttribute("aria-pressed", String(b === t)));
      pintarResultado();
    }
  });
  raiz.addEventListener("input", (e) => {
    const el = e.target as HTMLInputElement;
    if (el.dataset.calcn) {
      const n = Math.floor(Number(el.value));
      personas[el.dataset.calcn as Grupo] = Number.isFinite(n) ? Math.min(MAX, Math.max(0, n)) : 0;
      alCambiarPersonas();
      return;
    }
    if (el.dataset.carne) {
      const n = Number(el.dataset.carne);
      elegidas[n] = el.value;
      if (n === 0) primeraTocada = true;
    } else if (el.id === "calcPasta") pastaId = el.value;
    else if (el.id === "calcRom") conRomeritos = el.checked;
    else if (el.id === "calcBac") conBacalao = el.checked;
    else return;
    pintarResultado();
  });
  raiz.addEventListener("change", (e) => {
    const el = e.target as HTMLInputElement;
    if (el.dataset.calcn) el.value = String(personas[el.dataset.calcn as Grupo]);
  });
  pintarCarnes();
  pintarResultado();
}
