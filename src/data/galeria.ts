/**
 * Fotos de los platillos, en el orden en que se muestran. Cada una vive en public/img/galeria/<id>.jpg.
 * - disponible: false la oculta este año (la foto se queda guardada para cuando vuelva el platillo).
 * - forma: "h" si la foto es horizontal, "v" si es vertical (en la galería las verticales miden el doble de alto).
 * - ancha: true la muestra a lo ancho de dos columnas en la galería.
 *   El orden está pensado para que la cuadrícula no deje huecos en compu (3 columnas), en celular (2)
 *   ni en las primeras 8 fotos que se ven en celular antes de "Ver más fotos".
 * - carrusel: false la deja solo en la página de galería (para no repetir platillo en el carrusel del inicio).
 * - producto: id del producto de la web (data/productos.ts) al que pertenece. Si ese producto se
 *   oculta en el súper panel, la foto desaparece; si está agotado, sale con la marca "Agotado".
 *   Cuando al producto se le suben fotos desde el panel, esas reemplazan a las de aquí.
 *   Sin producto, la foto se muestra siempre.
 */
export interface FotoGaleria {
  id: string;
  nombre: string;
  forma: "h" | "v";
  ancha?: boolean;
  disponible?: boolean;
  carrusel?: boolean;
  producto?: string;
}

export const fotosPlatillos: FotoGaleria[] = [
  { id: "pavo-relleno", nombre: "Pavo relleno", forma: "h", ancha: true, producto: "pavo-relleno" },
  { id: "medio-pavo-relleno", nombre: "Medio pavo relleno", forma: "v", producto: "pavo-relleno" },
  { id: "ravioles-de-queso", nombre: "Ravioles de queso", forma: "v", producto: "ravioles" },
  { id: "lomo-a-la-espinaca", nombre: "Lomo a la espinaca", forma: "v" },
  { id: "lechon", nombre: "Lechón", forma: "h" },
  { id: "codornices", nombre: "Codornices", forma: "v" },
  { id: "ensalada-de-manzana", nombre: "Ensalada de manzana", forma: "v", producto: "ensalada-manzana" },
  { id: "pechuga-pavo-adobada", nombre: "Pechuga de pavo adobada", forma: "h", producto: "pechuga-pavo" },
  { id: "pavo-adobado", nombre: "Pavo adobado", forma: "v", producto: "pavo-adobado" },
  { id: "romeritos", nombre: "Romeritos", forma: "h", ancha: true, producto: "romeritos" },
  { id: "ravioles-de-queso-2", nombre: "Ravioles de queso", forma: "v", carrusel: false, producto: "ravioles" },
  { id: "pavo-ahumado", nombre: "Pavo ahumado", forma: "h", producto: "pavo-ahumado" },
  { id: "lomo-horneado", nombre: "Lomo horneado", forma: "h" },
  { id: "lomo-adobado-mechado", nombre: "Lomo adobado y mechado", forma: "h", producto: "lomo-adobado" },
  { id: "strudel-de-manzana", nombre: "Strudel de manzana", forma: "v", producto: "strudel" },
  { id: "pechuga-pavo-horneada", nombre: "Pechuga de pavo horneada", forma: "h", producto: "pechuga-pavo" },
  { id: "relleno", nombre: "Relleno tradicional", forma: "h", producto: "relleno" },
  { id: "lomo-mechado", nombre: "Lomo mechado", forma: "h", producto: "lomo-mechado" },
  { id: "espagueti-3-quesos", nombre: "Espagueti a los 3 quesos", forma: "h", producto: "espagueti" },
  { id: "bacalao", nombre: "Bacalao", forma: "h", producto: "bacalao" },
  // Este año no hay pierna: las fotos se quedan guardadas pero no se muestran.
  { id: "pierna-adobada", nombre: "Pierna adobada", forma: "v", disponible: false },
  { id: "pierna-adobada-2", nombre: "Pierna adobada", forma: "v", disponible: false },
  { id: "pierna-mechada", nombre: "Pierna mechada", forma: "v", disponible: false },
  { id: "pierna-mechada-2", nombre: "Pierna mechada", forma: "v", disponible: false },
];
