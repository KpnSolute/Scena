import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined;
          const moduleId = id.replaceAll("\\", "/");
          if (moduleId.includes("@phosphor-icons")) return "vendor-icons";
          if (moduleId.includes("react-router")) return "vendor-router";
          if (moduleId.includes("react-dom")) return "vendor-react-dom";
          if (moduleId.includes("/react/") || moduleId.includes("scheduler")) return "vendor-react";
          if (moduleId.includes("@supabase") || moduleId.includes("@realtime")) return "vendor-supabase";
          return "vendor";
        },
      },
    },
  },
});
