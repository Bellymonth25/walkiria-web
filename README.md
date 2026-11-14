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

## Productos agotados

La página lee `publicWeb/disponibilidad` de Firestore (sin SDK, con un `fetch`). Ese documento
lo escribe la Cloud Function `onProductWritten` del repo de la app: cada vez que un producto
cambia, guarda la lista de ids con `estaDisponible == false`. Un producto de la web está agotado
cuando todos sus `firebaseIds` (en `productos.ts`) están en esa lista.

Reglas de Firestore necesarias:

```
match /publicWeb/{doc} {
  allow read: if true;
  allow write: if false;
}
```

Si no se puede leer el documento, la página muestra todo disponible.

Para probar en local sin Firebase: `http://localhost:5173/?agotados=PROD_001,PROD_008`

## Fotos de los productos

Cada producto de `productos.ts` puede llevar `imagen` (foto grande, se abre al tocar la miniatura)
e `imagenMini` (miniatura 4:3 de 320×240 en `public/img/productos/<id>-mini.webp`, ~10 KB, con carga
diferida). Aceptan una ruta del sitio o una URL completa (por ejemplo de Firebase Storage). Sin foto,
la lista muestra un recuadro de "Foto pronto". La miniatura es cuadrada en celular y crece en 4:3
con la pantalla en compu, hasta 144 px.

No uses el campo `imagen` de la colección `products` de la app: trae fotos de relleno de otros sitios.

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
