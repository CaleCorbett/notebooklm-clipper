import * as esbuild from 'esbuild';
import { copyFileSync, mkdirSync, cpSync } from 'fs';

const watch = process.argv.includes('--watch');
const outdir = 'dist/chrome';

mkdirSync(outdir, { recursive: true });
mkdirSync(`${outdir}/popup`, { recursive: true });

// Copy static files
copyFileSync('manifest.json', `${outdir}/manifest.json`);
cpSync('icons', `${outdir}/icons`, { recursive: true });
copyFileSync('src/popup/popup.html', `${outdir}/popup/popup.html`);
copyFileSync('src/popup/popup.css', `${outdir}/popup/popup.css`);

const ctx = await esbuild.context({
  entryPoints: {
    'background':     'src/background.ts',
    'content':        'src/content.ts',
    'popup/popup':    'src/popup/popup.ts',
  },
  bundle: true,
  outdir,
  format: 'esm',
  target: 'chrome120',
  sourcemap: false,
});

if (watch) {
  await ctx.watch();
  console.log('Watching for changes...');
} else {
  await ctx.rebuild();
  await ctx.dispose();
  console.log('Build complete → dist/chrome/');
}
