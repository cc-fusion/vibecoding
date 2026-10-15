import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizePath, joinPath, dirname, basename, extname, isAncestor, validateRelativePath } from '../js/core/paths.js';
import { detectLanguage, LANGUAGES } from '../js/core/languages.js';
import { ProjectManager } from '../js/project/ProjectManager.js';
import { createDefaultProject } from '../js/project/defaultProject.js';
import { EventEmitter } from '../js/core/EventEmitter.js';

test('normalizes paths and traversal at the project root', () => {
  assert.equal(normalizePath('foo\\bar/../main.js'), '/foo/main.js');
  assert.equal(normalizePath('../../etc/./demo'), '/etc/demo');
  assert.equal(joinPath('/a', 'b', '../c'), '/a/c');
});
test('path helpers preserve segment boundaries', () => {
  assert.equal(dirname('/lib/main.ts'), '/lib');
  assert.equal(basename('/lib/main.ts'), 'main.ts');
  assert.equal(extname('/lib/main.TS'), '.ts');
  assert.equal(isAncestor('/lib', '/library/main.ts'), false);
  assert.equal(isAncestor('/lib', '/lib/main.ts'), true);
});
test('relative names reject invalid segments and control characters', () => {
  for (const path of ['', '../x', 'x/..', '/absolute', 'a//b', 'a?b', 'a\0b']) assert.ok(validateRelativePath(path));
  assert.equal(validateRelativePath('nested/my file.py'), null);
});
test('all language definitions have unique IDs', () => {
  assert.equal(new Set(LANGUAGES.map(l=>l.id)).size,13);
  assert.equal(LANGUAGES.filter(l=>l.runnable).length,9); // eight runtimes + HTML preview
});
test('language detection chooses AssemblyScript before ordinary TypeScript', () => {
  assert.equal(detectLanguage('/assembly/index.ts').id,'assemblyscript');
  assert.equal(detectLanguage('/main.as.ts').id,'assemblyscript');
  assert.equal(detectLanguage('/main.ts').id,'typescript');
  assert.equal(detectLanguage('/MAIN.CPP').id,'cpp');
  assert.equal(detectLanguage('/unknown.xyz').id,'plaintext');
});
test('default project has every executable language', () => {
  const p=new ProjectManager();p.load(createDefaultProject());
  for (const lang of LANGUAGES.filter(l=>l.runnable)) assert.ok(p.filesByLanguage(lang.id).length,lang.id);
});
test('project creates nested folders, renames subtrees and deletes recursively', () => {
  const p=new ProjectManager();p.createFile('/one/two/a.js','42');
  assert.equal(p.isDir('/one/two'),true);
  p.rename('/one','/new');
  assert.equal(p.readFile('/new/two/a.js'),'42');
  assert.equal(p.exists('/one/two/a.js'),false);
  assert.equal(p.delete('/new').length,3);
  assert.equal(p.allFiles().length,0);
});
test('project rejects collisions and recursive moves', () => {
  const p=new ProjectManager();p.createFile('/a/b.js','');
  assert.throws(()=>p.createFile('/a/b.js',''));
  assert.throws(()=>p.rename('/a','/a/inside'));
});
test('language overrides survive serialized records', () => {
  const p=new ProjectManager();p.createFile('/note.txt','print(42)','python');
  const copy=new ProjectManager();copy.load(p.toRecords());
  assert.equal(copy.languageOf('/note.txt').id,'python');
  assert.equal(copy.readFile('/note.txt'),'print(42)');
});
test('event listeners unsubscribe without affecting other listeners', () => {
  const emitter=new EventEmitter();let first=0,second=0;
  const off=emitter.on('change',()=>first++);emitter.on('change',()=>second++);
  emitter.emit('change',{});off();emitter.emit('change',{});
  assert.equal(first,1);assert.equal(second,2);
});
