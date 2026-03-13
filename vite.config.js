import { defineConfig, loadEnv } from "vite";
import vue from "@vitejs/plugin-vue";

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, process.cwd(), "");

    return {
        plugins: [vue()],
        base: process.env.BASE_PATH ?? "/",
        server: {
            port: 5173,
            proxy: {
                "/api": {
                    target:
                        env.VITE_BACKEND_URL ?? "http://192.168.127.254:9649",
                    changeOrigin: true,
                },
            },
        },
        build: {
            outDir: "target/dist",
            assetsInlineLimit: 0,
        },
    };
});
