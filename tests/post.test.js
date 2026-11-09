// Phase 2-5 tests: post pipeline state machine (fake GL), shader source guards, boot order, deferred resolve.
const fs = require('fs'); global.window = global; let pass = 0, fail = 0; const ok = (c, m) => { c ? pass++ : (fail++, console.log('FAIL', m)) };
const calls = []; const mkGL = (complete = true) => new Proxy({ FRAMEBUFFER: 1, FRAMEBUFFER_COMPLETE: 2, checkFramebufferStatus: () => complete ? 2 : 0, getShaderParameter: () => true, getProgramParameter: (p, k) => k === 'n' ? 0 : true, getActiveUniform: () => null, createShader: () => ({}), createProgram: () => ({}), createTexture: () => ({}), createFramebuffer: () => ({}), createVertexArray: () => ({}), getUniformLocation: () => ({}), ACTIVE_UNIFORMS: 'n' }, { get: (t, k) => k in t ? t[k] : (...a) => { calls.push(String(k)); return undefined; } });
require('../js/post.js'); const Post = window.AotPost; ok(typeof Post === 'function', 'AotPost exported');
let E = { gl: mkGL(), time: 0, vao: {}, grade: 1 }; let P = new Post(E);
P.set(0); ok(!P.on, 'level 0 = off (direct path)'); P.set(2); ok(P.on && P.level === 2, 'level 2 on');
ok(P.begin(800, 400) === true && P.W === 800 && P.bl.length === 3, 'allocates scene + 3 bloom levels at level 2');
P.set(3); P.begin(800, 400); ok(P.bl.length === 4, 'level 3 has 4 bloom levels');
let E2 = { gl: mkGL(false), time: 0, vao: {}, grade: 1 }; let P2 = new Post(E2); P2.set(2); ok(P2.begin(800, 400) === false && !P2.on, 'incomplete FBO falls back to direct path');
// engine-level deferred resolve contract
const src = fs.readFileSync(__dirname + '/../js/engine.js', 'utf8'), post = fs.readFileSync(__dirname + '/../js/post.js', 'utf8'), game = fs.readFileSync(__dirname + '/../js/game.js', 'utf8'), boot = fs.readFileSync(__dirname + '/../js/boot.js', 'utf8');
ok(/deferPost/.test(src) && /endPost\(\)/.test(src), 'engine supports deferred post resolve');
ok(/E\.deferPost=true/.test(game) && /E\.endPost/.test(game), 'game resolves after actors/FX are drawn into the scene target');
ok(boot.indexOf("'js/post.js'") > boot.indexOf("'js/engine.js'") && boot.indexOf("'js/post.js'") < boot.indexOf("'js/quality.js'"), 'boot order engine, post, quality');
const POSTFS = post.slice(post.indexOf('const POST ='), post.indexOf('function mk(')); ok(!/aces|ACES/.test(POSTFS), 'post shader does not tone-map again (ACES stays in the scene shaders only)');
const mainFS = src.slice(src.indexOf('const MAIN_FS'), src.indexOf('const SHADOW_VS')); ok((mainFS.match(/aces\(lit/g) || []).length === 1, 'main shader tone-maps once');
ok(/skyFog\(normalize/.test(mainFS) && !/fogc=skyColor/.test(mainFS), 'main shader fog uses the cheap sky gradient, not the cloud layers');
ok(/stoneFx\(al\.rgb,N,u_stone\)/.test(mainFS) && /STONE=\{wall:1/.test(src), 'procedural masonry wired to wall/brick/stone materials');
ok(/loadStoneTex/.test(src) && /assets\/stone_albedo\.jpg/.test(src), 'optional external stone textures supported');
ok(/uniform vec3 sun,col,sunC,ambS,ambG,cam;/.test(game) && /\^\(titan\|colossal2\?\|armored\)\$/.test(game), 'titan skin shader has rim/SSS/specular with per-model strength');
const q = fs.readFileSync(__dirname + '/../js/quality.js', 'utf8'); ok(/E\.setPost/.test(q) && /post: 3/.test(q), 'tiers drive the post level');
console.log('post test: ' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
