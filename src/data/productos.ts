import type { Categoria, Producto } from "../types";

/**
 * Reglas de la web para los productos de Firestore: descripción, versiones, familia, pavo entero, etc.
 * QUÉ productos salen lo decide Firestore (súper panel, admin.html): un renglón de aquí solo sale si
 * su id (o su nombre, si no tiene id) existe en `products`; lo que está en Firestore y no aquí sale
 * como producto sencillo (lib/catalogo.ts). Nombre, precio y foto también los manda Firestore.
 * Esta lista completa solo se usa tal cual si Firestore no responde y no hay nada guardado.
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
  // Lo que se da de alta en el panel y no cae en otra sección.
  { id: "otros", nombre: "Más para su cena" },
  { id: "maquila", nombre: "Maquila: le cocinamos su carne a su gusto" },
];

export const productos: readonly Producto[] = [
  { id: "pavo-relleno", nombre: "Pavo Relleno", categoria: "pavo", unidad: "kg", precio: 400, descripcion: "Con nuestro relleno tradicional de carne de cerdo y res, especias y fruta seca.", clasico: true, pavoEntero: true, kgMinimoCompleto: 6, firebaseIds: ["PROD_001"], ...foto("pavo-relleno") },
  { id: "pavo-adobado", nombre: "Pavo Adobado", categoria: "pavo", unidad: "kg", precio: 400, descripcion: "Enchilado.", pavoEntero: true, firebaseIds: ["PROD_002"], ...foto("pavo-adobado") },
  { id: "pavo-ahumado", nombre: "Pavo Ahumado", categoria: "pavo", unidad: "kg", precio: 400, pavoEntero: true, soloCompleto: true, firebaseIds: ["PROD_003"], ...foto("pavo-ahumado") },
  // Con Firestore, la descripción se arma con las versiones que estén en el panel.
  { id: "pechuga-pavo", nombre: "Pechuga de Pavo", categoria: "pavo", unidad: "kg", precio: 590, descripcion: "Horneada, adobada, mechada o ahumada.", versiones: ["Horneada", "Adobada", "Mechada", "Ahumada"], versionIds: ["PROD_019", "PROD_018", "PROD_017", "PROD_020"], firebaseIds: ["PROD_017", "PROD_018", "PROD_019", "PROD_020"], ...foto("pechuga-pavo-horneada") },
  { id: "pierna-pavo", nombre: "Pierna de Pavo", categoria: "pavo", unidad: "kg", precio: 200, descripcion: "Horneada o adobada.", versiones: ["Horneada", "Adobada"], firebaseIds: ["PROD_032"] },
  // Combo para familias chicas. Sale solo si en el panel existe un producto llamado "Combo Pavo";
  // su precio no se usa: sale de pechuga, relleno y pierna.
  { id: "combo-pavo", nombre: "Combo Pavo", categoria: "pavo", unidad: "pza", precio: 0, descripcion: "Pechuga de pavo, relleno y 2 piernas de pavo en una misma charola. Ideal para 5 personas o menos. El precio varía según el peso de las piernas.", combo: { pechuga: 590, relleno: 400, pierna: 200 }, firebaseIds: [] },
  { id: "pavo-horneado", nombre: "Pavo Horneado Sin Relleno", categoria: "pavo", unidad: "kg", precio: 400, pavoEntero: true, firebaseIds: ["PROD_052"] },
  { id: "pato-naranja", nombre: "Pato a la Naranja", categoria: "pavo", unidad: "kg", precio: 500, descripcion: "Relleno de manzanas. Se pide por pato y se cobra por peso: cada uno pesa de 1.8 a 2.4 kg aprox.", pieza: { nombre: "pato", plural: "patos", kgMin: 1.8, kgMax: 2.4, kgEstimado: 2 }, firebaseIds: ["PROD_007"] },

  { id: "lomo-mechado", nombre: "Lomo Mechado", categoria: "cerdo", unidad: "kg", precio: 430, descripcion: "Con pasitas.", clasico: true, familia: "Lomo de Cerdo", opcion: "Mechado", firebaseIds: ["PROD_005"], ...foto("lomo-mechado") },
  { id: "lomo-adobado", nombre: "Lomo Adobado", categoria: "cerdo", unidad: "kg", precio: 440, descripcion: "Enchilado.", clasico: true, familia: "Lomo de Cerdo", opcion: "Adobado", firebaseIds: ["PROD_015"], ...foto("lomo-adobado-mechado") },
  { id: "lomo-horneado", nombre: "Lomo Horneado", categoria: "cerdo", unidad: "kg", precio: 430, familia: "Lomo de Cerdo", opcion: "Horneado", firebaseIds: ["PROD_055"] },
  { id: "lomo-ciruela", nombre: "Lomo a la Ciruela", categoria: "cerdo", unidad: "kg", precio: 465, descripcion: "Enrollado con ciruela y tocino.", familia: "Lomo de Cerdo", opcion: "A la ciruela", firebaseIds: ["PROD_034"] },
  { id: "costilla-cerdo", nombre: "Costilla de Cerdo horneada", categoria: "cerdo", unidad: "kg", precio: 360, familia: "Costilla de Cerdo", opcion: "Horneada", firebaseIds: ["PROD_021"] },
  // Nuevo para 2026, dado de alta en el panel el 24 nov 2026.
  { id: "costilla-adobada", nombre: "Costilla de Cerdo adobada", categoria: "cerdo", unidad: "kg", precio: 370, descripcion: "Enchilada.", familia: "Costilla de Cerdo", opcion: "Adobada", firebaseIds: ["PROD_058"] },

  { id: "bacalao", nombre: "Bacalao", categoria: "trad", unidad: "kg", precio: 825, descripcion: "A la vizcaína, con aceitunas, almendras y aceite de oliva.", clasico: true, firebaseIds: ["PROD_008"], ...foto("bacalao") },
  { id: "romeritos", nombre: "Romeritos", categoria: "trad", unidad: "kg", precio: 290, descripcion: "Con nopales, camarones y tortitas de camarón.", clasico: true, firebaseIds: ["PROD_009"], ...foto("romeritos") },

  { id: "ensalada-manzana", nombre: "Ensalada de Manzana", categoria: "guarn", unidad: "kg", precio: 260, descripcion: "Con nuez, piña y apio.", clasico: true, firebaseIds: ["PROD_010"], ...foto("ensalada-de-manzana") },
  { id: "relleno", nombre: "Relleno Tradicional", categoria: "guarn", unidad: "kg", precio: 400, descripcion: "Carne de cerdo y res, especias y fruta seca. También enchilado.", firebaseIds: ["PROD_012"], ...foto("relleno") },
  { id: "espagueti", nombre: "Espagueti", categoria: "guarn", unidad: "kg", precio: 250, descripcion: "A las finas hierbas o en salsa de 3 quesos.", versiones: ["A las finas hierbas", "En salsa de 3 quesos"], versionIds: ["PROD_030", "PROD_029"], firebaseIds: ["PROD_029", "PROD_030"], ...foto("espagueti-3-quesos") },
  { id: "ravioles", nombre: "Ravioles de Queso", categoria: "guarn", unidad: "kg", precio: 330, firebaseIds: ["PROD_022"], ...foto("ravioles-de-queso") },

  { id: "strudel", nombre: "Strudel de Manzana", categoria: "pan", unidad: "pza", precio: 520, descripcion: "Pasta hojaldrada rellena de manzana. Para 10 personas.", clasico: true, firebaseIds: ["PROD_025"], ...foto("strudel-de-manzana") },
  { id: "chapata", nombre: "Chapata", categoria: "otros", unidad: "pza", precio: 25, descripcion: "Para acompañar la cena: una por persona.", firebaseIds: ["PROD_054"] },
  { id: "maquila", nombre: "Maquila", categoria: "maquila", unidad: "kg", precio: 170, descripcion: "Usted nos trae su pavo, lomo, costilla de cerdo, pechuga o pierna de pavo, o la carne que guste y nosotros la cocinamos. Se cobra por kilo de lo que pese. Tráigalo a la tienda al menos 2 días antes de la entrega (de preferencia descongelado). No se aceptan piernas de cerdo.", maquila: true, firebaseIds: ["PROD_013"] },
  { id: "strudel-individual", nombre: "Strudel Individual", categoria: "pan", unidad: "pza", precio: 40, descripcion: "Pasta hojaldrada rellena de manzana.", firebaseIds: ["PROD_035"] },
];
