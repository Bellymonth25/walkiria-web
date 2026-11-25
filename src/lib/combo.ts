import type { OpcionParte, ParteReceta, Producto, RecetaResuelta } from "../types";
import { combo } from "../data/temporada";
import { kilos } from "./formato";

/** Productos de la lista que forman el combo (para precio y agotados). */
export const COMPONENTES_COMBO = { pechuga: "pechuga-pavo", relleno: "relleno", pierna: "pierna-pavo" } as const;

/** Lo que la página necesita de la línea para armar el combo. */
export interface SeleccionCombo {
  cantidad: number;
  comboVersiones?: Record<string, string>;
  comboQuitados?: readonly string[];
}

/** Una parte ya calculada: qué producto es, cuánto lleva y cuánto cuesta. */
export interface ParteCombo {
  clave: string;
  nombre: string;
  /** La versión elegida (o la única). undefined si todas sus opciones están agotadas. */
  elegida?: OpcionParte;
  opciones: readonly OpcionParte[];
  /** Kg o piezas. */
  cantidad: number;
  unidad: "GRANEL" | "PIEZA";
  /** Kilos aproximados cuando se vende por pieza (2 piernas ≈ 1.4 kg). */
  kgAprox?: number;
  importe: number;
  /** false cuando el cliente la quitó o no hay ninguna opción disponible. */
  incluida: boolean;
  opcional: boolean;
}

export interface DesgloseCombo {
  personas: number;
  partes: readonly ParteCombo[];
  importe: number;
  /** false cuando falta una parte obligatoria: el combo no se puede pedir. */
  seVende: boolean;
}

/** Hacia arriba, en pasos de [paso] (0.4 kg en pasos de 0.125 → 0.5 kg). */
const haciaArriba = (valor: number, paso: number): number => (paso > 0 ? Math.round(Math.ceil(valor / paso - 1e-9) * paso * 1e6) / 1e6 : valor);

/**
 * La receta con la que se arma el combo: la que publicó la app o, si todavía no llega, la
 * configuración de la página (así el combo nunca se queda sin precio ni desglose).
 */
export function recetaDe(p: Producto): RecetaResuelta | null {
  if (p.receta?.partes.length) return p.receta;
  if (!p.combo) return null;
  const parte = (clave: string, nombre: string, extra: Partial<ParteReceta>): ParteReceta => ({
    clave,
    nombre,
    opciones: [{ id: clave, nombre, precio: 0, unidad: "kg" }],
    alAgregar: clave,
    modo: "POR_PERSONA",
    cantidad: 0,
    unidad: "GRANEL",
    minimo: combo.minimoKg,
    ...extra,
  });
  return {
    personas: { minimo: combo.minPersonas, alAgregar: combo.personasDefault, maximo: combo.hastaPersonas },
    redondeoKg: 0.125,
    empaque: { alAgregar: "CHAROLA_MEDIANA", permitidos: ["CHAROLA_MEDIANA"] },
    partes: [
      parte("pechuga", `Pechuga de pavo ${combo.versionPechuga.toLowerCase()}`, {
        cantidad: combo.pechugaKgPorPersona,
        opciones: [{ id: "pechuga", nombre: `Pechuga de pavo ${combo.versionPechuga.toLowerCase()}`, precio: p.combo.pechuga, unidad: "kg" }],
      }),
      parte("relleno", "Relleno tradicional", {
        cantidad: combo.rellenoKgPorPersona,
        opciones: [{ id: "relleno", nombre: "Relleno tradicional", precio: p.combo.relleno, unidad: "kg" }],
      }),
      parte("piernas", `Piernas de pavo ${combo.versionPierna.toLowerCase()}s`, {
        modo: "FIJA",
        cantidad: combo.piernas,
        unidad: "PIEZA",
        minimo: 0,
        kgPorPieza: combo.kgPorPierna,
        opciones: [{ id: "piernas", nombre: `Piernas de pavo ${combo.versionPierna.toLowerCase()}s`, precio: p.combo.pierna, unidad: "kg" }],
      }),
    ],
  };
}

/** Personas válidas para un combo (entre el mínimo y el máximo de su receta). */
export function personasCombo(p: Producto, n: number): number {
  const r = recetaDe(p);
  const { minimo, alAgregar, maximo } = r?.personas ?? { minimo: combo.minPersonas, alAgregar: combo.personasDefault, maximo: combo.hastaPersonas };
  return Math.min(maximo, Math.max(minimo, Math.round(Number.isFinite(n) ? n : alAgregar)));
}

