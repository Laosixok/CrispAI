import {test} from 'node:test';
import assert from 'node:assert/strict';
import {linkConfig, visitorOrigin, expandKnowledgeLinks} from '../src/utils/visitorLinks.ts';
import {requestCache} from '../src/utils/requestCache.ts';
const config=linkConfig({OFFICIAL_SITE_ORIGINS:'https://fwcloud.me,https://fwcloud.nl',DEFAULT_SITE_ORIGIN:'https://fwcloud.me'});
test('selects latest allowed page without exposing query or fragment',()=>{
 assert.equal(visitorOrigin([{page_url:'https://fwcloud.me/user?token=secret',timestamp:1},
 {page_url:'https://fwcloud.nl/user#private',timestamp:2},
 {page_url:'https://evil.test/',timestamp:3}],config),'https://fwcloud.nl');
});
test('rejects lookalike hosts, credentials and non-web schemes',()=>{
 for(const page_url of ['https://fwcloud.me.evil.test/','https://user:password@fwcloud.me/','javascript:alert(1)','https://fwcloud.me:444/'])
  assert.equal(visitorOrigin([{page_url}],config),'https://fwcloud.me');
 assert.equal(visitorOrigin([],linkConfig({})),undefined);
 assert.throws(()=>linkConfig({OFFICIAL_SITE_ORIGINS:'https://fwcloud.me/user'}));
 assert.throws(()=>linkConfig({DEFAULT_SITE_ORIGIN:'https://evil.test'}));
});
test('expands rooted links, preserves absolute URLs and punctuation',()=>{
 const text='教程：/user/help\n[教程](/user/help) `/user/help` /user/help. https://other.test/user/help //other.test/user/help';
 assert.equal(expandKnowledgeLinks(text,'https://fwcloud.nl'),
 '教程：https://fwcloud.nl/user/help\n[教程](https://fwcloud.nl/user/help) `https://fwcloud.nl/user/help` https://fwcloud.nl/user/help. https://other.test/user/help //other.test/user/help');
 assert.equal(expandKnowledgeLinks('/user/help'),'/user/help');
 assert.equal(expandKnowledgeLinks('/../user/help?x=1','https://fwcloud.me'),'/../user/help?x=1');
});
test('coalesces requests and isolates website/session keys',async()=>{
 const cached=requestCache<number>();let count=0;
 const get=async()=>++count;
 assert.deepEqual(await Promise.all([cached('site-a/session',get),cached('site-a/session',get)]),[1,1]);
 assert.equal(await cached('site-b/session',get),2);
});
test('caches failures briefly and bounds retained entries',async()=>{
 const cached=requestCache<number>(300000,1);let count=0;
 const fail=async()=>{count++;throw new Error('quota');};
 await assert.rejects(cached('a',fail));await assert.rejects(cached('a',fail));assert.equal(count,1);
 await cached('b',async()=>2);
 await assert.rejects(cached('a',fail));assert.equal(count,2);
});
