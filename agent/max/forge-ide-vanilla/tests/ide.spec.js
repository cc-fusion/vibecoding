import { test, expect } from '@playwright/test';
let page, context;
let browserErrors = [];

async function attach() {
  await page.evaluate(async () => {
    window.testIDE = (await import('/js/main.js')).ide;
    window.testLogs = [];
    window.testResults = [];
    for (const channel of ['write', 'build', 'status']) {
      const original = testIDE.output.sink[channel];
      testIDE.output.sink[channel] = (...args) => { testLogs.push({ channel, args }); return original(...args); };
    }
    testIDE.runner.on('finished', event => testResults.push(event));
  });
  expect(await page.evaluate(() => testIDE.editorReady)).toBe(true);
}
async function reset() {
  await page.evaluate(async () => {
    const { createDefaultProject } = await import('/js/project/defaultProject.js');
    const defaults = createDefaultProject();
    const paths = new Set(defaults.map(f => f.path));
    for (const file of testIDE.project.allNodes()) if (!paths.has(file.path)) testIDE.project.delete(file.path);
    for (const file of defaults) {
      if (file.type !== 'file') continue;
      if (testIDE.project.exists(file.path)) testIDE.project.updateContent(file.path, file.content);
      else testIDE.project.createFile(file.path, file.content);
      testIDE.project.setLanguage(file.path, null);
    }
    testIDE.preview.close();
    testIDE.settings.update({ theme: 'dark', previewAutoRefresh: true });
    testIDE.ui.set({ sidebarVisible: true, panelVisible: true, settingsVisible: false, expandedDirs: ['/lib','/assembly','/data'] });
    await testIDE.persistence.flush();
    testLogs.length = 0; testResults.length = 0;
  });
  browserErrors = [];
}
async function files(contents) {
  await page.evaluate(contents => {
    for (const [path, text] of Object.entries(contents)) {
      if (testIDE.project.exists(path)) testIDE.project.updateContent(path, text);
      else testIDE.project.createFile(path, text);
    }
  }, contents);
}
async function run(path) {
  await page.evaluate(path => { testLogs.length = 0; testResults.length = 0; testIDE.openFile(path); }, path);
  await page.getByRole('button', { name: 'Run current file (Ctrl/Cmd+Enter)', exact: true }).click();
  await page.waitForFunction(() => testResults.length > 0, null, { timeout: 150_000 });
  return page.evaluate(() => ({ ...testResults.at(-1).result, logs: testLogs,
    output: testLogs.filter(l => l.channel === 'write').map(l => l.args[1]).join('\n'),
    build: testLogs.filter(l => l.channel === 'build').map(l => l.args[1]).join('\n') }));
}
function successful(result, output) {
  expect(result.status, JSON.stringify(result.logs)).toBe('completed');
  expect(result.exitCode).toBe(0);
  expect(result.output).toContain(output);
  expect(result.logs.filter(l => l.channel !== 'status' && ['error','stderr'].includes(l.args[0]))).toEqual([]);
  expect(browserErrors).toEqual([]);
}
test.beforeAll(async ({ browser }) => {
  context = await browser.newContext({ viewport: { width: 1440, height: 900 }, ignoreHTTPSErrors: process.env.IGNORE_HTTPS_ERRORS === '1' });
  page = await context.newPage();
  page.on('pageerror', e => browserErrors.push(e.message));
  page.on('console', message => { if (message.type() === 'error') browserErrors.push(message.text()); });
  await page.goto('http://localhost:5173');
  await attach();
});
test.beforeEach(reset);
test.afterAll(async () => { await context?.close(); });

const samples = [
  ['JavaScript', '/script.js', 'fib(20) = 6765'],
  ['TypeScript', '/main.ts', 'mean: 21.8'],
  ['Python', '/main.py', 'distance = 5.0'],
  ['AssemblyScript', '/assembly/index.ts', 'fib(30) = 832040'],
  ['C', '/main.c', 'factorial(6) = 720'],
  ['C++', '/main.cpp', 'sum = 15'],
  ['C#', '/Program.cs', 'squares: 1, 4, 9, 16, 25'],
  ['Java', '/Main.java', 'total = 55']
];
for (const [language, path, output] of samples) {
  test(`${language}: shipped example runs through the toolbar with expected output`, async () => successful(await run(path), output));
}

