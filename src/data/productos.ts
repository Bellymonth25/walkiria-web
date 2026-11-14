import type { Categoria, Producto } from "../types";

/**
 * Lista de precios pública.
 * Cada temporada solo hay que cambiar los precios aquí (y `notaPrecios` en temporada.ts).
 * Fuente actual: volante "Cenas de Fin de Año 2026" (volante-2026/ en la carpeta del proyecto).
 * `firebaseIds` sale de products/productos.json de la app: confirmar contra Firestore.
 */
/** Foto de la galería (public/img/galeria/<id>.jpg) y su miniatura (public/img/productos/<id>-mini.webp). */
const foto = (id: string) => ({ imagen: `img/galeria/${id}.jpg`, imagenMini: `img/productos/${id}-mini.webp` });

export const categorias: readonly Categoria[] = [
  { id: "pavo", nombre: "Pavo y pato" },
  { id: "cerdo", nombre: "Cerdo" },
  { id: "trad", nombre: "Bacalao y romeritos" },
  { id: "guarn", nombre: "Guarniciones y pastas" },
  { id: "pan", nombre: "Postres" },
  { id: "maquila", nombre: "Maquila: le cocinamos su carne a su gusto" },
];

export const productos: readonly Producto[] = [
  { id: "pavo-relleno", nombre: "Pavo Relleno", categoria: "pavo", unidad: "kg", precio: 400, descripcion: "Con nuestro relleno tradicional de carne de cerdo y res, especias y fruta seca.", clasico: true, pavoEntero: true, kgMinimoCompleto: 6, firebaseIds: ["PROD_001"], ...foto("pavo-relleno") },
  { id: "pavo-adobado", nombre: "Pavo Adobado", categoria: "pavo", unidad: "kg", precio: 400, descripcion: "Enchilado.", pavoEntero: true, firebaseIds: ["PROD_002"], ...foto("pavo-adobado") },
  { id: "pavo-ahumado", nombre: "Pavo Ahumado", categoria: "pavo", unidad: "kg", precio: 400, pavoEntero: true, soloCompleto: true, firebaseIds: ["PROD_003"], ...foto("pavo-ahumado") },
  { id: "pechuga-pavo", nombre: "Pechuga de Pavo", categoria: "pavo", unidad: "kg", precio: 590, descripcion: "Horneada, adobada o mechada.", versiones: ["Horneada", "Adobada", "Mechada"], firebaseIds: ["PROD_017", "PROD_018", "PROD_019"], ...foto("pechuga-pavo-horneada") },
  { id: "pierna-pavo", nombre: "Pierna de Pavo", categoria: "pavo", unidad: "kg", precio: 200, descripcion: "Horneada o adobada.", versiones: ["Horneada", "Adobada"], firebaseIds: ["PROD_032"] },
  { id: "pato-naranja", nombre: "Pato a la Naranja", categoria: "pavo", unidad: "kg", precio: 500, descripcion: "Relleno de manzanas. Se pide por pato y se cobra por peso: cada uno pesa de 1.8 a 2.2 kg.", pieza: { nombre: "pato", plural: "patos", kgMin: 1.8, kgMax: 2.2, kgEstimado: 2 }, firebaseIds: ["PROD_007"] },

  { id: "lomo-mechado", nombre: "Lomo Mechado", categoria: "cerdo", unidad: "kg", precio: 430, descripcion: "Con pasitas.", clasico: true, familia: "Lomo de Cerdo", opcion: "Mechado", firebaseIds: ["PROD_005"], ...foto("lomo-mechado") },
  { id: "lomo-adobado", nombre: "Lomo Adobado", categoria: "cerdo", unidad: "kg", precio: 440, descripcion: "Enchilado.", clasico: true, familia: "Lomo de Cerdo", opcion: "Adobado", firebaseIds: ["PROD_015"], ...foto("lomo-adobado-mechado") },
  { id: "lomo-ciruela", nombre: "Lomo a la Ciruela", categoria: "cerdo", unidad: "kg", precio: 465, descripcion: "Enrollado con ciruela y tocino.", familia: "Lomo de Cerdo", opcion: "A la ciruela", firebaseIds: ["PROD_034"] },
  { id: "costilla-cerdo", nombre: "Costilla de Cerdo horneada", categoria: "cerdo", unidad: "kg", precio: 360, familia: "Costilla de Cerdo", opcion: "Horneada", firebaseIds: ["PROD_021"] },
  // Nuevo para 2026. Sin id de Firestore: falta darlo de alta en la app.
  { id: "costilla-adobada", nombre: "Costilla de Cerdo adobada", categoria: "cerdo", unidad: "kg", precio: 370, descripcion: "Enchilada.", familia: "Costilla de Cerdo", opcion: "Adobada", firebaseIds: [] },

  { id: "bacalao", nombre: "Bacalao", categoria: "trad", unidad: "kg", precio: 825, descripcion: "A la vizcaína, con aceitunas, almendras y aceite de oliva.", clasico: true, firebaseIds: ["PROD_008"], ...foto("bacalao") },
  { id: "romeritos", nombre: "Romeritos", categoria: "trad", unidad: "kg", precio: 290, descripcion: "Con nopales, camarones y tortitas de camarón.", clasico: true, firebaseIds: ["PROD_009"], ...foto("romeritos") },

  { id: "ensalada-manzana", nombre: "Ensalada de Manzana", categoria: "guarn", unidad: "kg", precio: 260, descripcion: "Con nuez, piña y apio.", clasico: true, firebaseIds: ["PROD_010"], ...foto("ensalada-de-manzana") },
  { id: "relleno", nombre: "Relleno Tradicional", categoria: "guarn", unidad: "kg", precio: 400, descripcion: "Carne de cerdo y res, especias y fruta seca. También enchilado.", firebaseIds: ["PROD_012"], ...foto("relleno") },
  { id: "espagueti", nombre: "Espagueti", categoria: "guarn", unidad: "kg", precio: 250, descripcion: "A las finas hierbas o en salsa de 3 quesos.", versiones: ["A las finas hierbas", "En salsa de 3 quesos"], firebaseIds: ["PROD_029", "PROD_030"], ...foto("espagueti-3-quesos") },
  { id: "ravioles", nombre: "Ravioles de Queso", categoria: "guarn", unidad: "kg", precio: 330, firebaseIds: ["PROD_022"], ...foto("ravioles-de-queso") },

  { id: "strudel", nombre: "Strudel de Manzana", categoria: "pan", unidad: "pza", precio: 520, descripcion: "Pasta hojaldrada rellena de manzana. Para 10 personas.", clasico: true, firebaseIds: ["PROD_025"], ...foto("strudel-de-manzana") },
  { id: "maquila", nombre: "Maquila", categoria: "maquila", unidad: "kg", precio: 170, descripcion: "Usted nos trae su pavo, lomo, costilla de cerdo, pechuga o pierna de pavo, o la carne que guste y nosotros la cocinamos. Se cobra por kilo de lo que pese. Tráigalo a la tienda al menos 2 días antes de la entrega (de preferencia descongelado). No se aceptan piernas de cerdo.", maquila: true, firebaseIds: ["PROD_013"] },
  { id: "strudel-individual", nombre: "Strudel Individual", categoria: "pan", unidad: "pza", precio: 40, descripcion: "Pasta hojaldrada rellena de manzana.", firebaseIds: ["PROD_035"] },
];
