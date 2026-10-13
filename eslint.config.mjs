import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier/flat";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([
    "node_modules/**",
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "src/generated/**",
    "prisma/migrations/**",
    "public/pdfjs/**",
  ]),
  prettier,
  {
    // Reglas del compilador de React (eslint-plugin-react-hooks 7): marcan patrones
    // heredados (setState en efectos, refs en render). Se mantienen como aviso y se
    // corrigen al tocar cada componente; en código nuevo no deben aparecer.
    rules: {
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/refs": "warn",
      "react-hooks/purity": "warn",
      "react-hooks/immutability": "warn",
      "react-hooks/static-components": "warn",
    },
  },
]);

export default eslintConfig;