test('Build compiles all five compiler targets without executing user programs', async () => {
  await page.getByRole('button', { name: 'Build project', exact: true }).click();
  await page.waitForFunction(() => testResults.length > 0, null, { timeout: 150_000 });
  const result = await page.evaluate(() => ({ event: testResults.at(-1), logs: testLogs }));
  expect(result.event.result.status, JSON.stringify(result.logs)).toBe('completed');
  expect(result.event.result.summary).toBe('5 target(s): 5 succeeded, 0 failed, 0 toolchain(s) unavailable');
  expect(result.logs.filter(l => l.channel === 'write' && l.args[0] === 'stdout')).toEqual([]);
});

test('HTML + CSS + JavaScript: sandbox, style, interactivity, navigation and auto-refresh', async () => {
  await page.locator('.tree-row[data-path="/index.html"]').click();
  await page.getByRole('button', { name: 'Run current file (Ctrl/Cmd+Enter)', exact: true }).click();
  const preview = page.frameLocator('iframe[title="HTML preview (sandboxed)"]');
  await expect(preview.locator('h1')).toHaveText('Hello from the sandboxed preview');
  await expect(preview.locator('.card')).toHaveCSS('border-radius', '12px');
  await preview.locator('#counter').click();
  await expect(preview.locator('#counter')).toHaveText('Clicked 1 time');
  const iframe = page.locator('iframe[title="HTML preview (sandboxed)"]');
  expect(await iframe.getAttribute('sandbox')).not.toContain('allow-same-origin');
  const sandboxed = await preview.locator('body').evaluate(() => {
    try { return window.parent.document !== null; } catch { return false; }
  });
  expect(sandboxed).toBe(false);
  await preview.getByRole('link', { name: 'Go to about.html →' }).click();
  await expect(preview.locator('h1')).toHaveText('About');
  await preview.getByRole('link', { name: '← Back to index.html' }).click();
  await expect(preview.locator('h1')).toContainText('Hello');
  await page.evaluate(() => testIDE.project.updateContent('/style.css', testIDE.project.readFile('/style.css') + '\n.card { border-radius: 23px; }'));
  await expect(preview.locator('.card')).toHaveCSS('border-radius', '23px');
  expect(browserErrors).toEqual([]);
});

test('All 13 editor modes load, including CSS, JSON, Markdown and plain text', async () => {
  const result = await page.evaluate(async () => {
    const { LANGUAGES } = await import('/js/core/languages.js');
    const results = [];
    for (const language of LANGUAGES) {
      const path = '/mode-' + language.id + '.txt';
      testIDE.project.createFile(path, '', language.id);
      testIDE.openFile(path);
      const model = testIDE.editor.editor.getModel();
      results.push({ expected: language.monacoId, actual: model.getLanguageId() });
    }
    return results;
  });
  expect(result).toHaveLength(13);
  for (const mode of result) expect(mode.actual).toBe(mode.expected);
  expect(browserErrors).toEqual([]);
});

test('JavaScript: CommonJS modules, JSON and asynchronous console output', async () => {
  await files({ '/lib/helper.js': 'exports.double = n => n * 2;', '/script.js': 'const {double} = require("./lib/helper"); const config = require("./data/config.json"); setTimeout(() => console.log(config.name, double(21)), 20);' });
  successful(await run('/script.js'), 'forge-ide-sample 42');
});

test('Python: imports see edits on repeated runs and deleted modules are unavailable', async () => {
  await files({ '/helper.py': 'value = 41\n', '/main.py': 'import helper\nprint(helper.value + 1)\n' });
  successful(await run('/main.py'), '42');
  await files({ '/helper.py': 'value = 51\n' });
  successful(await run('/main.py'), '52');
  await page.evaluate(() => testIDE.project.delete('/helper.py'));
  const missing = await run('/main.py');
  expect(missing.status).toBe('failed');
  expect(missing.output).toContain('ModuleNotFoundError');
});

