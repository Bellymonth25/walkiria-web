import type { Categoria, Producto } from "../types";

/**
 * Lista de precios pública.
 * Cada temporada solo hay que cambiar los precios aquí (y `notaPrecios` en temporada.ts).
 * Fuente actual: volante "Cenas de fin de año 2025".
 */
export const categorias: readonly Categoria[] = [
  { id: "pavo", nombre: "Pavo y pato" },
  { id: "cerdo", nombre: "Lomo y cerdo" },
  { id: "trad", nombre: "Bacalao y romeritos" },
  { id: "guarn", nombre: "Guarniciones y pastas" },
  { id: "pan", nombre: "Postres" },
  { id: "serv", nombre: "¿Le regalaron el pavo?" },
];

export const productos: readonly Producto[] = [
  { id: "pavo-relleno", nombre: "Pavo Relleno", categoria: "pavo", unidad: "kg", precio: 390, descripcion: "Con relleno tradicional. Por pieza o media pieza.", clasico: true },
  { id: "pavo-adobado", nombre: "Pavo Adobado", categoria: "pavo", unidad: "kg", precio: 390, descripcion: "Enchilado. Por pieza o media pieza." },
  { id: "pavo-ahumado", nombre: "Pavo Ahumado", categoria: "pavo", unidad: "kg", precio: 390, descripcion: "En pieza." },
  { id: "pechuga-pavo", nombre: "Pechuga de Pavo", categoria: "pavo", unidad: "kg", precio: 590, descripcion: "Mechada, horneada o adobada." },
  { id: "pierna-pavo", nombre: "Pierna de Pavo horneada", categoria: "pavo", unidad: "kg", precio: 200 },
  { id: "pato-naranja", nombre: "Pato a la Naranja", categoria: "pavo", unidad: "kg", precio: 500, descripcion: "Relleno de manzanas. Por pieza." },

  { id: "lomo-mechado", nombre: "Lomo Mechado", categoria: "cerdo", unidad: "kg", precio: 420, descripcion: "Con pasitas.", clasico: true },
  { id: "lomo-adobado", nombre: "Lomo Adobado", categoria: "cerdo", unidad: "kg", precio: 430, descripcion: "Enchilado.", clasico: true },
  { id: "lomo-ciruela", nombre: "Lomo a la Ciruela", categoria: "cerdo", unidad: "kg", precio: 450, descripcion: "Enrollado con ciruela y tocino." },
  { id: "costilla-cerdo", nombre: "Costilla de Cerdo horneada", categoria: "cerdo", unidad: "kg", precio: 350 },

  { id: "bacalao", nombre: "Bacalao", categoria: "trad", unidad: "kg", precio: 800, descripcion: "A la vizcaína, con aceitunas, almendras y aceite de oliva.", clasico: true },
  { id: "romeritos", nombre: "Romeritos", categoria: "trad", unidad: "kg", precio: 280, descripcion: "Con nopales, camarones y tortitas de camarón.", clasico: true },

  { id: "ensalada-manzana", nombre: "Ensalada de Manzana", categoria: "guarn", unidad: "kg", precio: 250, descripcion: "Con nuez, piña y apio.", clasico: true },
  { id: "relleno", nombre: "Relleno Tradicional", categoria: "guarn", unidad: "kg", precio: 390, descripcion: "Carne de cerdo y res, especias y fruta seca. También enchilado." },
  { id: "espagueti", nombre: "Espagueti", categoria: "guarn", unidad: "kg", precio: 250, descripcion: "A las finas hierbas o en salsa de 3 quesos." },
  { id: "ravioles", nombre: "Ravioles de Queso", categoria: "guarn", unidad: "kg", precio: 320 },

  { id: "strudel", nombre: "Strudel de Manzana", categoria: "pan", unidad: "pza", precio: 500, descripcion: "Pasta hojaldrada rellena de manzana. Para 10 personas.", clasico: true },
  { id: "strudel-individual", nombre: "Strudel Individual", categoria: "pan", unidad: "pza", precio: 40, descripcion: "Pasta hojaldrada rellena de manzana." },

  { id: "maquila", nombre: "Cocinamos su pavo", categoria: "serv", unidad: "kg", precio: 150, descripcion: "Usted trae su pavo y nosotros lo cocinamos. Se cobra por kilo de lo que pese." },
  { id: "maquila-relleno", nombre: "Relleno para su pavo", categoria: "serv", unidad: "kg", precio: 390, descripcion: "Si quiere que su pavo lleve relleno. Se cobra por kilo de relleno." },
];
