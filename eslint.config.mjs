import js from "@eslint/js";
import tseslint from "typescript-eslint";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const webFiles = [
  "apps/web/**/*.{js,jsx,ts,tsx}",
];

function scopeToWeb(configs) {
  return configs.map((config) => ({
    ...config,

    files: webFiles,

    settings: {
      ...(config.settings ?? {}),

      next: {
        ...(config.settings?.next ?? {}),
        rootDir: "apps/web",
      },
    },
  }));
}

export default [
  {
    ignores: [
      "**/node_modules/**",
      "**/.next/**",
      "**/dist/**",
      "**/coverage/**",
      "audit/**",
      "supabase/.temp/**",
    ],
  },

  js.configs.recommended,

  ...tseslint.configs.recommended,

  /*
   * Next.js and React rules belong only
   * to the Next.js workspace.
   */
  ...scopeToWeb(nextVitals),
  ...scopeToWeb(nextTs),

  {
    files: [
      "apps/api/**/*.ts",
      "packages/**/*.ts",
    ],

    rules: {
      "no-console": "off",

      "@typescript-eslint/no-explicit-any":
        "warn",

      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          "argsIgnorePattern": "^_",
          "varsIgnorePattern": "^_",
          "caughtErrorsIgnorePattern": "^_"
        }
      ],
    },
  },

  /*
   * Express Request declaration merging
   * legitimately uses namespace Express.
   */
  {
    files: [
      "apps/api/src/middleware/auth.ts",
      "apps/api/src/middleware/require-organisation.ts",
    ],

    rules: {
      "@typescript-eslint/no-namespace":
        "off",
    },
  },

  {
    files: webFiles,

    rules: {
      "@typescript-eslint/no-explicit-any":
        "warn",

      /*
       * RENTpilot currently performs
       * client-side loading and some
       * derived form synchronization
       * through effects.
       *
       * Keep this visible while avoiding
       * risky Phase 1 rewrites of working
       * screens.
       */
      "react-hooks/set-state-in-effect":
        "warn",
    },
  },
];
