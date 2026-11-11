/**
 * Fotos de los platillos, en el orden en que se muestran. Cada una vive en public/img/galeria/<id>.jpg.
 * - disponible: false la oculta este año (la foto se queda guardada para cuando vuelva el platillo).
 * - carrusel: false la deja solo en la página de galería (para no repetir platillo en el carrusel del inicio).
 */
export interface FotoGaleria {
  id: string;
  nombre: string;
  disponible?: boolean;
  carrusel?: boolean;
}

export const fotosPlatillos: FotoGaleria[] = [
  { id: "pavo-relleno", nombre: "Pavo relleno" },
  { id: "medio-pavo-relleno", nombre: "Medio pavo relleno" },
  { id: "pavo-adobado", nombre: "Pavo adobado" },
  { id: "pavo-ahumado", nombre: "Pavo ahumado" },
  { id: "pechuga-pavo-horneada", nombre: "Pechuga de pavo horneada" },
  { id: "pechuga-pavo-adobada", nombre: "Pechuga de pavo adobada" },
  { id: "lomo-mechado", nombre: "Lomo mechado" },
  { id: "lomo-adobado-mechado", nombre: "Lomo adobado y mechado" },
  { id: "lomo-horneado", nombre: "Lomo horneado" },
  { id: "lomo-a-la-espinaca", nombre: "Lomo a la espinaca" },
  { id: "lechon", nombre: "Lechón" },
  { id: "codornices", nombre: "Codornices" },
  { id: "bacalao", nombre: "Bacalao" },
  { id: "romeritos", nombre: "Romeritos" },
  { id: "relleno", nombre: "Relleno tradicional" },
  { id: "ensalada-de-manzana", nombre: "Ensalada de manzana" },
  { id: "espagueti-3-quesos", nombre: "Espagueti a los 3 quesos" },
  { id: "ravioles-de-queso", nombre: "Ravioles de queso" },
  { id: "ravioles-de-queso-2", nombre: "Ravioles de queso", carrusel: false },
  { id: "strudel-de-manzana", nombre: "Strudel de manzana" },
  // Este año no hay pierna: las fotos se quedan guardadas pero no se muestran.
  { id: "pierna-adobada", nombre: "Pierna adobada", disponible: false },
  { id: "pierna-adobada-2", nombre: "Pierna adobada", disponible: false },
  { id: "pierna-mechada", nombre: "Pierna mechada", disponible: false },
  { id: "pierna-mechada-2", nombre: "Pierna mechada", disponible: false },
];
