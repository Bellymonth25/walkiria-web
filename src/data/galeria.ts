/**
 * Fotos de los platillos, en el orden en que se muestran. Cada una vive en public/img/galeria/<id>.jpg.
 * - disponible: false la oculta este año (la foto se queda guardada para cuando vuelva el platillo).
 * - forma: "h" si la foto es horizontal, "v" si es vertical (la galería las acomoda en mosaico según su forma).
 * - destacada: true la muestra más grande en la galería.
 * - carrusel: false la deja solo en la página de galería (para no repetir platillo en el carrusel del inicio).
 */
export interface FotoGaleria {
  id: string;
  nombre: string;
  forma: "h" | "v";
  destacada?: boolean;
  disponible?: boolean;
  carrusel?: boolean;
}

export const fotosPlatillos: FotoGaleria[] = [
  { id: "pavo-relleno", nombre: "Pavo relleno", forma: "h", destacada: true },
  { id: "medio-pavo-relleno", nombre: "Medio pavo relleno", forma: "v" },
  { id: "pavo-adobado", nombre: "Pavo adobado", forma: "v" },
  { id: "pechuga-pavo-adobada", nombre: "Pechuga de pavo adobada", forma: "h", destacada: true },
  { id: "lomo-a-la-espinaca", nombre: "Lomo a la espinaca", forma: "v" },
  { id: "codornices", nombre: "Codornices", forma: "v" },
  { id: "pavo-ahumado", nombre: "Pavo ahumado", forma: "h" },
  { id: "pechuga-pavo-horneada", nombre: "Pechuga de pavo horneada", forma: "h" },
  { id: "lechon", nombre: "Lechón", forma: "h", destacada: true },
  { id: "lomo-mechado", nombre: "Lomo mechado", forma: "h" },
  { id: "lomo-adobado-mechado", nombre: "Lomo adobado y mechado", forma: "h" },
  { id: "ensalada-de-manzana", nombre: "Ensalada de manzana", forma: "v" },
  { id: "ravioles-de-queso", nombre: "Ravioles de queso", forma: "v" },
  { id: "romeritos", nombre: "Romeritos", forma: "h", destacada: true },
  { id: "lomo-horneado", nombre: "Lomo horneado", forma: "h" },
  { id: "bacalao", nombre: "Bacalao", forma: "h" },
  { id: "strudel-de-manzana", nombre: "Strudel de manzana", forma: "v" },
  { id: "relleno", nombre: "Relleno tradicional", forma: "h" },
  { id: "ravioles-de-queso-2", nombre: "Ravioles de queso", forma: "v", carrusel: false },
  { id: "espagueti-3-quesos", nombre: "Espagueti a los 3 quesos", forma: "h" },
  // Este año no hay pierna: las fotos se quedan guardadas pero no se muestran.
  { id: "pierna-adobada", nombre: "Pierna adobada", forma: "v", disponible: false },
  { id: "pierna-adobada-2", nombre: "Pierna adobada", forma: "v", disponible: false },
  { id: "pierna-mechada", nombre: "Pierna mechada", forma: "v", disponible: false },
  { id: "pierna-mechada-2", nombre: "Pierna mechada", forma: "v", disponible: false },
];
