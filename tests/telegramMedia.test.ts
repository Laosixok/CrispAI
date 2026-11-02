import { test } from 'node:test';
import assert from 'node:assert/strict';
import { selectMedia } from '../src/utils/telegramMedia.ts';
import type { Message } from 'grammy/types';
const select = (data: object) => selectMedia(data as Message);
test('selects largest photo without mutating album', () => {
  const photo = [{file_id:'small'}, {file_id:'large'}];
  assert.equal(select({photo})?.id, 'large');
  assert.equal(photo.length, 2);
});
test('preserves document original name and MIME', () => {
  assert.deepEqual(select({document:{file_id:'original',file_name:'截图.png',mime_type:'image/png',file_size:123}}),
    {id:'original',name:'截图.png',type:'image/png',size:123});
});
test('supports video and GIF', () => {
  assert.equal(select({video:{file_id:'video'}})?.type, 'video/mp4');
  assert.equal(select({animation:{file_id:'gif',mime_type:'image/gif',file_name:'a.gif'}})?.type, 'image/gif');
});
test('handles static, video, and animated stickers explicitly', () => {
  assert.equal(select({sticker:{file_id:'s'}})?.type, 'image/webp');
  assert.equal(select({sticker:{file_id:'s',is_video:true}})?.type, 'video/webm');
  assert.equal(select({sticker:{file_id:'tgs',is_animated:true,thumbnail:{file_id:'preview'}}})?.id, 'preview');
  assert.throws(() => select({sticker:{file_id:'tgs',is_animated:true}}));
});
test('plain text has no attachment', () => assert.equal(select({text:'hello'}), undefined));
