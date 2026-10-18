import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { attachRelay } from "./server/relay.mjs";

export default defineConfig({
  base: "./",
  plugins: [
    react(),
    {
      name: "table-relay",
      configureServer(server) {
        if (server.httpServer) attachRelay(server.httpServer);
      },
    },
  ],
});
