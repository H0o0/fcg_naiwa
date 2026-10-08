/* ============================================================
 *  玩法自检：分数奖励 + 结束结算 + 神奶蛙清场
 *  运行：node gameplay.test.js
 *
 *  覆盖：
 *    · 分数档位奖励跨阈值只解锁一次，并跨重开/刷新保留
 *    · 判负后直接结算，不显示续命流程
 *    · 两只神奶蛙相撞：一起消失、+500、大字飘分、定格
 * ============================================================ */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const root = __dirname;

function makeCtx() {
  const g = { addColorStop() {} };
  return {
    setTransform() {}, save() {}, restore() {}, scale() {}, rotate() {}, translate() {},
    clearRect() {}, fillRect() {}, beginPath() {}, closePath() {}, moveTo() {}, lineTo() {},
    arc() {}, ellipse() {}, clip() {}, stroke() {}, fill() {}, setLineDash() {},
    drawImage() {}, createLinearGradient: () => g, createRadialGradient: () => g,
    measureText: () => ({ width: 10 }), fillText() {}, strokeText() {},
    globalAlpha: 1, fillStyle: '', strokeStyle: '', lineWidth: 1,
    font: '', textAlign: '', textBaseline: '', lineCap: ''
  };
}

function makeEl(id) {
  const el = {
    id, style: {}, textContent: '', width: 680, height: 112,
    hidden: false, disabled: false, offsetWidth: 100, _c: new Set(), _h: {},
    classList: {
      add: (c) => el._c.add(c), remove: (c) => el._c.delete(c), contains: (c) => el._c.has(c)
    },
    getContext: () => el._ctx || (el._ctx = makeCtx()),
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 420, height: 700 }),
    addEventListener(t, fn) { el._h[t] = fn; },
    click() { if (el._h.click) el._h.click({ preventDefault() {} }); },
    querySelector: () => ({ textContent: '', style: {}, classList: { add() {}, remove() {} } }),
    setAttribute() {}, focus() {}, select() {}, blur() {}
  };
  return el;
}

const els = {};
['game', 'stage', 'overlay', 'score', 'best', 'finalScore', 'finalBest', 'scoreRewards', 'scoreRewardCount', 'next', 'chain',
 'soundBtn', 'resetBtn', 'restartBtn', 'overPanel',
 'boardBtn', 'boardBtn2', 'boardModal', 'boardList', 'boardClose', 'boardRefresh',
 'nickInput', 'myNameLabel', 'submitBtn', 'submitBox', 'submitMsg', 'editNameBtn'
].forEach((id) => { els[id] = makeEl(id); });
els.overPanel.hidden = false;

const winListeners = {};
const sandbox = {
  console, Math, Date, JSON, Object, Array, Number, String, Boolean, Error, isNaN, parseFloat, parseInt,
  performance: { now: () => Date.now() },
  requestAnimationFrame() { return 1; },
  setTimeout, clearTimeout, setInterval, clearInterval,
  document: {
    readyState: 'complete',
    getElementById: (id) => els[id] || null,
    addEventListener() {}, createElement: () => makeEl('tmp'),
    querySelector: () => null, querySelectorAll: () => []
  },
  localStorage: {
    _d: {}, getItem(k) { return this._d[k] ?? null; }, setItem(k, v) { this._d[k] = String(v); }
  },
  addEventListener(t, fn) { winListeners[t] = fn; },
  navigator: {},
  Image: class {
    constructor() { this.width = 512; this.height = 512; this.naturalWidth = 512; }
    set src(v) { this._src = v; if (this.onload) this.onload(); }
    get src() { return this._src; }
  }
};
sandbox.window = sandbox;
sandbox.window.addEventListener = (t, fn) => { winListeners[t] = fn; };
vm.createContext(sandbox);
const load = (f) => vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), sandbox, { filename: f });
load('assets/fruits/parts.js');
load('game.js');

let gameOverCalls = 0;
sandbox.window.DanaiwaBoard = { onGameOver() { gameOverCalls++; return 'orig'; } };

const G = sandbox.window.__DNW__;
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

let pass = 0, fail = 0;
function ok(cond, label, extra) {
  if (cond) { pass++; console.log('  ✓ ' + label); }
  else { fail++; console.log('  ✗ ' + label + (extra ? '  → ' + extra : '')); }
}
function eq(a, b, label) { ok(a === b, label, 'got ' + JSON.stringify(a) + ' want ' + JSON.stringify(b)); }

const ball = (y, r) => ({ x: 200, y, r: r || 30, dead: false, landed: true, overTime: 0, vx: 0, vy: 0, tier: 0 });

console.log('玩法自检：奖励 + 结算 + 清场\n');

/* ---------- A. 分数奖励 ---------- */
console.log('[A] 分数档位奖励只解锁一次');
G.reset();
G.addScore(999);
eq(G.state.rewardGiven, 0, '未到 1000 分不解锁');
G.addScore(1);
eq(G.state.rewardGiven, 1, '到 1000 分解锁第一段');
eq(els.scoreRewards.textContent, 'DLNUFCG', '首段解锁后固定显示');
eq(els.scoreRewardCount.textContent, '已收集 1/5', '显示已收集数量');
G.reset();
eq(G.state.rewardGiven, 1, '重开后保留已解锁记录');
eq(els.scoreRewards.textContent, 'DLNUFCG', '重开后片段仍固定显示');
G.addScore(1000);
eq(G.state.rewardGiven, 1, '已收集片段不会重复发放');
G.addScore(500);
eq(G.state.rewardGiven, 2, '到 1500 分解锁第二段');
eq(G.state.floats.filter((f) => f.text.indexOf('解锁片段') === 0).length, 1,
  '只提示本次新解锁片段');
