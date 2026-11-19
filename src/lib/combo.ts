import type { Producto } from "../types";
import { combo } from "../data/temporada";
import { kilos } from "./formato";

/** Productos de la lista que forman el combo (para precio y agotados). */
export const COMPONENTES_COMBO = { pechuga: "pechuga-pavo", relleno: "relleno", pierna: "pierna-pavo" } as const;

export interface DesgloseCombo {
  personas: number;
  kgPechuga: number;
  kgRelleno: number;
  piernas: number;
  kgPierna: number;
}

/** Hacia arriba, de 125 en 125 g. */
const alOctavo = (kg: number): number => Math.ceil(kg * 8 - 1e-9) / 8;

/** Personas válidas para un combo (entre el mínimo y el máximo). */
export const personasCombo = (n: number): number =>
  Math.min(combo.hastaPersonas, Math.max(combo.minPersonas, Math.round(Number.isFinite(n) ? n : combo.personasDefault)));

/** Qué lleva un combo para cierto número de personas. */
export function desgloseCombo(personas: number): DesgloseCombo {
  const n = personasCombo(personas);
  return {
    personas: n,
    kgPechuga: Math.max(combo.minimoKg, alOctavo(n * combo.pechugaKgPorPersona)),
    kgRelleno: Math.max(combo.minimoKg, alOctavo(n * combo.rellenoKgPorPersona)),
    piernas: combo.piernas,
    kgPierna: combo.kgPorPierna,
  };
}

/** Precio estimado del combo (sin la charola): cada parte por su precio por kilo. */
export function importeCombo(p: Producto, personas: number): number {
  const pr = p.combo;
  if (!pr) return 0;
  const d = desgloseCombo(personas);
  return Math.round((d.kgPechuga * pr.pechuga + d.kgRelleno * pr.relleno + d.piernas * d.kgPierna * pr.pierna) * 100) / 100;
}

/** "Pechuga de pavo horneada 0.5 kg, relleno 0.5 kg y 2 piernas de pavo horneadas (aprox. 700 g c/u)". */
export function textoDesglose(personas: number): string {
  const d = desgloseCombo(personas);
  const g = Math.round(d.kgPierna * 1000);
  return `Pechuga de pavo ${combo.versionPechuga.toLowerCase()} ${kilos(d.kgPechuga)}, relleno tradicional ${kilos(d.kgRelleno)} y ${d.piernas} piernas de pavo ${combo.versionPierna.toLowerCase()}s (aprox. ${g} g c/u)`;
}

/** Copia a cada combo el precio actual (de Firestore) de pechuga, relleno y pierna. */
export function resolverCombos(lista: Producto[]): Producto[] {
  const precio = (id: string) => lista.find((x) => x.id === id)?.precio;
  return lista.map((p) =>
    p.combo
      ? {
          ...p,
          combo: {
            pechuga: precio(COMPONENTES_COMBO.pechuga) ?? p.combo.pechuga,
            relleno: precio(COMPONENTES_COMBO.relleno) ?? p.combo.relleno,
            pierna: precio(COMPONENTES_COMBO.pierna) ?? p.combo.pierna,
          },
        }
      : p,
  );
}
