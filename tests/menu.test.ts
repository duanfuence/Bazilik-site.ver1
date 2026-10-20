import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatPrice, homePreviewIds, menu, menuGroups, priceLabel } from '../src/data/menu.ts';

const items = menu.flatMap((c) => c.items.map((item) => ({ ...item, category: c.title })));

test('идентификаторы разделов уникальны и годятся для якорных ссылок', () => {
  const ids = menu.map((c) => c.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const id of ids) assert.match(id, /^[a-z][a-z0-9-]*$/);
});

test('каждый раздел относится к существующей группе, пустых групп и разделов нет', () => {
  const groups = new Set(menuGroups.map((g) => g.id));
  for (const c of menu) {
    assert.ok(groups.has(c.group), `${c.title}: неизвестная группа ${c.group}`);
    assert.ok(c.items.length > 0, `${c.title}: пустой раздел`);
  }
  for (const g of menuGroups) assert.ok(menu.some((c) => c.group === g.id), `группа ${g.title} пуста`);
});

test('у каждой позиции есть цена: либо одна, либо по объёмам', () => {
  for (const it of items) {
    const has = it.price !== undefined || (it.prices?.length ?? 0) > 0;
    assert.ok(has, `${it.category} / ${it.name}: нет цены`);
    assert.ok(!(it.price !== undefined && it.prices?.length), `${it.category} / ${it.name}: и price, и prices`);
    for (const p of [it.price, ...(it.prices ?? []).map((x) => x.price)].filter((x) => x !== undefined)) {
      assert.ok(Number.isInteger(p) && p > 0, `${it.category} / ${it.name}: цена ${p}`);
    }
  }
});

test('выход и объём записаны единообразно («550 г», «150/40 г», «40 мл»)', () => {
  for (const it of items) {
    if (it.portion) assert.match(it.portion, /^\d+(\/\d+)? (г|мл)$/, `${it.category} / ${it.name}: «${it.portion}»`);
    for (const p of it.prices ?? []) assert.match(p.volume, /^\d+ мл$/, `${it.category} / ${it.name}: «${p.volume}»`);
  }
});

test('названия внутри раздела не повторяются', () => {
  for (const c of menu) {
    const names = c.items.map((i) => i.name.toLowerCase());
    assert.equal(new Set(names).size, names.length, c.title);
  }
});

test('цены форматируются по-русски', () => {
  assert.equal(formatPrice(1150), '1 150 ₽');
  assert.equal(priceLabel({ name: 'x', prices: [{ volume: '150 мл', price: 490 }, { volume: '750 мл', price: 2450 }] }), '490 / 2 450 ₽');
});

test('разделы для ленты на главной существуют и не пусты', () => {
  for (const id of homePreviewIds) {
    const c = menu.find((x) => x.id === id);
    assert.ok(c && c.items.length >= 2, `раздел ${id}`);
  }
});
