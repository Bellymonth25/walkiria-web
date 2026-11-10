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

/** Cómo repartir los kilos de carne en pavos enteros: [tamaño, kg por pavo][] (máximo ~10 kg por pavo). */
export function pavosPara(kg: number): Array<{ tamano: "completo" | "medio"; kgPorPavo: number }> {
  if (kg <= 0) return [];
  if (kg < pavo.kgMinimoCompleto) return [{ tamano: "medio", kgPorPavo: pavo.kgMinimoCompleto }];
  const n = Math.ceil(kg / 10);
  const cada = Math.max(pavo.kgMinimoCompleto, Math.ceil((kg / n) * 2) / 2);
  return Array.from({ length: n }, () => ({ tamano: "completo" as const, kgPorPavo: cada }));
}

/** Reparte los kilos de carne en partes iguales, cada una de al menos un cuarto de kilo. */
export function repartirCarne(kg: number, partes: number): number[] {
  if (kg <= 0 || partes < 1) return [];
  const cada = Math.max(0.25, redondearKg(kg / partes));
  return Array.from({ length: partes }, () => cada);
}
