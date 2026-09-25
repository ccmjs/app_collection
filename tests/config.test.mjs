import test from 'node:test';
import assert from 'node:assert/strict';
import { normalize } from '../ccm.app_collection.mjs';
const app = ['ccm.start', './example.mjs', { callback() {} }];
test('bare dependencies remain lazy and retain callback configurations', () => {
  const result = normalize([app]);
  assert.equal(result[0].items[0].app, app);
  assert.equal(result[0].items[0].title, 'App 1');
  assert.equal(app.length, 3);
});
test('sections contain nested folders and widgets without mutating config', () => {
  const input = { sections: [{ title: 'Chapter', items: [{ title: 'Folder', items: [{ type: 'widget', app, width: 3, height: 2 }] }] }] };
  const result = normalize(input);
  assert.equal(result[0].items[0].type, 'folder');
  assert.equal(result[0].items[0].items[0].width, 3);
  assert.equal(input.sections[0].items[0].type, undefined);
});
test('invalid nested dependencies and dimensions fail before rendering', () => {
  for (const input of [[{ app: ['ccm.load', 'x'] }], [{ type: 'widget', app, width: 0 }], [{ type: 'widget', app, height: 1.5 }], [{ items: [null] }], { sections: [null] }, {}])
    assert.throws(() => normalize(input), TypeError);
});
test('empty collections still render an empty section', () => {
  assert.deepEqual(normalize([]), [{ items: [] }]);
  assert.deepEqual(normalize({ sections: [] }), [{ items: [] }]);
});
test('cyclic folder structures are rejected', () => {
  const folder = { items: [] }; folder.items.push(folder);
  assert.throws(() => normalize([folder]), /20 levels/);
});