export const minPersonasCombo = (p: Producto): number => recetaDe(p)?.personas.minimo ?? combo.minPersonas;
export const maxPersonasCombo = (p: Producto): number => recetaDe(p)?.personas.maximo ?? combo.hastaPersonas;
export const personasDefaultCombo = (p: Producto): number => recetaDe(p)?.personas.alAgregar ?? combo.personasDefault;

/** Cuánto lleva una parte: por persona (redondeado y con mínimo) o la cantidad fija. */
function cantidadDeParte(parte: ParteReceta, personas: number, redondeoKg: number): number {
  if (parte.modo === "FIJA") return parte.cantidad;
  const paso = parte.unidad === "PIEZA" ? 1 : redondeoKg;
  return Math.max(parte.minimo, haciaArriba(parte.cantidad * personas, paso));
}

/** Qué lleva el combo para cierto número de personas, con la versión que eligió el cliente. */
export function desgloseCombo(p: Producto, seleccion: SeleccionCombo): DesgloseCombo {
  const receta = recetaDe(p);
  if (!receta) return { personas: 0, partes: [], importe: 0, seVende: false };

  const personas = personasCombo(p, seleccion.cantidad);
  const quitados = seleccion.comboQuitados ?? [];

  const partes = receta.partes.map((parte): ParteCombo => {
    const disponibles = parte.opciones.filter((o) => !o.agotado);
    const elegidaId = seleccion.comboVersiones?.[parte.clave];
    const elegida = disponibles.find((o) => o.id === elegidaId) ?? disponibles.find((o) => o.id === parte.alAgregar) ?? disponibles[0];
    const cantidad = cantidadDeParte(parte, personas, receta.redondeoKg);
    const incluida = !!elegida && !quitados.includes(parte.clave);
    const kgAprox = parte.unidad === "PIEZA" && parte.kgPorPieza ? Math.round(cantidad * parte.kgPorPieza * 1e6) / 1e6 : undefined;
    return {
      clave: parte.clave,
      nombre: elegida?.nombre ?? parte.nombre,
      ...(elegida ? { elegida } : {}),
      opciones: parte.opciones,
      cantidad,
      unidad: parte.unidad,
      ...(kgAprox !== undefined ? { kgAprox } : {}),
      // Lo que se cobra: por pieza, o por kilo cuando el producto se vende por kilo
      // (2 piernas de 700 g se cobran como 1.4 kg).
      importe: incluida && elegida ? Math.round(elegida.precio * (elegida.unidad === "kg" && kgAprox !== undefined ? kgAprox : cantidad) * 100) / 100 : 0,
      incluida,
      opcional: parte.opcional === true,
    };
  });

  return {
    personas,
    partes,
    importe: Math.round(partes.reduce((a, x) => a + x.importe, 0) * 100) / 100,
    // Si falta una parte obligatoria el combo no se puede pedir; las opcionales solo se caen.
    seVende: partes.every((x) => x.opcional || !!x.elegida),
  };
}

/** Precio estimado del combo (sin la charola): cada parte por su precio. */
export const importeCombo = (p: Producto, seleccion: SeleccionCombo): number => desgloseCombo(p, seleccion).importe;

/** Un combo se puede pedir mientras cada parte obligatoria tenga una opción disponible. */
export const comboSeVende = (p: Producto): boolean => {
  const receta = recetaDe(p);
  if (!receta) return false;
  return receta.partes.filter((x) => x.opcional !== true).every((x) => x.opciones.some((o) => !o.agotado));
};

/** Cómo se escribe la cantidad de una parte: "0.5 kg" o "2 piernas (aprox. 700 g c/u)". */
function textoParte(x: ParteCombo): string {
  if (x.unidad !== "PIEZA") return `${x.nombre.toLowerCase()} ${kilos(x.cantidad)}`;
  const gramos = x.kgAprox && x.cantidad > 0 ? ` (aprox. ${Math.round((x.kgAprox / x.cantidad) * 1000)} g c/u)` : "";
  return `${x.cantidad} ${x.nombre.toLowerCase()}${gramos}`;
}

/** "Pechuga de pavo horneada 0.5 kg, relleno tradicional 0.5 kg y 2 piernas de pavo (aprox. 700 g c/u)". */
export function textoDesglose(p: Producto, seleccion: SeleccionCombo): string {
  const partes = desgloseCombo(p, seleccion).partes.filter((x) => x.incluida);
  const textos = partes.map(textoParte);
  if (textos.length <= 1) return textos[0] ?? "";
  return `${textos.slice(0, -1).join(", ")} y ${textos[textos.length - 1]}`;
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
