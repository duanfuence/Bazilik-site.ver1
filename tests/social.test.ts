import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isValidSocialHref, site, socialLinks } from '../src/config/site.ts';

test('в конфигурации ровно три сети: Instagram, Telegram, ВКонтакте', () => {
  assert.deepEqual(site.social.map((s) => s.id), ['instagram', 'telegram', 'vk']);
});

test('каждая заполненная ссылка ведёт по https на домен своей сети', () => {
  for (const s of socialLinks) assert.ok(isValidSocialHref(s.id, s.href), `${s.label}: проверьте адрес ${s.href}`);
});

test('пустые ссылки на сайт не попадают', () => {
  assert.ok(socialLinks.every((s) => s.href.trim() !== ''));
});

test('проверка адресов: правильные и ошибочные примеры', () => {
  assert.ok(isValidSocialHref('instagram', 'https://www.instagram.com/bazilik'));
  assert.ok(isValidSocialHref('telegram', 'https://t.me/bazilik'));
  assert.ok(isValidSocialHref('vk', 'https://vk.com/bazilik'));
  assert.ok(!isValidSocialHref('vk', 'http://vk.com/bazilik'), 'только https');
  assert.ok(!isValidSocialHref('telegram', 'https://vk.com/bazilik'), 'чужой домен');
  assert.ok(!isValidSocialHref('instagram', 'https://instagram.com/'), 'без имени аккаунта');
  assert.ok(!isValidSocialHref('instagram', 'instagram.com/bazilik'), 'не полная ссылка');
});
