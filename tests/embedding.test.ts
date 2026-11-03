import { test } from 'node:test';
import assert from 'node:assert/strict';
import OpenAI from 'openai';
import { embeddingConfig, requestEmbedding } from '../src/utils/embedding.ts';

test('legacy configuration and optional dimensions', () => {
  const c = embeddingConfig({OPENAI_URL:'https://chat.example/v1',OPENAI_KEY:'chat-key'});
  assert.equal(c.baseURL,'https://chat.example/v1');
  assert.equal(c.apiKey,'chat-key');
  assert.equal(c.model,'text-embedding-3-small');
  assert.equal(c.dimensions,undefined);
  assert.throws(() => embeddingConfig({OPENAI_EMBEDDING_DIMENSIONS:'768'}));
});
test('independent provider receives vector requests with its own key', async () => {
  const c = embeddingConfig({OPENAI_URL:'https://chat.example/v1',OPENAI_KEY:'chat-key',
    OPENAI_EMBEDDING_URL:'https://vector.example/v1',OPENAI_EMBEDDING_KEY:'vector-key',
    OPENAI_EMBEDDING_MODEL:'embedding-test',OPENAI_EMBEDDING_DIMENSIONS:'1536'});
  const client = new OpenAI({baseURL:c.baseURL,apiKey:c.apiKey,maxRetries:0,
    fetch: async (url, init) => {
      assert.equal(String(url),'https://vector.example/v1/embeddings');
      assert.equal(new Headers(init?.headers).get('authorization'),'Bearer vector-key');
      const body=JSON.parse(String(init?.body));
      assert.equal(body.model,'embedding-test');
      assert.equal(body.dimensions,1536);
      assert.equal(body.encoding_format,'float');
      return Response.json({data:[{embedding:Array(1536).fill(0.1)}]});
    }});
  assert.equal((await requestEmbedding(client,c,'test')).length,1536);
});
test('rejects empty, wrong-size and invalid numeric responses', async () => {
  const c=embeddingConfig({});
  for (const data of [[],[{embedding:[1]}],[{embedding:Array(1536).fill('bad')}],
      [{embedding:Array(1536).fill(Infinity)}]]) {
    const client={embeddings:{create:async()=>({data})}};
    await assert.rejects(requestEmbedding(client as any,c,'test'),/1536/);
  }
});
test('omits dimensions for legacy endpoints and propagates API errors', async () => {
  const c=embeddingConfig({});
  const client={embeddings:{create:async(body:any)=>{
    assert.equal('dimensions' in body,false);
    throw new Error('provider unavailable');
  }}};
  await assert.rejects(requestEmbedding(client as any,c,'test'),/provider unavailable/);
});

test('1024 config accepts only 1024 vectors', async () => {
  const c=embeddingConfig({OPENAI_EMBEDDING_DIMENSIONS:'1024',OPENAI_EMBEDDING_MODEL:'qwen3-embedding:0.6b'});
  const client={embeddings:{create:async(body:any)=>{
    assert.equal(body.dimensions,1024);
    return {data:[{embedding:Array(1024).fill(0.2)}]};
  }}};
  assert.equal((await requestEmbedding(client as any,c,'test')).length,1024);
  const wrong={embeddings:{create:async()=>({data:[{embedding:Array(1536).fill(0.2)}]})}};
  await assert.rejects(requestEmbedding(wrong as any,c,'test'),/1024/);
});