test('AssemblyScript: multi-file WebAssembly compilation', async () => {
  await files({ '/assembly/math.ts': 'export function twice(n:i32):i32 { return n*2; }', '/assembly/index.ts': 'import {twice} from "./math"; export function main(): i32 { console.log(twice(21).toString()); return 0; }' });
  successful(await run('/assembly/index.ts'), '42');
});

for (const [label, entry, helper, main, lib] of [
  ['C','/main.c','/lib/helper.c','#include <stdio.h>\n#include "lib/helper.h"\nint main(void){printf("value=%d\\n", answer()); return 0;}','int answer(void){return 42;}'],
  ['C++','/main.cpp','/lib/helper.cpp','#include <iostream>\n#include "lib/helper.h"\nint main(){std::cout << "value=" << answer() << std::endl; return 0;}','int answer(){return 42;}']
]) test(`${label}: multi-file linking with a nested project header`, async () => {
  await files({ [entry]: main, [helper]: lib, '/lib/helper.h': 'int answer(void);' });
  successful(await run(entry), 'value=42');
});

test('C#: multiple files and Main(string[] args)', async () => {
  await files({ '/Program.cs': 'using System;\nclass Program { static void Main(string[] args) { Console.WriteLine(Helper.Answer()); } }', '/Helper.cs': 'static class Helper { public static int Answer() { return 42; } }' });
  successful(await run('/Program.cs'), '42');
});
test('C#: top-level statements execute unchanged', async () => {
  await files({ '/Program.cs': 'System.Console.WriteLine("top-level works");' });
  successful(await run('/Program.cs'), 'top-level works');
});
test('C#: runtime exceptions are failures, never false successes', async () => {
  await files({ '/Program.cs': 'class Program { static void Main() { throw new System.Exception("intentional runtime error"); } }' });
  const result = await run('/Program.cs');
  expect(result.status).toBe('failed');
  expect(result.output).toContain('intentional runtime error');
});
test('C#: nonzero Main exit codes are preserved', async () => {
  await files({ '/Program.cs': 'class Program { static int Main() { return 7; } }' });
  const result = await run('/Program.cs');
  expect(result.status).toBe('failed');
  expect(result.exitCode).toBe(7);
});
test('Java: multiple source files and warm repeated execution', async () => {
  await files({ '/Main.java': 'public class Main { public static void main(String[] args) { System.out.println(Helper.answer()); } }', '/Helper.java': 'class Helper { static int answer() { return 42; } }' });
  successful(await run('/Main.java'), '42');
  await files({ '/Helper.java': 'class Helper { static int answer() { return 52; } }' });
  successful(await run('/Main.java'), '52');
});

const brokenPrograms = [
  ['JavaScript', '/script.js', 'throw new Error("intentional failure");', 'intentional failure'],
  ['TypeScript', '/main.ts', 'const value: number = "intentional failure";', 'not assignable'],
  ['Python', '/main.py', 'raise ValueError("intentional failure")', 'intentional failure'],
  ['AssemblyScript', '/assembly/index.ts', 'export function main():i32 { return missing_symbol; }', 'missing_symbol'],
  ['C', '/main.c', 'int main(void) { return missing_symbol; }', 'missing_symbol'],
  ['C++', '/main.cpp', 'int main() { return missing_symbol; }', 'missing_symbol'],
  ['C#', '/Program.cs', 'class Program { static void Main() { MissingSymbol(); } }', 'MissingSymbol'],
  ['Java', '/Main.java', 'public class Main { public static void main(String[] args) { missingSymbol(); } }', 'missingSymbol']
];
for (const [language, path, code, message] of brokenPrograms) {
  test(`${language}: intentional error is reported and a corrected rerun succeeds`, async () => {
    const original = await page.evaluate(path => testIDE.project.readFile(path), path);
    await files({ [path]: code });
    const broken = await run(path);
    expect(broken.status, JSON.stringify(broken.logs)).toBe('failed');
    expect(broken.output + broken.build).toContain(message);
    await files({ [path]: original });
    const fixed = await run(path);
    successful(fixed, samples.find(s => s[1] === path)[2]);
  });
}

