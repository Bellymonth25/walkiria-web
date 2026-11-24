import type { Linea, Presentacion, Producto } from "../types";
import { calculadora as cfg, combo as cfgCombo, tiposCena, type ExtraCena, type TipoCena } from "../data/temporada";
import { calcularCena, pavoPermitido, pavosCena, repartirCarne, type Cena } from "../lib/calculadora";
import { dinero, escapar, kilos } from "../lib/formato";
import { importeProducto, kgMinimoPavo, nuevaLinea, presentaciones, resumenEmpaques } from "../lib/pedido";
import { desgloseCombo, importeCombo } from "../lib/combo";

/** Lo que la calculadora agrega al pedido: un producto y cómo queda su línea. */
export interface Agregado {
  productoId: string;
  cambios: Partial<Linea>;
}

const EXTRAS: Array<[ExtraCena, string]> = [
  ["romeritos", "Romeritos"],
  ["bacalao", "Bacalao"],
  ["panes", "Chapatas"],
  ["postre", "Postre (strudel)"],
];

/** Productos de cada extra. Si ninguno se puede pedir (eliminado, oculto o agotado), el extra no se ofrece. */
const PRODUCTOS_EXTRA: Record<ExtraCena, string[]> = {
  romeritos: ["romeritos"],
  bacalao: ["bacalao"],
  panes: ["chapata"],
  postre: ["strudel", "strudel-individual"],
};
/** Cómo se nombra cada extra en "Qué cena". */
const NOMBRE_EXTRA: Record<ExtraCena, string> = { romeritos: "romeritos", bacalao: "bacalao", panes: "chapatas", postre: "postre" };

