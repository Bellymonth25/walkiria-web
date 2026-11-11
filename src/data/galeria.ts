/**
 * Fotos de los platillos, en el orden en que se muestran. Cada una vive en public/img/galeria/<id>.jpg.
 * - disponible: false la oculta este año (la foto se queda guardada para cuando vuelva el platillo).
 * - forma: "h" si la foto es horizontal, "v" si es vertical (en la galería las verticales miden el doble de alto).
 * - ancha: true la muestra a lo ancho de dos columnas en la galería.
 *   El orden está pensado para que la cuadrícula no deje huecos en compu (3 columnas), en celular (2)
 *   ni en las primeras 8 fotos que se ven en celular antes de "Ver más fotos".
 * - carrusel: false la deja solo en la página de galería (para no repetir platillo en el carrusel del inicio).
 */
export interface FotoGaleria {
  id: string;
  nombre: string;
  forma: "h" | "v";
  ancha?: boolean;
  disponible?: boolean;
  carrusel?: boolean;
}

export const fotosPlatillos: FotoGaleria[] = [
  { id: "pavo-relleno", nombre: "Pavo relleno", forma: "h", ancha: true },
  { id: "medio-pavo-relleno", nombre: "Medio pavo relleno", forma: "v" },
  { id: "ravioles-de-queso", nombre: "Ravioles de queso", forma: "v" },
  { id: "lomo-a-la-espinaca", nombre: "Lomo a la espinaca", forma: "v" },
  { id: "lechon", nombre: "Lechón", forma: "h" },
  { id: "codornices", nombre: "Codornices", forma: "v" },
  { id: "ensalada-de-manzana", nombre: "Ensalada de manzana", forma: "v" },
  { id: "pechuga-pavo-adobada", nombre: "Pechuga de pavo adobada", forma: "h" },
  { id: "pavo-adobado", nombre: "Pavo adobado", forma: "v" },
  { id: "romeritos", nombre: "Romeritos", forma: "h", ancha: true },
  { id: "ravioles-de-queso-2", nombre: "Ravioles de queso", forma: "v", carrusel: false },
  { id: "pavo-ahumado", nombre: "Pavo ahumado", forma: "h" },
  { id: "lomo-horneado", nombre: "Lomo horneado", forma: "h" },
  { id: "lomo-adobado-mechado", nombre: "Lomo adobado y mechado", forma: "h" },
  { id: "strudel-de-manzana", nombre: "Strudel de manzana", forma: "v" },
  { id: "pechuga-pavo-horneada", nombre: "Pechuga de pavo horneada", forma: "h" },
  { id: "relleno", nombre: "Relleno tradicional", forma: "h" },
  { id: "lomo-mechado", nombre: "Lomo mechado", forma: "h" },
  { id: "espagueti-3-quesos", nombre: "Espagueti a los 3 quesos", forma: "h" },
  { id: "bacalao", nombre: "Bacalao", forma: "h" },
  // Este año no hay pierna: las fotos se quedan guardadas pero no se muestran.
  { id: "pierna-adobada", nombre: "Pierna adobada", forma: "v", disponible: false },
  { id: "pierna-adobada-2", nombre: "Pierna adobada", forma: "v", disponible: false },
  { id: "pierna-mechada", nombre: "Pierna mechada", forma: "v", disponible: false },
  { id: "pierna-mechada-2", nombre: "Pierna mechada", forma: "v", disponible: false },
];
