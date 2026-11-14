import type { Producto } from "../types";
import { calculadora } from "../data/temporada";
import { pavo } from "../data/temporada";

export type Grupo = keyof typeof calculadora.factor;
export type Personas = Record<Grupo, number>;

export interface Cena {
  personas: number;
  /** Personas "adulto" equivalentes (los adolescentes cuentan más). */
  equivalentes: number;
  carne: number;
  pasta: number;
  ensalada: number;
  romeritos: number;
  bacalao: number;
  panes: number;
  strudelGrande: number;
  strudelIndividual: number;
}

/** Hacia arriba, al cuarto de kilo (lo mínimo que se vende). */
export const redondearKg = (kg: number): number => (kg <= 0 ? 0 : Math.ceil(kg * 4 - 1e-9) / 4);

export function calcularCena(p: Personas): Cena {
  const grupos = Object.keys(calculadora.factor) as Grupo[];
  const personas = grupos.reduce((a, g) => a + Math.max(0, Math.floor(p[g] || 0)), 0);
  const equivalentes = grupos.reduce((a, g) => a + Math.max(0, Math.floor(p[g] || 0)) * calculadora.factor[g], 0);
  const kg = (porcion: number) => redondearKg(equivalentes * porcion);
  const por = calculadora.porcionAdultoKg;
  // Postre: un strudel grande por cada 10 personas; las que sobran, individuales (o uno grande más si son 7 o más).
  let strudelGrande = Math.floor(personas / calculadora.personasPorStrudel);
  let strudelIndividual = personas % calculadora.personasPorStrudel;
  if (strudelIndividual >= 7) {
    strudelGrande += 1;
    strudelIndividual = 0;
  }
  return {
    personas,
    equivalentes,
    carne: kg(por.carne),
    pasta: kg(por.pasta),
    ensalada: kg(por.ensalada),
    romeritos: kg(por.romeritos),
    bacalao: kg(por.bacalao),
    panes: personas,
    strudelGrande,
    strudelIndividual,
  };
}

/** Cómo repartir los kilos de carne en pavos enteros: [tamaño, kg por pavo][] (máximo 9 kg por pavo). */
export function pavosPara(kg: number, minimo: number = pavo.kgMinimoCompleto, permitirMedio = true): Array<{ tamano: "completo" | "medio"; kgPorPavo: number }> {
  if (kg <= 0) return [];
  if (kg < minimo) return [{ tamano: permitirMedio ? "medio" : "completo", kgPorPavo: minimo }];
  const n = Math.ceil(kg / pavo.kgMaximoSugerido);
  const cada = Math.max(minimo, Math.ceil((kg / n) * 2) / 2);
  return Array.from({ length: n }, () => ({ tamano: "completo" as const, kgPorPavo: cada }));
}

/** Reparte los kilos de carne en partes iguales, cada una de al menos un cuarto de kilo. */
export function repartirCarne(kg: number, partes: number): number[] {
  if (kg <= 0 || partes < 1) return [];
  const cada = Math.max(0.25, redondearKg(kg / partes));
  return Array.from({ length: partes }, () => cada);
}

/**
 * Cuando lo que se necesita pasa del pavo más grande que se sugiere, se busca la combinación que
 * más se acerque sin quedarse corta: uno o varios pavos y, si conviene, un medio pavo
 * (ej. 9.4 kg → un pavo de 6 kg y un medio pavo, en vez de dos pavos de 6 kg).
 */
export function combinarPavos(kg: number, minimo: number, permitirMedio: boolean): ReturnType<typeof pavosPara> {
  const max = pavo.kgMaximoSugerido;
  const medio = pavo.kgMedio.estimado;
  let mejor: { enteros: number; cada: number; medio: number; sobra: number } | null = null;
  for (const m of permitirMedio ? [0, 1] : [0]) {
    for (let n = 1; n <= Math.ceil(kg / minimo) + 1; n++) {
      const total = Math.max(minimo * n, Math.ceil((kg - medio * m) * 2 - 1e-9) / 2);
      const cada = Math.ceil((total / n) * 2 - 1e-9) / 2;
      if (cada > max) continue;
      const sobra = cada * n + medio * m - kg;
      if (sobra < -1e-9) continue;
      const piezas = n + m;
      if (!mejor || sobra < mejor.sobra - 1e-9 || (Math.abs(sobra - mejor.sobra) < 1e-9 && piezas < mejor.enteros + mejor.medio)) mejor = { enteros: n, cada, medio: m, sobra };
    }
  }
  if (!mejor) return pavosPara(kg, minimo, permitirMedio);
  return [
    ...Array.from({ length: mejor.enteros }, () => ({ tamano: "completo" as const, kgPorPavo: mejor!.cada })),
    ...(mejor.medio ? [{ tamano: "medio" as const, kgPorPavo: minimo }] : []),
  ];
}

/**
 * Pavos de la cena. De 6 a 8 personas, medio pavo; desde 9, pavo entero de 0.55 kg por persona
 * (al medio kilo hacia arriba, nunca menos del mínimo) y, si pasa de 9 kg, repartido en varios (a veces un pavo y un medio).
 * Si la carne se reparte entre varias (`partes`), al pavo le toca su parte y puede quedar en medio pavo.
 */
export function pavosCena(equivalentes: number, personas: number, partes: number, minimo: number, permitirMedio: boolean): ReturnType<typeof pavosPara> {
  if (personas < calculadora.desdePavoCompleto && permitirMedio) return [{ tamano: "medio", kgPorPavo: minimo }];
  const kg = Math.ceil(((equivalentes * calculadora.porcionPavoKg) / Math.max(1, partes)) * 2 - 1e-9) / 2;
  const objetivo = partes <= 1 ? Math.max(minimo, kg) : kg;
  return objetivo > pavo.kgMaximoSugerido ? combinarPavos(objetivo, minimo, permitirMedio) : pavosPara(objetivo, minimo, permitirMedio);
}

/**
 * Si un producto se ofrece en la calculadora para cierto número de personas. El pavo entero no sale
 * en cenas chicas (sobraría muchísimo): desde 6 personas medio pavo, y desde 9 también el pavo que
 * solo se vende completo (ahumado).
 */
export function pavoPermitido(p: Producto, personas: number): boolean {
  if (!p.pavoEntero) return true;
  if (personas < calculadora.desdeMedioPavo) return false;
  return !p.soloCompleto || personas >= calculadora.desdePavoCompleto;
}
