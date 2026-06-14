const esbuild = require('esbuild');

const watch = process.argv.includes('--watch');

// @salesforce/core uses dynamic requires and worker_threads — must NOT be bundled.
// Keep as require() calls so they resolve from node_modules/ at runtime.
const EXTERNALS = [
  'vscode',
  '@salesforce/core',
  '@jsforce/jsforce-node',
  '@salesforce/kit',
  '@salesforce/ts-types',
  'pino',
  'pino-pretty',
  'pino-abstract-transport',
  'thread-stream',
  'sonic-boom',
  'ajv',
  'faye',
  'jszip',
  'jsonwebtoken',
  'proper-lockfile',
  'semver',
  'zod',
];

const ctx = esbuild.context({
  entryPoints: ['src/extension.ts'],
  bundle: true,
  outfile: 'dist/extension.js',
  external: EXTERNALS,
  format: 'cjs',
  platform: 'node',
  target: 'node18',
  sourcemap: true,
  minify: false,
});

ctx.then(async c => {
  if (watch) {
    await c.watch();
    console.log('[esbuild] watching...');
  } else {
    await c.rebuild();
    await c.dispose();
    console.log('[esbuild] build complete');
  }
}).catch(e => { console.error(e); process.exit(1); });
