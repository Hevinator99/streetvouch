import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
export default defineConfig([...nextVitals,{rules:{"react-hooks/purity":"off"}},globalIgnores(["dist/**",".next/**","node_modules/**"])]);
