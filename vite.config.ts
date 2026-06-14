import path from "path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";

export default defineConfig({
  resolve: {
    alias: {
      fabric: path.resolve(__dirname, "node_modules/fabric/dist/index.js"),
      "firebase/firestore": path.resolve(
        __dirname,
        "node_modules/firebase/firestore/dist/esm/index.esm.js",
      ),
    },
    extensions: [".mjs", ".js", ".mts", ".ts", ".jsx", ".tsx", ".json"],
  },
  optimizeDeps: {
    include: [
      path.resolve(__dirname, "node_modules/fabric/dist/index.js"),
      path.resolve(__dirname, "node_modules/firebase/firestore/dist/esm/index.esm.js"),
    ],
  },
  plugins: [
    tsconfigPaths(),
    tanstackStart({
      server: {
        preset: "vercel",
      },
    }),
    react(),
    tailwindcss(),
  ],
});
