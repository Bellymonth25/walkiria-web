# La Walkiria · Página de precios

Página estática con la lista de precios de las cenas de fin de año y un pedido que se arma
y se manda por WhatsApp. Hecha con **Vite + TypeScript**, sin framework.

## Cada temporada

Solo hay que tocar dos archivos:

| Archivo | Qué tiene |
|---|---|
| `src/data/productos.ts` | Productos, descripciones y precios. No cambies los `id`. |
| `src/data/temporada.ts` | Año, día límite, día de pedidos tardíos, anticipo, días especiales de diciembre (23 y 30 sujetos a disponibilidad, 24 y 31 solo tienda), días de aviso para envío a domicilio, zonas de envío, teléfonos, dirección y horario. |

El calendario arranca en el mes actual y deja elegir de hoy al 31 de diciembre.

En `temporada.ts` también están los precios de empaques (y su capacidad en kg), el servicio
la maquila (precio, relleno y la lista de "¿Qué nos trae?") y los datos del negocio.

## Cenas sugeridas y Combo Pavo

- `calculadora` y `tiposCena` en `temporada.ts`: porciones por persona (todos cuentan igual) y las dos
  cenas base, **Básica** (carne, pasta, ensalada y postre) y **Todo incluido** (además romeritos,
  bacalao y panecillos). El cliente puede prender o apagar romeritos, bacalao, panecillos y postre.
- `combo` en `temporada.ts`: Combo Pavo (pechuga, relleno y 2 piernas en una charola) para 5 personas
  o menos. Su precio sale de los precios por kilo de pechuga, relleno y pierna (`src/lib/combo.ts`),
  y el mensaje de WhatsApp lleva el desglose para producción. Se agota si falta cualquiera de sus partes.
- En "Tu pedido" cada producto se sube, baja o quita ahí mismo; el nombre lleva al producto en la lista.

## Productos agotados

La página lee `publicWeb/disponibilidad` de Firestore (sin SDK, con un `fetch`). Ese documento
lo escribe la Cloud Function `onProductWritten` del repo de la app: cada vez que un producto
cambia, guarda la lista de ids con `estaDisponible == false`. Un producto de la web está agotado
cuando todos sus `firebaseIds` (en `productos.ts`) están en esa lista.

Reglas de Firestore necesarias: lectura abierta de `publicWeb` sin que otra regla general la tape. El
texto completo está en la sección "Súper panel de productos", más abajo.

Si no se puede leer el documento, la página muestra todo disponible.

Para probar en local sin Firebase: `http://localhost:5173/?agotados=PROD_001,PROD_008`

## Súper panel de productos (`admin.html`)

Página sin enlace en el menú (y con `noindex`) en `lawalkiria.com.mx/admin.html`. **Firestore
(`products`) es la verdad**: lo que se cambia aquí lo ven la app y la web.

- Solo entra quien tenga un documento en `superadmins/{uid}` (se crea a mano en la consola, vacío
  o con `{ nombre: "Carlos" }`). Ni un ADMIN de la app puede darse ese permiso.
- Lista todos los productos (comida por grupo, envíos y empaques) con el interruptor rápido de
  **Disponible**. Al tocar uno se abre su ficha: fotos (varias, una principal; ver "Galería ligada a los productos"),
  nombre, menudeo, mayoreo, categoría, grupo, tipo de venta, presentación, Disponible, Mostrar
  (`oculto`), peso ajustable y maquila.
- Cada cambio guarda `actualizadoEn` (hora del servidor) y `actualizadoPor` (correo) en el producto,
  y la ficha los muestra. Al crear se guarda también `creadoEn`. No se guarda el valor anterior.
- El switch muestra un indicador mientras guarda y un aviso con el nombre del producto: "✓ Pavo Relleno
  quedó agotado" o el error.
- **Editar** (botón amarillo) es la única forma de abrir la ficha. **Eliminar** (botón rojo de la fila)
  borra el producto: hay que escribir su nombre exacto para confirmar (no se puede deshacer; los
  pedidos ya hechos conservan nombre y precio).
- **+ Nuevo producto** crea `PROD_0xx` con el siguiente número libre.
- Mismo comportamiento en app y web: `estaDisponible == false` → "Agotado" y no se puede pedir;
  `oculto == true` → no aparece en ningún lado. Los pedidos ya hechos guardan su precio.
- La web se entera por `onProductWritten` → `publicWeb/disponibilidad` (nombre, precio de
  menudeo, foto, grupo y unidad de cada producto de comida; nunca mayoreo). Ver `src/lib/catalogo.ts`.

### Reglas de Firestore

