import { expect, test, type Page } from '@playwright/test';

const origin = process.env.TEST_URL || 'http://localhost:5173';
const url = `${origin}/code-editor.html`;

test.setTimeout(60_000);
test.use({ colorScheme: 'light', viewport: { width: 1440, height: 960 } });

async function openEditor(page: Page) {
  await page.goto(url);
  await page.waitForFunction(() => Boolean((window as any).CodeEditor?.editor));
}

test('the project entry hosts the independent HTML application', async ({ page }) => {
  await page.goto(origin);
  await expect(page).toHaveTitle('Code Editor');
  const app = page.frameLocator('.application-frame');
  await expect(app.getByRole('heading', { name: 'Code Editor', exact: true })).toBeVisible();
  await expect(app.locator('.monaco-editor')).toBeVisible({ timeout: 30_000 });
  await expect(app.locator('#result-placeholder')).toBeVisible();
});

test('saved source is restored without ever executing it', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('code-editor:code', 'window.__sourceExecuted = true;');
  });
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await openEditor(page);
  expect(await page.evaluate(() => (window as any).CodeEditor.getCode())).toBe('window.__sourceExecuted = true;');
  expect(await page.evaluate(() => (window as any).__sourceExecuted)).toBeUndefined();
  await expect(page.locator('#result')).toBeHidden();
  await page.getByRole('button', { name: 'Run (Ctrl+Enter)', exact: true }).click();
  await expect(page.locator('#toast')).toContainText('No compiler connected');
  expect(await page.evaluate(() => (window as any).__sourceExecuted)).toBeUndefined();
  expect(errors).toEqual([]);
});

test('typing, empty documents, and language selection persist', async ({ page }) => {
  await openEditor(page);
  await page.evaluate(() => (window as any).CodeEditor.editor.focus());
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.insertText('const saved = "only text";');
  await expect(page.locator('#save-status')).toHaveText('Saved');
  await expect.poll(() => page.evaluate(() => localStorage.getItem('code-editor:code'))).toBe('const saved = "only text";');
  await page.getByLabel('Editor language', { exact: true }).selectOption('typescript');
  await expect(page.locator('#file-name')).toHaveText('main.ts');
  await page.evaluate(() => (window as any).CodeEditor.save());
  await page.reload();
  await page.waitForFunction(() => Boolean((window as any).CodeEditor?.editor));
  expect(await page.evaluate(() => (window as any).CodeEditor.getCode())).toBe('const saved = "only text";');
  await expect(page.getByLabel('Editor language', { exact: true })).toHaveValue('typescript');
  await page.evaluate(() => { (window as any).CodeEditor.setCode(''); (window as any).CodeEditor.save(); });
  await page.reload();
  await page.waitForFunction(() => Boolean((window as any).CodeEditor?.editor));
  expect(await page.evaluate(() => (window as any).CodeEditor.getCode())).toBe('');
});

test('Monaco folds code and detects spaces and tabs from the source', async ({ page }) => {
  await openEditor(page);
  const options = await page.evaluate(() => {
    const { CodeEditor: api, monaco } = window as any;
    return {
      folding: api.editor.getOption(monaco.editor.EditorOption.folding),
      lineNumbers: api.editor.getOption(monaco.editor.EditorOption.lineNumbers).renderType,
      indent: api.editor.getModel().getOptions().tabSize,
    };
  });
  expect(options).toEqual({ folding: true, lineNumbers: 1, indent: 2 });
  const originalLineTop = await page.evaluate(() => (window as any).CodeEditor.editor.getTopForLineNumber(6));
  await page.evaluate(() => (window as any).CodeEditor.editor.getAction('editor.foldAll').run());
  await expect.poll(() => page.evaluate(() => (window as any).CodeEditor.editor.getTopForLineNumber(6))).toBeLessThan(originalLineTop);
  await page.evaluate(() => (window as any).CodeEditor.editor.getAction('editor.unfoldAll').run());
  await page.evaluate(() => (window as any).CodeEditor.setCode('function sample() {\n    const value = 3;\n    return value;\n}\n'));
  expect(await page.evaluate(() => (window as any).CodeEditor.editor.getModel().getOptions().tabSize)).toBe(4);
  await page.evaluate(() => (window as any).CodeEditor.setCode('function sample() {\n\tconst value = 3;\n\treturn value;\n}\n'));
  expect(await page.evaluate(() => (window as any).CodeEditor.editor.getModel().getOptions().insertSpaces)).toBe(false);
  await expect(page.locator('#indentation-status')).toContainText('Tabs:');
  await page.locator('#indentation-status').click();
  await expect(page.locator('#toast')).toContainText('Indentation detected');
});