G.addScore(2500);
eq(G.state.rewardGiven, 5, '一次跨过剩余三个档位');
G.addScore(1000);
eq(G.state.rewardGiven, 5, '已解锁的档位不重复发放');
G.settle();
eq(els.scoreRewards.textContent.split(' ').length, 5, '收集栏列出五段已解锁内容');
ok(['DLNUFCG', '{big_', 'naiwa', '_is_', 'here}'].every((part) =>
  els.scoreRewards.textContent.split(' ').includes(part)), '收集栏保留每段奖励');
G.reset();
eq(G.state.rewardGiven, 5, '重开后保留完整收集记录');
eq(els.scoreRewardCount.textContent, '已收集 5/5', '重开后数量仍正确');
eq(sandbox.localStorage.getItem('danaiwa.rewards.v1'), '5', '收集进度写入本地存储');

/* ---------- B. 判负后直接结算 ---------- */
console.log('[B] 判负后直接结算');
G.reset();
gameOverCalls = 0;
G.state.balls = [ball(600), ball(300)];
G.gameOver();
eq(els.overlay.classList.contains('show'), true, '遮罩弹出');
eq(els.overPanel.hidden, false, '直接是结算屏');
eq(gameOverCalls, 1, '成绩已提交');
eq(G.revive, undefined, '复活接口已移除');
eq(G.state.revives, undefined, '局内不再发放复活卡');
ok(!html.includes('sponsorBtn') && !html.includes('sponsorModal'), '赞助按钮和弹窗已移除');
ok(!html.includes('reviveBadge') && !html.includes('revivePrompt'), '复活卡和续命弹窗已移除');

/* ---------- C. 神奶蛙清场 ---------- */
console.log('\n[C] 两只神奶蛙一起炸掉');
G.reset();
const r10 = G.FRUITS[10].r;
G.state.balls.length = 0;
const wa = G.makeBall(210, 500, 10, 0, 0); wa.landed = true; wa.py = wa.y;
const wb = G.makeBall(210, 500 - (2 * r10 + 0.6), 10, 0, 0); wb.landed = true; wb.py = wb.y;
G.state.balls.push(wa, wb);
eq(G.state.balls.length, 2, '先摆好两只神奶蛙');

let merged = false;
for (let i = 0; i < 60 && !merged; i++) {
  G.stepPhysics(1 / 60);
  if (G.state.balls.length === 0) merged = true;
}
ok(merged, '两只神奶蛙相撞后一起消失');
eq(G.state.score, G.MAX_BONUS, '得分正好是 MAX_BONUS');
eq(G.MAX_BONUS, 500, 'MAX_BONUS 是 500（原来是 100）');
ok(G.state.freeze > 0, '触发了定格（freeze > 0）');
ok(G.state.freeze <= 0.2, '定格时长合理（≤200ms）');
const bigFloat = G.state.floats.filter((f) => f.big);
eq(bigFloat.length, 1, '有且只有一个大字飘分（不会和普通飘字重复）');
eq(bigFloat[0].text, '+500', '大字写的是 +500');
eq(G.state.floats.length, 2, '一共就两行飘字：大字 +500、小字说明');
ok(G.state.floats.some((f) => f.text.indexOf('两个神奶蛙') >= 0), '还有一行「两个神奶蛙」说明文字');

/* ---------- D. 定格会自己结束，不会卡死 ---------- */
console.log('\n[D] 定格会自己结束');
G.reset();
G.state.freeze = 0.13;
G.update(0.05);
ok(G.state.freeze > 0.07 && G.state.freeze < 0.09, '定格在倒计时（0.13 → 约 0.08）');
G.update(0.05);
G.update(0.05);
eq(G.state.freeze, 0, '倒计时结束后归零');
G.update(1 / 60);
eq(G.state.freeze, 0, '之后正常走更新，不报错');

/* 新页面实例从本地存储恢复已收集片段 */
load('game.js');
const restored = sandbox.window.__DNW__;
eq(restored.state.rewardGiven, 5, '刷新后从本地存储恢复收集进度');
eq(els.scoreRewardCount.textContent, '已收集 5/5', '刷新后收集栏保持完整');
delete sandbox.localStorage._d['danaiwa.rewards.v1'];
sandbox.localStorage.setItem('danaiwa.best.v1', '1092');
load('game.js');
const migrated = sandbox.window.__DNW__;
eq(migrated.state.rewardGiven, 1, '从旧版本最高分恢复已达到的首档');
eq(els.scoreRewardCount.textContent, '已收集 1/5', '旧最高分同步到固定收集栏');

console.log('\n' + pass + ' 通过 / ' + fail + ' 失败');
process.exit(fail ? 1 : 0);
