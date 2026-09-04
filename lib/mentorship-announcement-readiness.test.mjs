import test from 'node:test'
import assert from 'node:assert/strict'
import {verify1080p} from './mentorship-announcement-readiness.mjs'
const guid='11111111-1111-1111-1111-111111111111'
const master='#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=8000,RESOLUTION=1920x1080\n1080p/video.m3u8\n'
const variant='#EXTM3U\n#EXTINF:4,\nsegment.ts\n#EXT-X-ENDLIST'
function fixture(m=master,v=variant,s=new Uint8Array([71,64,17,16])){return async url=>new Response(url.endsWith('playlist.m3u8')?m:url.endsWith('video.m3u8')?v:s)}
test('master + completed 1080p playlist + real segment are required',async()=>assert.equal((await verify1080p(guid,fixture())).resolution,'1920x1080'))
test('360p-only cannot announce',async()=>assert.rejects(verify1080p(guid,fixture(master.replace('1920x1080','640x360'))),/1080P/))
test('unfinished variant cannot announce',async()=>assert.rejects(verify1080p(guid,fixture(master,variant.replace('#EXT-X-ENDLIST',''))),/INCOMPLETE/))
test('missing segment cannot announce',async()=>assert.rejects(verify1080p(guid,fixture(master,variant,new Uint8Array())),/EMPTY/))
test('HLS redirects/foreign objects cannot escape video scope',async()=>assert.rejects(verify1080p(guid,fixture(master.replace('1080p/video.m3u8','https://foreign.invalid/video.m3u8'))),/OUTSIDE/))