test('settings change real editor options, persist, and reset', async ({ page }) => {
  await openEditor(page);
  await page.getByRole('button', { name: 'Editor settings', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button', { name: 'Increase font size' }).click();
  await page.getByRole('switch', { name: 'Word wrap', exact: true }).click();
  await page.getByRole('switch', { name: 'Minimap', exact: true }).click();
  await page.getByRole('switch', { name: 'Suggestions', exact: true }).click();
  await page.getByRole('switch', { name: 'Parameter hints', exact: true }).click();
  await page.getByLabel('Font family', { exact: true }).selectOption({ label: 'Fira Code' });
  const options = await page.evaluate(() => {
    const { CodeEditor: api, monaco } = window as any;
    const option = monaco.editor.EditorOption;
    return {
      size: api.editor.getOption(option.fontSize),
      font: api.editor.getOption(option.fontFamily),
      wrap: api.editor.getOption(option.wordWrap),
      minimap: api.editor.getOption(option.minimap).enabled,
      hints: api.editor.getOption(option.parameterHints).enabled,
      suggestions: api.editor.getOption(option.quickSuggestions),
      words: api.editor.getOption(option.suggest).showWords,
    };
  });
  expect(options).toMatchObject({ size: 15, wrap: 'on', minimap: false, hints: false, words: false });
  expect(options.suggestions).toEqual({ other: 'off', comments: 'off', strings: 'off' });
  expect(options.font).toContain('Fira Code');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(page.getByRole('button', { name: 'Editor settings', exact: true })).toBeFocused();
  await page.reload();
  await page.waitForFunction(() => Boolean((window as any).CodeEditor?.editor));
  expect(await page.evaluate(() => (window as any).CodeEditor.getSettings().fontSize)).toBe(15);
  await page.getByRole('button', { name: 'Editor settings', exact: true }).click();
  await page.getByRole('button', { name: 'Reset to defaults' }).click();
  await expect(page.locator('#font-size-value')).toHaveText('14px');
  await expect(page.getByRole('switch', { name: 'Minimap', exact: true })).toBeChecked();
  await expect(page.getByRole('switch', { name: 'Word wrap', exact: true })).not.toBeChecked();
  await page.evaluate(() => (window as any).CodeEditor.updateSettings({ fontSize: 100 }));
  await expect(page.locator('#font-size-value')).toHaveText('24px');
  await expect(page.getByRole('button', { name: 'Increase font size' })).toBeDisabled();
});

test('system theme follows the OS until explicitly overridden', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await openEditor(page);
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.emulateMedia({ colorScheme: 'light' });
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.getByRole('button', { name: 'Switch to dark mode' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.emulateMedia({ colorScheme: 'light' });
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.getByRole('button', { name: 'Editor settings', exact: true }).click();
  await page.getByRole('button', { name: 'System', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
});

test('dragging crosses both the editor and a live result iframe', async ({ page }) => {
  await openEditor(page);
  await page.evaluate(() => (window as any).CodeEditor.setText('Result frame')); 
  const divider = page.locator('#resizer');
  const box = (await divider.boundingBox())!;
  await page.mouse.move(box.x, box.y + box.height / 2);
  await page.mouse.down();
  await expect(page.locator('#drag-cover')).toBeVisible();
  expect(await page.locator('#result').evaluate(element => getComputedStyle(element).pointerEvents)).toBe('none');
  await page.mouse.move(1150, box.y + box.height / 2, { steps: 10 });
  await page.mouse.move(420, box.y + box.height / 2, { steps: 12 });
  await page.mouse.up();
  await expect(divider).toHaveAttribute('aria-valuenow', '29');
  await expect(page.locator('#drag-cover')).toBeHidden();
  await divider.dblclick();
  await expect(divider).toHaveAttribute('aria-valuenow', '56');
  await divider.focus();
  await page.keyboard.press('ArrowRight');
  await expect(divider).toHaveAttribute('aria-valuenow', '58');
  await page.keyboard.press('Home');
  await expect(divider).toHaveAttribute('aria-valuenow', '18');
});

test('mobile panes stack and resize vertically without overflowing', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openEditor(page);
  const source = (await page.locator('#editor-pane').boundingBox())!;
  const result = (await page.locator('#result-pane').boundingBox())!;
  expect(result.y).toBeGreaterThan(source.y + source.height);
  expect(result.x).toBe(source.x);
  await expect(page.locator('#resizer')).toHaveAttribute('aria-orientation', 'horizontal');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const bar = (await page.locator('#resizer').boundingBox())!;
  await page.mouse.move(195, bar.y + 4);
  await page.mouse.down();
  await page.mouse.move(195, 400, { steps: 10 });
  await page.mouse.up();
  const split = await page.evaluate(() => (window as any).CodeEditor.getSettings().split);
  expect(split).toBeGreaterThan(.4);
  expect(split).toBeLessThan(.5);
  await page.screenshot({ path: 'artifacts/mobile.png' });
  await page.getByRole('button', { name: 'Editor settings', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button', { name: 'Close settings' }).click();
});

test('compiler hooks run only on explicit actions, once per shortcut', async ({ page }) => {
  await openEditor(page);
  await page.evaluate(() => {
    const w = window as any;
    w.__runs = 0;
    w.CodeEditor.config.onRun = async (_code: string, api: any) => {
      w.__runs++;
      await new Promise(resolve => setTimeout(resolve, 120));
      api.setText('Hook called ' + w.__runs);
    };
  });
  expect(await page.evaluate(() => (window as any).__runs)).toBe(0);
  await page.evaluate(() => {
    const api = (window as any).CodeEditor;
    api.setCode('const notExecuted = true;');
    api.updateSettings({ colorMode: 'dark', wordWrap: true });
    api.setLanguage('typescript');
  });
  expect(await page.evaluate(() => (window as any).__runs)).toBe(0);
  await page.getByRole('button', { name: 'Run (Ctrl+Enter)', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Run (Ctrl+Enter)', exact: true })).toBeDisabled();
  await expect(page.frameLocator('#result').locator('pre')).toHaveText('Hook called 1');
  await page.evaluate(() => (window as any).CodeEditor.editor.focus());
  await page.keyboard.press('ControlOrMeta+Enter');
  await expect(page.frameLocator('#result').locator('pre')).toHaveText('Hook called 2');
  expect(await page.evaluate(() => (window as any).__runs)).toBe(2);
  await page.evaluate(() => { (window as any).CodeEditor.config.onRun = () => { throw new Error('Test compiler error'); }; });
  await page.getByRole('button', { name: 'Run (Ctrl+Enter)', exact: true }).click();
  await expect(page.frameLocator('#result').locator('pre')).toHaveText('Test compiler error');
  await page.getByRole('button', { name: 'Clear result', exact: true }).click();
  await expect(page.locator('#result-placeholder')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Open result in a new tab' })).toBeDisabled();
});

test('result text is escaped and new tabs preserve the result sandbox', async ({ page }) => {
  await openEditor(page);
  await page.evaluate(() => (window as any).CodeEditor.setText('<script>parent.__unsafe = true;</script>'));
  await expect(page.frameLocator('#result').locator('pre')).toHaveText('<script>parent.__unsafe = true;</script>');
  expect(await page.evaluate(() => (window as any).__unsafe)).toBeUndefined();
  const popupPromise = page.waitForEvent('popup');
  await page.getByRole('button', { name: 'Open result in a new tab' }).click();
  const popup = await popupPromise;
  await expect(popup.frameLocator('iframe').locator('pre')).toHaveText('<script>parent.__unsafe = true;</script>');
  expect(await popup.locator('iframe').getAttribute('sandbox')).not.toContain('allow-same-origin');
  await popup.close();
});

test('developers can remove standard buttons and add working custom buttons', async ({ page }) => {
  await openEditor(page);
  await page.evaluate(() => {
    const api = (window as any).CodeEditor;
    api.config.buttons = [
      'run', 'spacer',
      { id: 'example', label: 'Insert example', onClick: (editorApi: any) => editorApi.setCode('const example = true;') },
      'settings',
    ];
    api.config.result.buttons = [];
    api.renderToolbar();
  });
  await expect(page.getByRole('button', { name: 'Switch to dark mode' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Clear result', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Insert example' }).click();
  expect(await page.evaluate(() => (window as any).CodeEditor.getCode())).toBe('const example = true;');
});

test('a failed CDN load leaves editable code and retry preserves an empty document', async ({ page }) => {
  await page.route('**/vs/loader.js', route => route.abort());
  await page.goto(url);
  await expect(page.locator('#fallback')).toBeVisible();
  await page.locator('#fallback-editor').fill('');
  await page.getByRole('button', { name: 'Editor settings', exact: true }).click();
  await page.getByRole('button', { name: 'Increase font size' }).click();
  await page.getByRole('switch', { name: 'Word wrap', exact: true }).click();
  expect(await page.locator('#fallback-editor').evaluate(element => getComputedStyle(element).fontSize)).toBe('15px');
  await expect(page.locator('#fallback-editor')).toHaveAttribute('wrap', 'soft');
  await page.getByRole('button', { name: 'Close settings' }).click();
  await page.unroute('**/vs/loader.js');
  await page.getByRole('button', { name: 'Retry', exact: true }).click();
  await page.waitForFunction(() => Boolean((window as any).CodeEditor?.editor));
  expect(await page.evaluate(() => (window as any).CodeEditor.getCode())).toBe('');
  await expect(page.locator('#editor-error')).toBeHidden();
});

test('failed Monaco modules can be retried after the loader succeeds', async ({ page }) => {
  await page.route('**/vs/editor/editor.main.js', route => route.abort());
  await page.goto(url);
  await expect(page.locator('#fallback')).toBeVisible({ timeout: 20_000 });
  await page.locator('#fallback-editor').fill('const recovered = true;');
  await page.unroute('**/vs/editor/editor.main.js');
  await page.getByRole('button', { name: 'Retry', exact: true }).click();
  await page.waitForFunction(() => Boolean((window as any).CodeEditor?.editor));
  expect(await page.evaluate(() => (window as any).CodeEditor.getCode())).toBe('const recovered = true;');
});

test('unavailable localStorage does not break the editor', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('Storage disabled', 'SecurityError'); } });
  });
  await openEditor(page);
  await expect(page.locator('#save-status')).toHaveText('Not saved');
  await page.getByRole('button', { name: 'Switch to dark mode' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.getByRole('button', { name: 'Run (Ctrl+Enter)', exact: true }).click();
  await expect(page.locator('#toast')).toContainText('No compiler connected');
});

test('the JavaScript language worker loads across the CDN boundary', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await openEditor(page);
  const diagnosticCount = await page.evaluate(async () => {
    const w = window as any;
    const uri = w.CodeEditor.editor.getModel().uri;
    const getWorker = await w.monaco.languages.typescript.getJavaScriptWorker();
    const worker = await getWorker(uri);
    return (await worker.getSyntacticDiagnostics(uri.toString())).length;
  });
  expect(diagnosticCount).toBe(0);
  expect(errors).toEqual([]);
});