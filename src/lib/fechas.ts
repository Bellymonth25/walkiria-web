const diaSemana = new Intl.DateTimeFormat("es-MX", { weekday: "long" });

const mayuscula = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

/** "Miércoles 23 de diciembre" (el día de la semana se calcula para el año dado). */
export function nombreDia(anio: number, dia: number): string {
  return `${mayuscula(diaSemana.format(new Date(anio, 11, dia)))} ${dia} de diciembre`;
}

/** true si `hoy` es después del día límite y antes de Navidad: el pedido llega como tardío. */
export function esPedidoTardio(hoy: Date, anio: number, diaLimite: number): boolean {
  return hoy >= new Date(anio, 11, diaLimite + 1) && hoy < new Date(anio, 11, 25);
}
