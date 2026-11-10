import type { Linea, Producto } from "../types";
import { calcularCena, pavosPara, type Cena, type Grupo, type Personas } from "../lib/calculadora";
import { dinero, escapar, kilos } from "../lib/formato";

/** Lo que la calculadora agrega al pedido: un producto y cómo queda su línea. */
export interface Agregado {
  productoId: string;
  cambios: Partial<Linea>;
}

const GRUPOS: Array<[Grupo, string, string]> = [
  ["ninos", "Niños", "Hasta 11 años"],
  ["adolescentes", "Adolescentes", "Suelen comer más"],
  ["adultos", "Adultos", ""],
  ["mayores", "Personas mayores", ""],
];

const MAX = 60;

export function iniciarCalculadora(
  raiz: HTMLElement,
  catalogo: readonly Producto[],
  agotado: (p: Producto) => boolean,
  alAgregar: (items: Agregado[]) => void,
): void {
  const personas: Personas = { ninos: 0, adolescentes: 0, adultos: 4, mayores: 0 };
  const p = (id: string) => catalogo.find((x) => x.id === id);
  const carnes = catalogo.filter((x) => (x.categoria === "pavo" || x.categoria === "cerdo") && !x.pieza);
  let carneId = "pavo-relleno";
  let pastaId = "espagueti";
  let conRomeritos = true;
  let conBacalao = true;

  const opciones = (lista: readonly Producto[], actual: string) =>
    lista
      .map((x) => `<option value="${x.id}"${x.id === actual ? " selected" : ""}${agotado(x) ? " disabled" : ""}>${escapar(x.nombre)}${agotado(x) ? " (agotado)" : ""}</option>`)
      .join("");

  /** Renglones del resultado con lo que se agregaría. */
  const plan = (c: Cena) => {
    const filas: Array<{ nombre: string; cantidad: string; importe: number; agregado: Agregado[] }> = [];
    const carne = p(carneId);
    if (carne && c.carne) {
      if (carne.pavoEntero) {
        const pavos = pavosPara(c.carne);
        const kgTotal = pavos.reduce((a, x) => a + (x.tamano === "medio" ? 3.5 : x.kgPorPavo), 0);
        filas.push({
          nombre: carne.nombre,
          cantidad: pavos[0]?.tamano === "medio" ? "medio pavo (3 a 4 kg)" : `${pavos.length} ${pavos.length === 1 ? "pavo" : "pavos"} de aprox. ${kilos(pavos[0]!.kgPorPavo)}`,
          importe: kgTotal * carne.precio,
          agregado: pavos.map((x) => ({ productoId: carne.id, cambios: { cantidad: 1, tamano: x.tamano, kgPorPavo: x.kgPorPavo } })),
        });
      } else {
        filas.push({ nombre: carne.nombre, cantidad: kilos(c.carne), importe: c.carne * carne.precio, agregado: [{ productoId: carne.id, cambios: { cantidad: c.carne } }] });
      }
    }
    const porKilo = (id: string, kg: number) => {
      const x = p(id);
      if (x && kg) filas.push({ nombre: x.nombre, cantidad: kilos(kg), importe: kg * x.precio, agregado: [{ productoId: id, cambios: { cantidad: kg } }] });
    };
    porKilo(pastaId, c.pasta);
    porKilo("ensalada-manzana", c.ensalada);
    if (conRomeritos) porKilo("romeritos", c.romeritos);
    if (conBacalao) porKilo("bacalao", c.bacalao);
    const grande = p("strudel");
    const indiv = p("strudel-individual");
    if (grande && c.strudelGrande)
      filas.push({ nombre: grande.nombre, cantidad: `${c.strudelGrande} ${c.strudelGrande === 1 ? "pza" : "pzas"} (para 10)`, importe: c.strudelGrande * grande.precio, agregado: [{ productoId: grande.id, cambios: { cantidad: c.strudelGrande } }] });
    if (indiv && c.strudelIndividual)
      filas.push({ nombre: indiv.nombre, cantidad: `${c.strudelIndividual} ${c.strudelIndividual === 1 ? "pza" : "pzas"}`, importe: c.strudelIndividual * indiv.precio, agregado: [{ productoId: indiv.id, cambios: { cantidad: c.strudelIndividual } }] });
    return filas;
  };

  const pintarResultado = () => {
    const c = calcularCena(personas);
    const filas = plan(c);
    const total = filas.reduce((a, f) => a + f.importe, 0);
    const res = raiz.querySelector<HTMLElement>("#calcRes")!;
    if (!c.personas) {
      res.innerHTML = `<p class="calc-vacio">Dinos cuántos serán en tu cena y te decimos cuánto pedir.</p>`;
      return;
    }
    res.innerHTML = `
      <h3>Para ${c.personas} ${c.personas === 1 ? "persona" : "personas"} te sugerimos</h3>
      <ul class="calc-lista">${filas
        .map((f) => `<li><span>${escapar(f.nombre)}</span><b>${escapar(f.cantidad)}</b><span class="num">${dinero(Math.round(f.importe))}</span></li>`)
        .join("")}
        <li class="calc-pan"><span>Panecillo</span><b>${c.panes} ${c.panes === 1 ? "pza" : "pzas"}</b><span>1 por persona</span></li>
      </ul>
      <div class="calc-total"><span>Total aproximado</span><b class="num">${dinero(Math.round(total))}</b></div>
      <button class="btn btn-wa" type="button" id="calcAgregar">Agregar todo a mi pedido</button>
      <p class="fine">Es un cálculo aproximado. Después puedes ajustar cada producto en la lista de precios.</p>`;
    res.querySelector("#calcAgregar")?.addEventListener("click", () => alAgregar(filas.flatMap((f) => f.agregado)));
  };

  raiz.innerHTML = `
    <div class="calc-form">
      <div class="calc-grupos">${GRUPOS.map(
        ([g, nombre, nota]) => `<div class="calc-grupo">
          <span class="calc-nombre">${nombre}${nota ? `<small>${nota}</small>` : ""}</span>
          <div class="qty"><button type="button" data-calc="${g}:-1" aria-label="Menos ${nombre}">−</button>
          <input class="num" type="number" inputmode="numeric" min="0" max="${MAX}" value="${personas[g]}" data-calcn="${g}" aria-label="${nombre}">
          <button type="button" data-calc="${g}:1" aria-label="Más ${nombre}">+</button></div></div>`,
      ).join("")}</div>
      <div class="calc-elige">
        <label>Carne<select id="calcCarne">${opciones(carnes, carneId)}</select></label>
        <label>Pasta<select id="calcPasta">${opciones([p("espagueti"), p("ravioles")].filter((x): x is Producto => !!x), pastaId)}</select></label>
        <fieldset><legend>Extra</legend>
          <label class="chk"><input type="checkbox" id="calcRom" checked> Romeritos</label>
          <label class="chk"><input type="checkbox" id="calcBac" checked> Bacalao</label>
        </fieldset>
      </div>
    </div>
    <div class="calc-res" id="calcRes" aria-live="polite"></div>`;

  raiz.addEventListener("click", (e) => {
    const b = (e.target as Element).closest<HTMLButtonElement>("[data-calc]");
    if (!b) return;
    const [g, d] = b.dataset.calc!.split(":") as [Grupo, string];
    personas[g] = Math.min(MAX, Math.max(0, personas[g] + Number(d)));
    raiz.querySelector<HTMLInputElement>(`[data-calcn="${g}"]`)!.value = String(personas[g]);
    pintarResultado();
  });
  raiz.addEventListener("input", (e) => {
    const el = e.target as HTMLInputElement;
    if (el.dataset.calcn) {
      const n = Math.floor(Number(el.value));
      personas[el.dataset.calcn as Grupo] = Number.isFinite(n) ? Math.min(MAX, Math.max(0, n)) : 0;
    } else if (el.id === "calcCarne") carneId = el.value;
    else if (el.id === "calcPasta") pastaId = el.value;
    else if (el.id === "calcRom") conRomeritos = el.checked;
    else if (el.id === "calcBac") conBacalao = el.checked;
    else return;
    pintarResultado();
  });
  raiz.addEventListener("change", (e) => {
    const el = e.target as HTMLInputElement;
    if (el.dataset.calcn) el.value = String(personas[el.dataset.calcn as Grupo]);
  });
  pintarResultado();
}
