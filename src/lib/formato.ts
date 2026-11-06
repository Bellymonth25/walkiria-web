const pesos = new Intl.NumberFormat("es-MX", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
const decimales = new Intl.NumberFormat("es-MX", { maximumFractionDigits: 2 });

export const dinero = (n: number): string => "$" + pesos.format(n);

/** "1.5 kg" con formato mexicano. */
export const kilos = (n: number): string => `${decimales.format(n)} kg`;

/** Para buscar sin importar acentos ni mayúsculas. */
export const normalizar = (s: string): string => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export const escapar = (s: string): string =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** "a, b y c" */
export const enLista = (xs: readonly string[]): string =>
  xs.length <= 1 ? (xs[0] ?? "") : `${xs.slice(0, -1).join(", ")} y ${xs[xs.length - 1]}`;
