import fs from 'node:fs';
import {spawn} from 'node:child_process';
const source=fs.readFileSync('apps/web/tests/responsive/browser-check.mjs','utf8');
const array=source.match(/const availableStories = (\[[\s\S]*?\]);/)[1];
const ids=[...array.matchAll(/'([^']+)'/g)].map(m=>m[1]);
ids.push('dealer-dashboardmetrics--populated','dealer-dashboardmetrics--large-values','dealer-dashboardmetrics--loading','dealer-dashboardmetrics--unavailable','dealer-consoleutilities--signed-out','dealer-consoleutilities--multiple-workspaces');
const child=spawn(process.execPath,['apps/web/tests/responsive/browser-check.mjs'],{stdio:'inherit',env:{...process.env,CHROME_DEBUG_URL:'http://127.0.0.1:9227',SANDBOX_URL:'http://127.0.0.1:6006',RESPONSIVE_EVIDENCE_DIR:'/tmp/dealer-ux-evidence/integrated-components',RESPONSIVE_STORIES:ids.join(',')}});
child.on('exit',code=>process.exit(code??1));