for (const [language,path,code] of [
  ['JavaScript','/script.js','while(true) {}'],
  ['TypeScript','/main.ts','while(true) {}'],
  ['Python','/main.py','while True:\n    pass'],
  ['AssemblyScript','/assembly/index.ts','export function main():i32 { while(true) {} return 0; }'],
  ['C','/main.c','int main(void) { volatile int x=0; while(1) {x++;} return 0; }'],
  ['C++','/main.cpp','int main() { volatile int x=0; while(true) {x++;} return 0; }'],
  ['C#','/Program.cs','class Program { static void Main() { while(true) {} } }'],
  ['Java','/Main.java','public class Main { public static void main(String[] args) { while(true) {} } }']
]) test(`${language}: Stop terminates execution and the next run succeeds`, async () => {
  const original = await page.evaluate(path => testIDE.project.readFile(path), path);
  await files({ [path]: code });
  await page.evaluate(path => { testIDE.openFile(path); testLogs.length=0;testResults.length=0; }, path);
  await page.getByRole('button', { name: 'Run current file (Ctrl/Cmd+Enter)', exact: true }).click();
  await page.waitForFunction(() => testIDE.runner.isBusy);
  // Allow compilers to enter execution; assertions below also exercise cancellation during loading.
  await page.waitForTimeout(language === 'Java' ? 1500 : 500);
  await page.getByRole('button', { name: 'Stop execution', exact: true }).click();
  await page.waitForFunction(() => testResults.length > 0);
  expect(await page.evaluate(() => testResults.at(-1).result.status)).toBe('stopped');
  await files({ [path]: original });
  successful(await run(path), samples.find(s => s[1] === path)[2]);
});

test('Editor edits and structural changes survive a real page reload', async () => {
  await page.evaluate(async () => {
    testIDE.openFile('/main.py');
    testIDE.editor.editor.getModel().setValue('print("persisted")\n');
    testIDE.project.createFile('/notes/first.md', '# Saved note');
    testIDE.project.rename('/notes/first.md','/notes/renamed.md');
    testIDE.settings.update({theme:'light'});
  });
  // Wait for the actual IndexedDB value, not merely the in-memory project.
  await expect.poll(() => page.evaluate(async () => (await testIDE.persistence.loadNodes()).find(n=>n.path==='/main.py')?.content)).toBe('print("persisted")\n');
  await page.reload();
  await attach();
  expect(await page.evaluate(() => testIDE.project.readFile('/main.py'))).toBe('print("persisted")\n');
  expect(await page.evaluate(() => testIDE.project.readFile('/notes/renamed.md'))).toBe('# Saved note');
  expect(await page.evaluate(() => testIDE.project.exists('/notes/first.md'))).toBe(false);
  await expect(page.locator('html')).toHaveAttribute('data-theme','light');
  successful(await run('/main.py'), 'persisted');
});

test('Quick Open, themes, panel shortcuts and command console work', async () => {
  await page.keyboard.press('Control+p');
  const input=page.locator('.quick-open input');
  await input.fill('main.py');
  await input.press('Enter');
  expect(await page.evaluate(() => testIDE.ui.get().activeFile)).toBe('/main.py');
  await page.keyboard.press('Control+j');
  expect(await page.evaluate(() => testIDE.ui.get().panelVisible)).toBe(false);
  await page.keyboard.press('Control+j');
  await page.getByRole('tab',{name:'Terminal',exact:true}).click();
  const command = page.getByRole('textbox',{name:'IDE command console input'});
  await command.fill('echo hello from terminal'); await command.press('Enter');
  await expect(page.locator('.terminal-log')).toContainText('hello from terminal');
  for (const theme of ['dimmed','light','dark']) {
    await page.evaluate(theme => testIDE.settings.update({theme}),theme);
    await expect(page.locator('html')).toHaveAttribute('data-theme',theme);
  }
  expect(browserErrors).toEqual([]);
});

test('Final clean desktop screenshot', async () => {
  await page.evaluate(() => { testIDE.tabs.closeAll(); testIDE.openFile('/main.ts'); testIDE.preview.open('/index.html'); testIDE.output.clear('output'); testIDE.output.show('output'); });
  successful(await run('/main.ts'), 'mean: 21.8');
  await expect.poll(() => page.evaluate(() => testIDE.diagnostics.counts().errors)).toBe(0);
  await page.screenshot({ path:'reports/desktop.png', fullPage:true });
});
