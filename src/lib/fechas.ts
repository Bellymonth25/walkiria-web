const diaSemana = new Intl.DateTimeFormat("es-MX", { weekday: "long" });
const nombreMes = new Intl.DateTimeFormat("es-MX", { month: "long" });

const mayuscula = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

/** Fecha local → "AAAA-MM-DD". */
export function aIso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** "AAAA-MM-DD" → fecha local a medianoche. */
export function deIso(iso: string): Date {
  const [a, m, d] = iso.split("-").map(Number) as [number, number, number];
  return new Date(a, m - 1, d);
}

export const inicioDelDia = (d: Date): Date => new Date(d.getFullYear(), d.getMonth(), d.getDate());

export function sumarDias(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
}

/** "Miércoles 23 de diciembre" */
export function nombreFecha(iso: string): string {
  const d = deIso(iso);
  return `${mayuscula(diaSemana.format(d))} ${d.getDate()} de ${nombreMes.format(d)}`;
}

/** "Noviembre 2026" */
export const tituloMes = (anio: number, mes: number): string => `${mayuscula(nombreMes.format(new Date(anio, mes, 1)))} ${anio}`;

/** Compatibilidad: "Jueves 24 de diciembre" para un día de diciembre. */
export function nombreDia(anio: number, dia: number): string {
  return nombreFecha(aIso(new Date(anio, 11, dia)));
}

/** true si `hoy` es después del día límite y antes de Navidad: el pedido llega como tardío. */
export function esPedidoTardio(hoy: Date, anio: number, diaLimite: number): boolean {
  return hoy >= new Date(anio, 11, diaLimite + 1) && hoy < new Date(anio, 11, 25);
}