/** "a", "a y b", "a, b y c". */
const enLista = (xs: string[]) => (xs.length < 2 ? xs.join("") : `${xs.slice(0, -1).join(", ")} y ${xs[xs.length - 1]}`);

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
): () => void {
  const p = (id: string) => catalogo.find((x) => x.id === id);
  const hayExtra = (k: ExtraCena) => PRODUCTOS_EXTRA[k].some((id) => {
    const x = p(id);
    return !!x && !agotado(x);
  });
  /** Lo que incluye cada cena, solo con los extras que se pueden pedir hoy. */
  const incluye = (t: TipoCena): string => {
    const de = (tc: TipoCena) => (Object.keys(tiposCena[tc].extras) as ExtraCena[]).filter((k) => tiposCena[tc].extras[k] && hayExtra(k));
    if (t === "basica") return enLista(["Carne", "pasta", "ensalada", ...de("basica").map((k) => NOMBRE_EXTRA[k])]);
    const mas = de(t).filter((k) => !tiposCena.basica.extras[k]).map((k) => NOMBRE_EXTRA[k]);
    return mas.length ? `Lo de la básica + ${enLista(mas)}` : "Lo de la básica";
  };

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

  let personas: number = cfg.sugeridas[0];
  const total = () => personas;
  /** Siempre se propone primero la pechuga de pavo horneada (si no hay, la primera carne disponible). */
  const recomendada = () => {
    const pechuga = carnes.find((c) => c.id === "pechuga-pavo:Horneada");
    return pechuga && !agotado(p(pechuga.productoId)!) ? pechuga.id : (carnes.find((c) => permitida(c) && !agotado(p(c.productoId)!))?.id ?? carnes[0]!.id);
  };
  /** La primera carne sigue a la recomendación hasta que el cliente la cambie. */
  let elegidas: string[] = [recomendada()];
  let primeraTocada = false;
  const espagueti = p("espagueti");
  let pastaId = espagueti?.versiones?.[0] ? `espagueti:${espagueti.versiones[0]}` : "espagueti";
  let tipo: TipoCena = "completa";
  let extras: Record<ExtraCena, boolean> = { ...tiposCena[tipo].extras };
  /** Combo Pavo en lugar de la carne (solo en cenas chicas). */
  let conCombo = false;
  const prodCombo = p("combo-pavo");
  const comboPosible = () => !!prodCombo && !agotado(prodCombo) && total() >= cfgCombo.minPersonas && total() <= cfgCombo.hastaPersonas;
  const usaCombo = () => conCombo && comboPosible();
  let presentacion: Presentacion = "acrilico";

  const variasPermitidas = () => total() >= cfg.desdeVariasCarnes;

  /** Las carnes que se ofrecen para este número de personas (el pavo entero solo en cenas más grandes). */
  const permitida = (c: Carne) => pavoPermitido(p(c.productoId)!, total());

  const opcionesCarne = (actual: string) => {
    const grupo = (cat: string, titulo: string) =>
      `<optgroup label="${titulo}">${carnes
        .filter((c) => p(c.productoId)?.categoria === cat && permitida(c))
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

  /** "medio pavo (3 a 4 kg)", "1 pavo de aprox. 6 kg", "1 pavo de aprox. 6 kg + medio pavo (3 a 4 kg)". */
  const textoPavos = (pavos: ReturnType<typeof pavosCena>): string => {
    const enteros = pavos.filter((v) => v.tamano === "completo");
    const medios = pavos.filter((v) => v.tamano === "medio").length;
    const partes: string[] = [];
    if (enteros.length) partes.push(`${enteros.length} ${enteros.length === 1 ? "pavo" : "pavos"} de aprox. ${kilos(enteros[0]!.kgPorPavo)}`);
    if (medios) partes.push(medios === 1 ? "medio pavo (3 a 4 kg)" : `${medios} medios pavos (3 a 4 kg)`);
    return partes.join(" + ");
  };

  type Fila = { nombre: string; detalle?: string; cantidad: string; importe: number; agregado: Agregado[] };

  /** Renglones del resultado con lo que se agregaría. */
  const plan = (c: Cena): Fila[] => {
    const filas: Fila[] = [];
    const partes = repartirCarne(c.carne, elegidas.length);
    if (usaCombo()) {
      const d = desgloseCombo(c.personas);
      filas.push({
        nombre: "Combo Pavo",
        detalle: `Pechuga ${kilos(d.kgPechuga)} · relleno ${kilos(d.kgRelleno)} · ${d.piernas} piernas`,
        cantidad: `para ${d.personas}`,
        importe: importeCombo(prodCombo!, d.personas),
        agregado: [{ productoId: prodCombo!.id, cambios: { cantidad: d.personas, presentacion: "charola" } }],
      });
    }
    (usaCombo() ? [] : elegidas).forEach((id, n) => {
      const ca = carne(id);
      const x = p(ca.productoId);
      const kg = partes[n];
      if (!x || !kg) return;
      if (x.pavoEntero) {
        const pavos = pavosCena(c.equivalentes, c.personas, elegidas.length, kgMinimoPavo(x), !x.soloCompleto);
        const lineas = pavos.map((v) => linea(x, { cantidad: 1, tamano: v.tamano, kgPorPavo: v.kgPorPavo }));
        filas.push({
          nombre: nombreCarne(ca),
          cantidad: textoPavos(pavos),
          importe: lineas.reduce((a, l) => a + importeProducto(x, l), 0),
          agregado: lineas.map((l) => ({ productoId: x.id, cambios: l })),
        });
      } else {
        const l = linea(x, { cantidad: kg, version: ca.estilo ?? "" });
        filas.push({ nombre: nombreCarne(ca), cantidad: kilos(kg), importe: importeProducto(x, l), agregado: [{ productoId: x.id, cambios: l }] });
      }
    });
    const porKilo = (id: string, kg: number, version = "") => {
      const x = p(id);
      if (!x || !kg || agotado(x)) return;
      const l = linea(x, { cantidad: kg, version });
      filas.push({ nombre: version ? `${x.nombre} ${version.toLowerCase()}` : x.nombre, cantidad: kilos(kg), importe: importeProducto(x, l), agregado: [{ productoId: id, cambios: l }] });
    };
    const [pastaProd, pastaVer = ""] = pastaId.split(":") as [string, string?];
    porKilo(pastaProd, c.pasta, pastaVer);
    porKilo("ensalada-manzana", c.ensalada);
    if (extras.romeritos) porKilo("romeritos", c.romeritos);
    if (extras.bacalao) porKilo("bacalao", c.bacalao);
    const piezas = (id: string, n: number, extra = "") => {
      const x = p(id);
      if (!x || !n || agotado(x)) return;
      filas.push({ nombre: x.nombre, cantidad: `${n} ${n === 1 ? "pza" : "pzas"}${extra}`, importe: n * x.precio, agregado: [{ productoId: id, cambios: { cantidad: n } }] });
    };
    if (extras.panes) piezas("chapata", c.panes);
    if (extras.postre) {
      piezas("strudel", c.strudelGrande, " (para 10)");
      piezas("strudel-individual", c.strudelIndividual);
    }
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

  /**
   * Charolas o bolsas al vacío de todo lo que se agrega, cada tipo en su renglón con su precio
   * (así se ve qué cuesta el producto y qué cuesta el empaque). Es el mismo cálculo del pedido.
   */
  const renglonesEmpaque = (items: Agregado[]) => {
    const lineas: Record<string, Linea> = {};
    items.forEach((it, i) => {
      const x = p(it.productoId);
      if (x) lineas[String(i)] = { ...nuevaLinea(x), ...it.cambios };
    });
    return resumenEmpaques({ lineas, nombre: "", modo: "tienda", alcaldia: "", direccion: "", referencias: "", nota: "", fecha: null }, catalogo).empaques;
  };

  const res = () => raiz.querySelector<HTMLElement>("#calcRes")!;

  const pintarResultado = () => {
    const c = calcularCena(personas);
    const hayPavo = elegidas.some((id) => p(carne(id).productoId)?.pavoEntero);
    raiz.querySelector<HTMLElement>("#calcNotaPavo")!.hidden = !(hayPavo && presentacion === "acrilico");
    raiz.querySelectorAll<HTMLButtonElement>("[data-sugerida]").forEach((b) => b.setAttribute("aria-pressed", String(Number(b.dataset.sugerida) === c.personas)));
    pintarCombo();
    if (!c.personas) {
      res().innerHTML = `<p class="calc-vacio">Dinos cuántos serán en tu cena y te decimos cuánto pedir.</p>`;
      return;
    }
    const filas = plan(c);
    const emp = renglonesEmpaque(juntar(filas.flatMap((f) => f.agregado)));
    const suma = filas.reduce((a, f) => a + f.importe, 0) + emp.reduce((a, e) => a + e.importe, 0);
    const pz = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;
    res().innerHTML = `
      <h3>Cena ${escapar(tiposCena[tipo].nombre.toLowerCase())} para ${c.personas} ${c.personas === 1 ? "persona" : "personas"}</h3>
      <ul class="calc-lista">${filas
        .map((f) => `<li><span>${escapar(f.nombre)}${f.detalle ? `<small>${escapar(f.detalle)}</small>` : ""}</span><b>${escapar(f.cantidad)}</b><span class="num">${dinero(Math.round(f.importe))}</span></li>`)
        .join("")}
        ${emp
          .map((e) => `<li class="calc-emp"><span>${escapar(e.nombre)}<small>${escapar(e.tamanos)}</small></span><b>${escapar(pz(e.piezas, e.presentacion === "charola" ? "charola" : "bolsa", e.presentacion === "charola" ? "charolas" : "bolsas"))}</b><span class="num">${dinero(Math.round(e.importe))}</span></li>`)
          .join("")}
      </ul>
      ${usaCombo() ? `<p class="calc-nota">El precio del combo varía según el peso de las piernas (estimamos ${Math.round(cfgCombo.kgPorPierna * 1000)} g cada una).</p>` : ""}
      <div class="calc-total"><span>Total aproximado</span><b class="num">${dinero(Math.round(suma))}</b></div>
      <button class="btn btn-wa" type="button" id="calcAgregar">Agregar todo a mi pedido</button>
      <p class="calc-aviso"><b>Es una recomendación.</b> La hacemos con nuestra experiencia de muchos años, calculando un promedio para que todos coman bien y puedan repetir un poco. Cada familia y cada cena es diferente, así que no podemos garantizar que no falte o sobre comida. Después de agregarlo puedes subir, bajar o quitar cada producto desde <b>Tu pedido</b>.</p>`;
    res().querySelector("#calcAgregar")?.addEventListener("click", () => alAgregar(juntar(filas.flatMap((f) => f.agregado)), c.personas));
  };

  /** Anuncio del Combo Pavo en cenas chicas; al usarlo, ocupa el lugar de la carne. */
  const pintarCombo = () => {
    const caja = raiz.querySelector<HTMLElement>("#calcCombo")!;
    const campoCarne = raiz.querySelector<HTMLElement>("#calcCarneCampo")!;
    campoCarne.hidden = usaCombo();
    if (!comboPosible()) {
      caja.hidden = true;
      return;
    }
    caja.hidden = false;
    const d = desgloseCombo(total());
    const precio = dinero(Math.round(importeCombo(prodCombo!, d.personas)));
    caja.classList.toggle("on", usaCombo());
    caja.innerHTML = `<div class="calc-combo-txt">
        <span class="calc-combo-tag">${usaCombo() ? "✓ En tu cena" : `Para ${cfgCombo.hastaPersonas} personas o menos`}</span>
        <b>Combo Pavo</b>
        <span>Pechuga de pavo (${kilos(d.kgPechuga)}), relleno (${kilos(d.kgRelleno)}) y ${d.piernas} piernas de pavo, todo en una misma charola. Aprox. <b class="num">${precio}</b> para ${d.personas}.</span>
      </div>
      <button type="button" class="btn ${usaCombo() ? "btn-ghost" : "btn-wa"} btn-sm" id="calcComboBtn" aria-pressed="${usaCombo()}">${usaCombo() ? "Mejor otra carne" : "Usar combo"}</button>`;
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
    // Si lo elegido ya no se ofrece con este número de personas (ej. un pavo en una cena de 4), se cambia por la recomendada.
    elegidas = elegidas.map((id) => (permitida(carne(id)) ? id : permitida(carne(recomendada())) ? recomendada() : carnes.find(permitida)!.id));
    pintarCarnes();
    pintarResultado();
  };

  raiz.innerHTML = `
    <div class="calc-form">
      <div class="calc-sugeridas">
        <span class="calc-etq">1. ¿Cuántos son?</span>
        <div class="calc-cuantos">
          <div class="seg">${cfg.sugeridas
            .map((n) => `<button type="button" data-sugerida="${n}" aria-pressed="false">${n} <small>personas</small></button>`)
            .join("")}</div>
          <div class="qty" aria-label="Otro número de personas"><button type="button" data-calc="-1" aria-label="Una persona menos">−</button>
            <input class="num" type="number" inputmode="numeric" min="0" max="${MAX}" value="${personas}" id="calcN" aria-label="Personas">
            <button type="button" data-calc="1" aria-label="Una persona más">+</button></div>
        </div>
        <p class="calc-nota">Todos cuentan igual: niños, adolescentes y adultos.</p>
      </div>
      <fieldset class="calc-campo calc-tipos-campo"><legend class="calc-etq">2. ¿Qué cena?</legend>
        <div class="calc-tipos">${(Object.keys(tiposCena) as TipoCena[])
          .map(
            (t) => `<label class="calc-tipo"><input type="radio" name="calcTipo" value="${t}"${t === tipo ? " checked" : ""}>
              <span><b>${escapar(tiposCena[t].nombre)}</b><small data-incluye="${t}">${escapar(incluye(t))}</small></span></label>`,
          )
          .join("")}</div>
      </fieldset>
      <div class="calc-elige">
        <span class="calc-etq">3. Ajústala a tu gusto</span>
        <div class="calc-combo" id="calcCombo" hidden></div>
        <div class="calc-campo" id="calcCarneCampo"><span class="calc-sub">Carne</span><div id="calcCarnes"></div></div>
        <label class="calc-campo"><span class="calc-sub">Pasta</span><select id="calcPasta">${["espagueti", "ravioles"]
          .map((id) => p(id))
          .filter((x): x is Producto => !!x)
          .flatMap((x) => (x.versiones?.length ? x.versiones.map((ver) => [x, ver] as const) : [[x, ""] as const]))
          .map(([x, ver]) => {
            const valor = ver ? `${x.id}:${ver}` : x.id;
            return `<option value="${escapar(valor)}"${valor === pastaId ? " selected" : ""}${agotado(x) ? " disabled" : ""}>${escapar(ver ? `${x.nombre} ${ver.toLowerCase()}` : x.nombre)}</option>`;
          })
          .join("")}</select></label>
        <fieldset class="calc-campo"><legend class="calc-sub">Incluye (toca para quitar o agregar)</legend>
          <div class="calc-extras">${EXTRAS.map(
            ([k, t]) => `<label class="calc-chk"${hayExtra(k) ? "" : " hidden"}><input type="checkbox" data-extra="${k}"${extras[k] ? " checked" : ""}><span>${t}</span></label>`,
          ).join("")}</div>
        </fieldset>
        <div class="calc-campo"><span class="calc-sub">Presentación para todo</span>
          <div class="seg seg-3" id="calcPres">${PRESENTACIONES.map(
            ([v, t, s]) => `<button type="button" data-pres-calc="${v}" aria-pressed="${v === presentacion}">${t}<small>${s}</small></button>`,
          ).join("")}</div>
          <p class="calc-nota" id="calcNotaPavo" hidden>El pavo entero no cabe en acrílico: va en bolsa o caja de cartón, sin costo.</p>
        </div>
      </div>
    </div>
    <div class="calc-res" id="calcRes" aria-live="polite"></div>`;

  const ponerPersonas = (n: number) => {
    personas = Math.min(MAX, Math.max(0, Math.floor(Number.isFinite(n) ? n : 0)));
    raiz.querySelector<HTMLInputElement>("#calcN")!.value = String(personas);
    alCambiarPersonas();
  };

  raiz.addEventListener("click", (e) => {
    const t = (e.target as Element).closest<HTMLButtonElement>("button");
    if (!t) return;
    const d = t.dataset;
    if (d.calc) {
      ponerPersonas(personas + Number(d.calc));
    } else if (d.sugerida) {
      ponerPersonas(Number(d.sugerida));
    } else if (t.id === "calcComboBtn") {
      conCombo = !usaCombo();
      pintarResultado();
    } else if (t.id === "calcMas") {
      const usadas = new Set(elegidas);
      const otra = carnes.find((c) => !usadas.has(c.id) && permitida(c) && !agotado(p(c.productoId)!) && c.productoId !== carne(elegidas[0]!).productoId);
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
    if (el.id === "calcN") {
      const n = Math.floor(Number(el.value));
      personas = Number.isFinite(n) ? Math.min(MAX, Math.max(0, n)) : 0;
      alCambiarPersonas();
      return;
    }
    if (el.name === "calcTipo") {
      // La cena base pone sus extras; después el cliente puede prender o apagar cada uno.
      tipo = el.value as TipoCena;
      extras = { ...tiposCena[tipo].extras };
      raiz.querySelectorAll<HTMLInputElement>("[data-extra]").forEach((c) => (c.checked = extras[c.dataset.extra as ExtraCena]));
      pintarResultado();
      return;
    }
    if (el.dataset.carne) {
      const n = Number(el.dataset.carne);
      elegidas[n] = el.value;
      if (n === 0) primeraTocada = true;
    } else if (el.id === "calcPasta") pastaId = el.value;
    else if (el.dataset.extra) extras[el.dataset.extra as ExtraCena] = el.checked;
    else return;
    pintarResultado();
  });
  raiz.addEventListener("change", (e) => {
    const el = e.target as HTMLInputElement;
    if (el.id === "calcN") el.value = String(personas);
  });
  /** El texto de arriba de la calculadora ("Básica (…) o Todo incluido (…)") también sigue al catálogo. */
  const pintarReco = () =>
    document.querySelectorAll<HTMLElement>("[data-reco]").forEach((el) => {
      const t = el.dataset.reco as TipoCena;
      const txt = incluye(t);
      el.textContent = t === "basica" ? txt.toLowerCase() : txt.startsWith("Lo de la básica + ") ? `además ${txt.slice(18)}` : "lo mismo que la básica";
    });

  pintarCarnes();
  pintarResultado();
  pintarReco();

  /** Cuando llega el catálogo de Firestore: quita los extras que ya no se pueden pedir y recalcula. */
  return () => {
    raiz.querySelectorAll<HTMLInputElement>("[data-extra]").forEach((c) => {
      c.closest<HTMLElement>(".calc-chk")!.hidden = !hayExtra(c.dataset.extra as ExtraCena);
    });
    raiz.querySelectorAll<HTMLElement>("[data-incluye]").forEach((el) => (el.textContent = incluye(el.dataset.incluye as TipoCena)));
    pintarReco();
    pintarResultado();
  };
}