Las reglas de Firebase se suman (si una permite, pasa); por eso la regla general excluye
`products`, `publicWeb` y `superadmins`. Reemplaza todo el texto de las reglas por:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function esEmpleado() {
      return request.auth != null
        && request.auth.token.email.matches('.*@lawalkiria[.]com[.]mx$');
    }
    function esSuperadmin() {
      return request.auth != null
        && exists(/databases/$(database)/documents/superadmins/$(request.auth.uid));
    }
    // Todo lo demás: cualquier empleado con correo de La Walkiria.
    match /{col}/{doc=**} {
      allow read, write: if esEmpleado() && !(col in ['products', 'publicWeb', 'superadmins']);
    }
    // Productos: los empleados leen; solo el súper admin crea, edita y elimina.
    match /products/{id} {
      allow read: if esEmpleado() || esSuperadmin();
      allow create: if esSuperadmin() && request.resource.data.id == id;
      allow update: if esSuperadmin() && request.resource.data.id == resource.data.id;
      allow delete: if esSuperadmin();
    }
    // Lista de súper admins: cada quien solo puede ver si está; se edita desde la consola.
    match /superadmins/{uid} {
      allow read: if request.auth != null && request.auth.uid == uid;
      allow write: if false;
    }
    // Catálogo público de la web: lo llena la Cloud Function.
    match /publicWeb/{doc} {
      allow read: if true;
      allow write: if false;
    }
  }
}
```

### Reglas de Storage (fotos)

```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /productos/{id}/{archivo} {
      allow read: if true;
      allow write: if request.auth != null
        && firestore.exists(/databases/(default)/documents/superadmins/$(request.auth.uid))
        && request.resource.size < 5 * 1024 * 1024
        && request.resource.contentType.matches('image/.*');
    }
  }
}
```

El nombre del bucket va en `firebaseWeb.storageBucket` (`src/data/temporada.ts`).
Firebase solo se carga en `admin.html`; las páginas públicas no cambian de peso.

## Fotos de los productos

Cada producto de `productos.ts` puede llevar `imagen` (foto grande, se abre al tocar la miniatura)
e `imagenMini` (miniatura 4:3 de 320×240 en `public/img/productos/<id>-mini.webp`, ~10 KB, con carga
diferida). Aceptan una ruta del sitio o una URL completa (por ejemplo de Firebase Storage). Sin foto,
la lista muestra un recuadro de "Foto pronto". La miniatura es cuadrada en celular y crece en 4:3
con la pantalla en compu, hasta 144 px.

La web solo usa la foto de `products` si se subió desde el panel (Firebase Storage); las que ya
traía la colección son de relleno de otros sitios y se ignoran.

## Galería ligada a los productos

Cada foto de `src/data/galeria.ts` dice a qué producto pertenece (`producto`, id de `productos.ts`).
La galería y el carrusel del inicio leen `publicWeb/disponibilidad` igual que el pedido:

- Producto oculto (**Mostrar** apagado): sus fotos no salen.
- Producto agotado: sus fotos salen con la marca **Agotado** y un poco apagadas.
- Platillos que solo están en el panel (lechón `PROD_024`, codornices `PROD_031`, lomo a la espinaca
  `PROD_016`, lomo horneado `PROD_055`) se ligan con `firebaseId` y funcionan igual.
- Fotos sin producto: salen siempre.

En la ficha del súper panel, **Fotos** deja subir varias a la vez (se reducen a 1200 px). La que lleva
**★ Principal** se guarda en `imagen`: es la de la app y la del renglón del pedido. Todas se guardan en
`fotos` (`[{ url, forma }]`) y salen en la galería. Si un producto aún no tiene `fotos`, la ficha muestra
las que la página ya traía; al agregar, quitar o cambiar la principal, el panel se queda a cargo de
todas (las de la página se guardan con su dirección `https://www.lawalkiria.com.mx/img/galeria/…`).
`fotos: []` significa que se quitaron todas: ya no sale ninguna de ese producto.

Necesita la versión de `onProductWritten` que publica `fotos` (repo de la app). Mientras no se
despliegue, la galería sigue con las fotos de la página, pero ya oculta y marca agotados.

Para probar en local: `galeria.html?agotados=PROD_009&ocultos=PROD_001` (también en el inicio).

## Foto de la cena

Si existe `public/img/cena.jpg` se muestra como banda debajo del servicio de maquila
(proporción 21:8, se recorta al centro). Si no existe, no aparece nada.

## Desarrollo

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # pruebas de la lógica del pedido
npm run build      # revisa tipos y genera dist/
```

## Estructura

```
src/
  data/       productos y datos de la temporada (lo que se edita)
  lib/        lógica pura: formato, fechas, pedido y mensaje de WhatsApp
  ui/         pintar el menú y el pedido en el DOM
  main.ts     estado y eventos
tests/        pruebas con Vitest
public/CNAME  dominio propio para GitHub Pages
```

## Publicación (GitHub Pages)

1. En el repo: **Settings → Pages → Source: GitHub Actions**.
2. Cada push a `main` corre pruebas, compila y publica (`.github/workflows/deploy.yml`).
3. Dominio propio: `public/CNAME` tiene `www.lawalkiria.com.mx`. En el DNS del dominio:
   - `www` → registro **CNAME** a `bellymonth25.github.io`
   - raíz `lawalkiria.com.mx` → registros **A** a `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`
4. En **Settings → Pages** escribe el dominio y activa **Enforce HTTPS** cuando GitHub termine de emitir el certificado.

Antes de mover el DNS, quita el dominio de Wix para que no choquen.
