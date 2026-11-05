import { defineConfig } from "vite";

// base "/" porque el sitio vive en la raíz del dominio propio (www.lawalkiria.com.mx).
export default defineConfig({
  base: "/",
  build: { target: "es2022" },
});
