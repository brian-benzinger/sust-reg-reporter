// Build config for the React/TypeScript web app (ADR-0021).
//
// Two outputs from one invocation:
//   1. `client`  — the browser bundle that hydrates the interactive islands
//                  (the Scope Checker). Emitted to dist/app.js.
//   2. `ssg`     — a Node bundle of the prerender entry, emitted to
//                  build/prerender.cjs and then run by `npm run build` to write
//                  static HTML into dist/ (indexable, ADR-0013).
//
// This file is build tooling, not application logic, so it is excluded from the
// coverage gate the same way infra/bin and the client/prerender entries are.
const path = require("node:path");

/** @type {import('webpack').RuleSetRule} */
const tsRule = {
  test: /\.tsx?$/,
  exclude: /node_modules/,
  use: {
    loader: "ts-loader",
    // Type-checking is done separately by `npm run typecheck`; the loader only
    // transpiles, which keeps the build fast and avoids duplicating the gate.
    options: { transpileOnly: true },
  },
};

const resolve = {
  extensions: [".tsx", ".ts", ".js", ".json"],
};

/** @type {import('webpack').Configuration} */
const client = {
  name: "client",
  mode: "production",
  target: "web",
  entry: path.resolve(__dirname, "src/client.tsx"),
  output: {
    path: path.resolve(__dirname, "dist"),
    filename: "app.js",
    clean: true,
  },
  module: { rules: [tsRule] },
  resolve,
};

/** @type {import('webpack').Configuration} */
const ssg = {
  name: "ssg",
  mode: "production",
  target: "node",
  entry: path.resolve(__dirname, "src/prerender.tsx"),
  output: {
    path: path.resolve(__dirname, "build"),
    filename: "prerender.cjs",
    library: { type: "commonjs2" },
  },
  // Let the prerender script resolve dist/ from the real working directory
  // rather than webpack's mocked __dirname.
  node: { __dirname: false, __filename: false },
  module: { rules: [tsRule] },
  resolve,
};

module.exports = [client, ssg];
