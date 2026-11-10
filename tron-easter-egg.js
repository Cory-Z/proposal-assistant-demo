/*
 * tron-easter-egg.js
 * -----------------------------------------------------------------------
 * A harmless, mostly cosmetic easter egg that doubles as a quick site-speed
 * check. It does NOT touch authentication, does NOT know or care whether the
 * user is logged in, and does NOT navigate anywhere -- it just draws a
 * full-screen overlay on top of whatever is already on screen (the login view
 * or the logged-in app) and removes itself when closed, leaving that
 * underlying view exactly as it was. Nothing it measures is sent anywhere:
 * all timing data stays in the browser and is only shown on screen.
 *
 * Trigger: type the word TRON anywhere on the page (no need to click into
 * a text box first), OR enter the classic arrow sequence:
 * Up, Up, Down, Down, Left, Right, Left, Right.
 *
 * Flow once triggered:
 *   1. A short boot-sequence loading screen.
 *   2. Best-of-three light-cycle rounds against a simple AI opponent.
 *      After each round ends, press Enter to play the next one.
 *   3. After round 3 (or if you press Escape early), an exit screen plays,
 *      then a SYSTEM CHECK report appears and stays up until you press
 *      Enter or Escape, or click the close button.
 * Escape always works, at any point.
 *
 * SITE SPEED CHECK:
 *   - A small readout in the top-right corner shows live FPS, average and
 *     worst frame time, and the current grid speed.
 *   - The light cycles move one grid step every few animation frames instead
 *     of on a fixed timer, so if the page is struggling the cycles visibly
 *     slow down. At a 60 Hz display that is 15 steps per second (about the
 *     same pace as before). High-refresh displays (90 Hz+) are detected
 *     automatically so they don't make the game run too fast.
 *   - The SYSTEM CHECK report shows a GOOD / OK / SLOW verdict, FPS and
 *     frame-time numbers, page load time, proposals/index.json load time,
 *     and the three slowest resources.
 *   - This measures THIS browser on THIS computer right now, not the health
 *     of the hosting. All thresholds are in SPEED_CHECK below.
 *
 * To install: this file is already included from index.html via
 *   <script src="tron-easter-egg.js" defer></script>
 */
(function () {
  'use strict';

  var TYPED_TRIGGER = 'tron';
  var ARROW_TRIGGER = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight'];
  var TOTAL_ROUNDS = 3;

  // Tuning knobs for the speed check. Change these to make the verdict stricter or looser.
  var SPEED_CHECK = {
    stepsPerSecond: 15,        // light-cycle speed at normal frame rate (60 Hz / 4 frames per step)
    stallMs: 50,               // a frame longer than this counts as a "stall"
    fpsGoodRatio: 0.9,         // average FPS must be at least this fraction of the display refresh rate for GOOD
    fpsOkRatio: 0.6,           // ...and at least this fraction for OK (below it is SLOW)
    maxStallsForGood: 3,       // more stalls than this can't be GOOD
    pageLoadGoodMs: 3000,      // page load at or under this is GOOD
    pageLoadOkMs: 6000,        // ...at or under this is OK (above it is SLOW)
    indexGoodMs: 1000,         // proposals/index.json load at or under this is GOOD
    indexOkMs: 3000,           // ...at or under this is OK (above it is SLOW)
    minFramesForVerdict: 120   // fewer measured frames than this = "not enough data"
  };

  var typedBuffer = '';
  var arrowBuffer = [];
  var gameActive = false;

  function isTypingTarget(el) {
    if (!el) return false;
    var tag = el.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
  }

  window.addEventListener('keydown', function (e) {
    if (gameActive) return;
    if (isTypingTarget(document.activeElement)) return;

    if (e.key && e.key.length === 1) {
      typedBuffer = (typedBuffer + e.key.toLowerCase()).slice(-TYPED_TRIGGER.length);
      if (typedBuffer === TYPED_TRIGGER) {
        typedBuffer = '';
        openGrid();
        return;
      }
    }

    if (ARROW_TRIGGER.indexOf(e.key) !== -1) {
      arrowBuffer.push(e.key);
      if (arrowBuffer.length > ARROW_TRIGGER.length) arrowBuffer.shift();
      if (arrowBuffer.length === ARROW_TRIGGER.length && arrowBuffer.every(function (k, i) { return k === ARROW_TRIGGER[i]; })) {
        arrowBuffer = [];
        openGrid();
      }
    } else if (e.key && e.key.indexOf('Arrow') !== 0) {
      arrowBuffer = [];
    }
  });

  function openGrid() {
    if (document.getElementById('tron-egg-overlay')) return;
    gameActive = true;

    var timers = [];
    function later(fn, ms) { var id = setTimeout(fn, ms); timers.push(id); return id; }

    var overlay = document.createElement('div');
    overlay.id = 'tron-egg-overlay';
    overlay.style.cssText = [
      'position:fixed', 'inset:0', 'z-index:999999', 'background:#000',
      'display:flex', 'flex-direction:column', 'align-items:center', 'justify-content:center',
      'font-family:"Fira Code","Consolas","Menlo","Monaco","Courier New",monospace'
    ].join(';');

    var title = document.createElement('div');
    title.textContent = 'THE GRID';
    title.style.cssText = 'color:#00fff2;font-size:28px;letter-spacing:6px;margin-bottom:10px;text-shadow:0 0 10px #00fff2;';
    overlay.appendChild(title);

    var dotsWrap = document.createElement('div');
    dotsWrap.style.cssText = 'display:flex;gap:10px;margin-bottom:14px;';
    var dots = [];
    for (var i = 0; i < TOTAL_ROUNDS; i++) {
      var d = document.createElement('div');
      d.style.cssText = 'width:16px;height:16px;border:2px solid #335;border-radius:3px;box-sizing:border-box;transition:all .2s;';
      dotsWrap.appendChild(d);
      dots.push(d);
    }
    overlay.appendChild(dotsWrap);

    function setCurrentRound(n) {
      dots.forEach(function (d, idx) {
        d.style.borderColor = (idx === n - 1) ? '#00fff2' : '#335';
        d.style.boxShadow = (idx === n - 1) ? '0 0 8px #00fff2' : 'none';
      });
    }
    function setRoundResult(n, outcome) {
      var color = outcome === 'win' ? '#00fff2' : (outcome === 'lose' ? '#ff3b3b' : '#aaaaaa');
      dots[n - 1].style.background = color;
      dots[n - 1].style.borderColor = color;
      dots[n - 1].style.boxShadow = 'none';
    }

    // ---- Live speed readout (top-right corner) ----------------------------
    var hud = document.createElement('div');
    hud.id = 'tron-egg-hud';
    hud.style.cssText = [
      'position:absolute', 'top:12px', 'right:12px', 'text-align:left', 'color:#00fff2',
      'font-size:11px', 'line-height:1.55', 'letter-spacing:1px', 'padding:8px 10px',
      'border:1px solid rgba(0,255,242,0.35)', 'border-radius:4px', 'background:rgba(0,0,0,0.65)',
      'min-width:150px', 'pointer-events:none'
    ].join(';');
    hud.textContent = 'SPEED CHECK...';
    overlay.appendChild(hud);

    document.body.appendChild(overlay);

    // ---- Frame timing -------------------------------------------------------
    var perf = {
      last: null, count: 0, sum: 0, worst: 0, stalls: 0,
      early: [],          // first ~600 frame times, used to detect a high-refresh display
      winStart: null, winFrames: 0, fps: 0,
      refreshHz: 60,
      stepFrames: 4       // animation frames per light-cycle step
    };
    var frameHook = null; // set by a running round; called once per animation frame
    var rafId = null;

    function onFrame(ts) {
      rafId = requestAnimationFrame(onFrame);
      if (perf.last !== null) {
        var dt = ts - perf.last;
        if (dt > 0 && dt < 1000) { // 1s or more = tab hidden/paused, not a slow site
          perf.count++;
          perf.sum += dt;
          if (dt > perf.worst) perf.worst = dt;
          if (dt > SPEED_CHECK.stallMs) perf.stalls++;
          if (perf.early.length < 600) perf.early.push(dt);
          perf.winFrames++;
        } else if (dt >= 1000) {
          perf.winStart = ts;
          perf.winFrames = 0;
        }
      }
      perf.last = ts;
      if (perf.winStart === null) perf.winStart = ts;
      if (ts - perf.winStart >= 500) {
        perf.fps = perf.winFrames * 1000 / (ts - perf.winStart);
        perf.winStart = ts;
        perf.winFrames = 0;
        updateHud();
      }
      if (frameHook) frameHook();
    }
    rafId = requestAnimationFrame(onFrame);

    // Frames per light-cycle step. Normal (~60 Hz) displays use 4, so a slow page really does slow the cycles.
    // Only if the fastest frames are clearly faster than 60 Hz do we use more frames per step.
    function detectStepFrames() {
      var base = Math.max(1, Math.round(60 / SPEED_CHECK.stepsPerSecond));
      perf.refreshHz = 60;
      var sample = perf.early.filter(function (v) { return v > 3; }).sort(function (a, b) { return a - b; });
      if (sample.length < 30) return base;
      var p10 = sample[Math.floor(sample.length * 0.1)];
      if (p10 <= 11.5) {
        var rates = [90, 100, 120, 144, 165, 240];
        var hz = 1000 / p10;
        var nearest = rates.reduce(function (best, r) { return Math.abs(r - hz) < Math.abs(best - hz) ? r : best; }, rates[0]);
        perf.refreshHz = nearest;
        return Math.max(base, Math.round(nearest / SPEED_CHECK.stepsPerSecond));
      }
      return base;
    }

    function getStats() {
      var avg = perf.count ? perf.sum / perf.count : 0;
      var avgFps = avg ? 1000 / avg : 0;
      return {
        frames: perf.count, avgMs: avg, avgFps: avgFps, worstMs: perf.worst,
        stalls: perf.stalls, ratio: avgFps / perf.refreshHz
      };
    }

    function ratioColor(r) {
      return r >= SPEED_CHECK.fpsGoodRatio ? '#00fff2' : (r >= SPEED_CHECK.fpsOkRatio ? '#ff8c00' : '#ff3b3b');
    }

    function updateHud() {
      var s = getStats();
      if (!s.frames || !perf.fps) return;
      var steps = perf.fps / perf.stepFrames;
      hud.innerHTML =
        '<div style="color:#667;letter-spacing:2px;">SPEED CHECK</div>' +
        '<div>FPS <span style="color:' + ratioColor(perf.fps / perf.refreshHz) + ';">' + perf.fps.toFixed(1) + '</span></div>' +
        '<div>FRAME AVG ' + s.avgMs.toFixed(1) + ' ms</div>' +
        '<div>FRAME WORST ' + Math.round(s.worstMs) + ' ms</div>' +
        '<div>GRID SPEED ' + steps.toFixed(1) + ' /s</div>';
    }

    // ---- Page load numbers (browser Performance API) -------------------------
    function formatMs(ms) {
      if (ms === null || ms === undefined || isNaN(ms)) return 'n/a';
      return ms >= 1000 ? (ms / 1000).toFixed(2) + ' s' : Math.round(ms) + ' ms';
    }
    function shortName(url) {
      try {
        var u = new URL(url, location.href);
        var name = decodeURIComponent(u.pathname.split('/').filter(Boolean).pop() || u.hostname);
        return name.length > 38 ? name.slice(0, 35) + '...' : name;
      } catch (e) { return String(url).slice(0, 38); }
    }
    function getLoadTimes() {
      var out = { pageLoadMs: null, indexMs: null, slowest: [] };
      try {
        var nav = performance.getEntriesByType('navigation')[0];
        if (nav) {
          if (nav.loadEventEnd > 0) out.pageLoadMs = nav.loadEventEnd - nav.startTime;
          else if (nav.domContentLoadedEventEnd > 0) out.pageLoadMs = nav.domContentLoadedEventEnd - nav.startTime;
        }
        var res = performance.getEntriesByType('resource');
        for (var r = 0; r < res.length; r++) {
          if (res[r].name.indexOf('proposals/index.json') !== -1) { out.indexMs = res[r].duration; break; }
        }
        out.slowest = res
          .filter(function (e) {
            // Firestore keeps long-lived streaming connections open on purpose; their duration is not a load time.
            return e.duration > 0 && e.name.indexOf('data:') !== 0 && !/firestore\.googleapis\.com/.test(e.name);
          })
          .sort(function (a, b) { return b.duration - a.duration; })
          .slice(0, 3)
          .map(function (e) { return { name: shortName(e.name), ms: e.duration }; });
      } catch (e) { /* older browser: report shows n/a */ }
      return out;
    }

    // ---- GOOD / OK / SLOW verdict ---------------------------------------------
    function rateSpeed(stats, load) {
      if (stats.frames < SPEED_CHECK.minFramesForVerdict) {
        return { label: 'NOT ENOUGH DATA', color: '#aaaaaa', why: ['play a full match for a reliable reading'] };
      }
      var level = 0, why = [];
      function bump(l, text) { if (l > level) level = l; if (l > 0) why.push(text); }

      var fpsLevel = stats.ratio >= SPEED_CHECK.fpsGoodRatio ? 0 : (stats.ratio >= SPEED_CHECK.fpsOkRatio ? 1 : 2);
      if (fpsLevel > 0) bump(fpsLevel, 'frame rate averaged ' + stats.avgFps.toFixed(0) + ' fps');
      if (stats.stalls > SPEED_CHECK.maxStallsForGood) bump(Math.max(1, fpsLevel), stats.stalls + ' frames stalled over ' + SPEED_CHECK.stallMs + ' ms');

      if (load.pageLoadMs !== null) {
        var pl = load.pageLoadMs <= SPEED_CHECK.pageLoadGoodMs ? 0 : (load.pageLoadMs <= SPEED_CHECK.pageLoadOkMs ? 1 : 2);
        if (pl > 0) bump(pl, 'page took ' + formatMs(load.pageLoadMs) + ' to load');
      }
      if (load.indexMs !== null) {
        var il = load.indexMs <= SPEED_CHECK.indexGoodMs ? 0 : (load.indexMs <= SPEED_CHECK.indexOkMs ? 1 : 2);
        if (il > 0) bump(il, 'index.json took ' + formatMs(load.indexMs));
      }
      return level === 0 ? { label: 'GOOD', color: '#00fff2', why: [] }
           : level === 1 ? { label: 'OK', color: '#ff8c00', why: why }
           : { label: 'SLOW', color: '#ff3b3b', why: why };
    }

    var session = { round: 0, results: [], phase: 'loading', reportShown: false, skipExit: null };
    var steer = null;

    function closeGrid() {
      timers.forEach(clearTimeout);
      if (rafId !== null) cancelAnimationFrame(rafId);
      frameHook = null;
      window.removeEventListener('keydown', keyHandler);
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
      gameActive = false;
      // Deliberately does nothing else: no navigation, no auth check, no state change.
    }

    function clearRoundUI() {
      ['tron-egg-status', 'tron-egg-canvas', 'tron-egg-exitbtn', 'tron-egg-loading', 'tron-egg-exit', 'tron-egg-report'].forEach(function (id) {
        var el = document.getElementById(id);
        if (el && el.parentNode) el.parentNode.removeChild(el);
      });
    }

    // On the exit screen: first Enter/Esc skips ahead to the report, the next closes.
    function exitAdvance() {
      if (session.reportShown) { closeGrid(); return; }
      if (session.skipExit) { session.skipExit(); return; }
      closeGrid();
    }

    function handleExitRequest() {
      if (session.phase === 'exiting') { exitAdvance(); return; }
      goToExit('ABORTED');
    }

    function keyHandler(e) {
      if (e.key === 'Escape') { handleExitRequest(); return; }
      if (e.key === 'Enter') {
        if (session.phase === 'awaiting-enter') { startRound(session.round + 1); }
        else if (session.phase === 'exiting') { exitAdvance(); }
        return;
      }
      var map = {
        ArrowUp: { x: 0, y: -1 }, ArrowDown: { x: 0, y: 1 },
        ArrowLeft: { x: -1, y: 0 }, ArrowRight: { x: 1, y: 0 }
      };
      var dir = map[e.key];
      if (!dir) return;
      e.preventDefault();
      if (session.phase === 'round' && steer) steer(dir);
    }
    window.addEventListener('keydown', keyHandler);

    function computeVerdict(results) {
      var wins = results.filter(function (r) { return r === 'win'; }).length;
      var losses = results.filter(function (r) { return r === 'lose'; }).length;
      if (wins >= 2) return 'WIN';
      if (losses >= 2) return 'LOSE';
      return 'TIE';
    }

    function startRound(n) {
      clearRoundUI();
      session.round = n;
      session.phase = 'round';
      setCurrentRound(n);
      runOneRound(n, function (outcome) {
        session.results.push(outcome);
        setRoundResult(n, outcome);
        var status = document.getElementById('tron-egg-status');
        if (n < TOTAL_ROUNDS) {
          session.phase = 'awaiting-enter';
          if (status) status.textContent =
            'ROUND ' + n + ' OF ' + TOTAL_ROUNDS + ' RESULT: ' + outcomeLabel(outcome) +
            '  ·  PRESS ENTER FOR ROUND ' + (n + 1) + ' OF ' + TOTAL_ROUNDS + '  ·  ESC TO EXIT';
        } else {
          session.phase = 'round-over-final';
          goToExit(computeVerdict(session.results));
        }
      });
    }

    function outcomeLabel(outcome) {
      return outcome === 'win' ? 'YOU WIN' : (outcome === 'lose' ? 'YOU LOSE' : 'DRAW');
    }

    function goToExit(kind) {
      session.phase = 'exiting';
      frameHook = null; // stop any round still stepping
      steer = null;
      var canvasEl = document.getElementById('tron-egg-canvas');
      var statusEl = document.getElementById('tron-egg-status');
      runCrashEffect(canvasEl, statusEl, function () {
        clearRoundUI();
        runExitSequence(kind);
      });
    }

    function runCrashEffect(canvasEl, statusEl, onDone) {
      if (!canvasEl) { onDone(); return; }
      var ctx = canvasEl.getContext('2d');
      var w = canvasEl.width, h = canvasEl.height;
      var frames = 9;
      var i = 0;
      overlay.style.transition = 'transform 0.05s';
      if (statusEl) statusEl.textContent = '!! CRITICAL FAILURE !!';

      function frame() {
        if (i >= frames) {
          overlay.style.transform = 'none';
          ctx.fillStyle = '#fff';
          ctx.fillRect(0, 0, w, h);
          later(function () {
            ctx.fillStyle = '#000';
            ctx.fillRect(0, 0, w, h);
            onDone();
          }, 90);
          return;
        }
        var dx = (Math.random() - 0.5) * 14, dy = (Math.random() - 0.5) * 14;
        overlay.style.transform = 'translate(' + dx + 'px,' + dy + 'px)';
        if (i % 2 === 0) {
          ctx.fillStyle = 'rgba(255,0,0,0.55)';
          ctx.fillRect(0, 0, w, h);
        } else {
          ctx.fillStyle = '#000';
          ctx.fillRect(0, 0, w, h);
          for (var n = 0; n < 90; n++) {
            ctx.fillStyle = Math.random() > 0.5 ? '#fff' : '#0ff';
            ctx.fillRect(Math.random() * w, Math.random() * h, 3, 3);
          }
        }
        i++;
        later(frame, 60);
      }
      frame();
    }

    function runOneRound(roundNum, onRoundEnd) {
      var sub = document.createElement('div');
      sub.id = 'tron-egg-status';
      sub.style.cssText = 'color:#ff8c00;font-size:13px;letter-spacing:2px;margin-bottom:14px;text-align:center;max-width:90vw;';
      sub.textContent = 'ROUND ' + roundNum + ' OF ' + TOTAL_ROUNDS + '  ·  YOU: CYAN  ·  OPPONENT: RED  ·  ARROW KEYS TO STEER  ·  ESC TO EXIT';

      var canvas = document.createElement('canvas');
      canvas.id = 'tron-egg-canvas';
      var size = Math.min(window.innerWidth, window.innerHeight) * 0.8;
      canvas.width = size;
      canvas.height = size;
      canvas.style.cssText = 'border:2px solid #00fff2;box-shadow:0 0 30px rgba(0,255,242,0.4);background:#000;';

      var exitBtn = document.createElement('button');
      exitBtn.id = 'tron-egg-exitbtn';
      exitBtn.textContent = 'Exit the Grid';
      exitBtn.style.cssText = [
        'margin-top:16px', 'padding:8px 20px', 'background:transparent', 'color:#00fff2',
        'border:1px solid #00fff2', 'border-radius:4px', 'cursor:pointer',
        'font-family:"Fira Code","Consolas","Menlo","Monaco","Courier New",monospace', 'letter-spacing:2px'
      ].join(';');
      exitBtn.onclick = handleExitRequest;

      overlay.appendChild(sub);
      overlay.appendChild(canvas);
      overlay.appendChild(exitBtn);

      var ctx = canvas.getContext('2d');
      var cell = 10;
      var cols = Math.floor(canvas.width / cell);
      var rows = Math.floor(canvas.height / cell);
      var trail = {};
      var over = false;

      var player = { pos: { x: Math.floor(cols * 0.25), y: Math.floor(rows / 2) }, dir: { x: 1, y: 0 } };
      var bot = { pos: { x: Math.floor(cols * 0.75), y: Math.floor(rows / 2) }, dir: { x: -1, y: 0 } };
      var nextPlayerDir = player.dir;

      function key(x, y) { return x + ',' + y; }
      trail[key(player.pos.x, player.pos.y)] = 'p';
      trail[key(bot.pos.x, bot.pos.y)] = 'b';

      steer = function (d) {
        if (d.x === -player.dir.x && d.y === -player.dir.y) return;
        nextPlayerDir = d;
      };

      var ALL_DIRS = [{ x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }];
      function inBounds(p) { return p.x >= 0 && p.y >= 0 && p.x < cols && p.y < rows; }
      function occupied(p) { return !!trail[key(p.x, p.y)]; }

      var RANDOM_MOVE_CHANCE = 0.05;
      var RANDOM_MOVE_COOLDOWN = 25;
      var lastRandomMoveTick = -Infinity;
      var botTick = 0;
      var CHASE_CHANCE = 0.25;

      var FLOOD_FILL_CAP = 60;
      function floodFillSize(start) {
        var seen = {};
        seen[start.x + ',' + start.y] = true;
        var queue = [start];
        var count = 0;
        while (queue.length && count < FLOOD_FILL_CAP) {
          var p = queue.shift();
          count++;
          ALL_DIRS.forEach(function (d) {
            var next = { x: p.x + d.x, y: p.y + d.y };
            var k = next.x + ',' + next.y;
            if (!seen[k] && inBounds(next) && !occupied(next)) {
              seen[k] = true;
              queue.push(next);
            }
          });
        }
        return count;
      }

      // BFS distance map across open cells so "chase" routes around walls.
      function bfsDistanceMapFrom(start) {
        var dist = {};
        dist[start.x + ',' + start.y] = 0;
        var queue = [start];
        var head = 0;
        while (head < queue.length) {
          var p = queue[head++];
          var pd = dist[p.x + ',' + p.y];
          ALL_DIRS.forEach(function (d) {
            var next = { x: p.x + d.x, y: p.y + d.y };
            var k = next.x + ',' + next.y;
            if (dist[k] === undefined && inBounds(next) && !occupied(next)) {
              dist[k] = pd + 1;
              queue.push(next);
            }
          });
        }
        return dist;
      }

      function chooseBotDir() {
        botTick++;

        var turns = ALL_DIRS.filter(function (d) {
          return !(d.x === bot.dir.x && d.y === bot.dir.y) && !(d.x === -bot.dir.x && d.y === -bot.dir.y);
        });
        var safe = [bot.dir].concat(turns).filter(function (d) {
          var next = { x: bot.pos.x + d.x, y: bot.pos.y + d.y };
          return inBounds(next) && !occupied(next);
        });

        if (safe.length === 0) return bot.dir;

        var scored = safe.map(function (d) {
          var next = { x: bot.pos.x + d.x, y: bot.pos.y + d.y };
          return { dir: d, space: floodFillSize(next) };
        });
        var maxSpace = Math.max.apply(null, scored.map(function (s) { return s.space; }));
        safe = scored.filter(function (s) { return s.space >= maxSpace - 2; }).map(function (s) { return s.dir; });

        var cooldownElapsed = (botTick - lastRandomMoveTick) >= RANDOM_MOVE_COOLDOWN;
        if (cooldownElapsed && Math.random() < RANDOM_MOVE_CHANCE) {
          lastRandomMoveTick = botTick;
          return safe[Math.floor(Math.random() * safe.length)];
        }

        if (Math.random() < CHASE_CHANCE) {
          var distMap = bfsDistanceMapFrom(player.pos);
          var best = [], bestDist = Infinity;
          safe.forEach(function (d) {
            var next = { x: bot.pos.x + d.x, y: bot.pos.y + d.y };
            var dist = distMap[next.x + ',' + next.y];
            if (dist === undefined) dist = Infinity;
            if (dist < bestDist) { bestDist = dist; best = [d]; }
            else if (dist === bestDist) { best.push(d); }
          });
          if (best.length) return best[Math.floor(Math.random() * best.length)];
        }

        var straightIsSafe = safe.some(function (d) { return d.x === bot.dir.x && d.y === bot.dir.y; });
        if (straightIsSafe) return bot.dir;

        return safe[Math.floor(Math.random() * safe.length)];
      }

      function draw() {
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.strokeStyle = 'rgba(0,255,242,0.07)';
        for (var gx = 0; gx <= cols; gx++) { ctx.beginPath(); ctx.moveTo(gx * cell, 0); ctx.lineTo(gx * cell, canvas.height); ctx.stroke(); }
        for (var gy = 0; gy <= rows; gy++) { ctx.beginPath(); ctx.moveTo(0, gy * cell); ctx.lineTo(canvas.width, gy * cell); ctx.stroke(); }

        for (var k in trail) {
          var parts = k.split(','), tx = +parts[0], ty = +parts[1];
          ctx.fillStyle = trail[k] === 'p' ? 'rgba(0,255,242,0.55)' : 'rgba(255,59,59,0.55)';
          ctx.fillRect(tx * cell + 1, ty * cell + 1, cell - 2, cell - 2);
        }

        ctx.shadowBlur = 8;
        ctx.fillStyle = '#00fff2'; ctx.shadowColor = '#00fff2';
        ctx.fillRect(player.pos.x * cell + 1, player.pos.y * cell + 1, cell - 2, cell - 2);
        ctx.fillStyle = '#ff3b3b'; ctx.shadowColor = '#ff3b3b';
        ctx.fillRect(bot.pos.x * cell + 1, bot.pos.y * cell + 1, cell - 2, cell - 2);
        ctx.shadowBlur = 0;
      }

      function finish(outcome) {
        over = true;
        steer = null;
        frameHook = null;
        onRoundEnd(outcome);
      }

      function tick() {
        if (over) return;
        player.dir = nextPlayerDir;
        bot.dir = chooseBotDir();

        var playerNext = { x: player.pos.x + player.dir.x, y: player.pos.y + player.dir.y };
        var botNext = { x: bot.pos.x + bot.dir.x, y: bot.pos.y + bot.dir.y };

        var headOn = playerNext.x === botNext.x && playerNext.y === botNext.y;
        var playerCrash = !inBounds(playerNext) || occupied(playerNext) || headOn;
        var botCrash = !inBounds(botNext) || occupied(botNext) || headOn;

        if (playerCrash && botCrash) { draw(); finish('draw'); return; }
        if (playerCrash) { draw(); finish('lose'); return; }
        if (botCrash) { draw(); finish('win'); return; }

        player.pos = playerNext;
        bot.pos = botNext;
        trail[key(player.pos.x, player.pos.y)] = 'p';
        trail[key(bot.pos.x, bot.pos.y)] = 'b';
        draw();
      }

      // Frame-driven pacing: one grid step every perf.stepFrames animation frames
      // (4 frames = 15 steps/s at 60 Hz). A slow page = slower cycles.
      perf.stepFrames = detectStepFrames();
      var framesSinceStep = 0;
      draw();
      frameHook = function () {
        if (over) return;
        framesSinceStep++;
        if (framesSinceStep >= perf.stepFrames) {
          framesSinceStep = 0;
          tick();
        }
      };
    }

    function runExitSequence(kind) {
      var copy = {
        WIN: { lines: ['GRID SEQUENCE COMPLETE', 'ANALYZING PERFORMANCE...', 'VERDICT: PROGRAM SURVIVED', 'YOU BEAT THE GRID'], color: '#00fff2' },
        LOSE: { lines: ['GRID SEQUENCE COMPLETE', 'ANALYZING PERFORMANCE...', 'VERDICT: PROGRAM TERMINATED', 'YOU LOST TO THE GRID'], color: '#ff3b3b' },
        TIE: { lines: ['GRID SEQUENCE COMPLETE', 'ANALYZING PERFORMANCE...', 'VERDICT: INCONCLUSIVE', 'THE GRID REMAINS UNDECIDED'], color: '#ff8c00' },
        ABORTED: { lines: ['CONNECTION TERMINATED BY USER', 'DEREZ SEQUENCE ABORTED', 'NO VERDICT RECORDED', 'EXITING THE GRID'], color: '#ff8c00' }
      }[kind] || { lines: ['EXITING THE GRID'], color: '#ff8c00' };

      var exit = document.createElement('div');
      exit.id = 'tron-egg-exit';
      exit.style.cssText = 'color:#00fff2;font-size:13px;letter-spacing:2px;text-align:center;min-height:140px;';
      overlay.appendChild(exit);

      var exitTimers = [];
      function laterExit(fn, ms) { var id = later(fn, ms); exitTimers.push(id); return id; }

      function addLine(i, instant) {
        var text = copy.lines[i];
        var line = document.createElement('div');
        line.textContent = text;
        var isLast = i === copy.lines.length - 1;
        line.style.cssText = 'margin-bottom:6px;opacity:' + (instant ? '1' : '0') + ';transition:opacity .4s;' +
          (isLast
            ? ('color:' + copy.color + ';font-size:min(9vw,56px);font-weight:800;letter-spacing:2px;' +
               'text-shadow:0 0 18px ' + copy.color + ',0 0 40px ' + copy.color + ';margin-top:16px;')
            : '');
        exit.appendChild(line);
        if (!instant) later(function () { line.style.opacity = '1'; }, 10);
      }

      function showReport() {
        if (session.reportShown) return;
        session.reportShown = true;
        var stats = getStats();
        var load = getLoadTimes();
        var verdict = rateSpeed(stats, load);

        var rep = document.createElement('div');
        rep.id = 'tron-egg-report';
        rep.style.cssText = 'margin-top:14px;padding:12px 16px;border:1px solid ' + verdict.color + ';border-radius:4px;' +
          'color:#cfeff0;font-size:12px;line-height:1.6;letter-spacing:1px;text-align:left;max-width:min(92vw,560px);width:100%;box-sizing:border-box;' +
          'background:rgba(0,0,0,0.7);';

        var html = '<div style="color:#667;letter-spacing:3px;margin-bottom:4px;">SYSTEM CHECK</div>' +
          '<div style="font-size:20px;font-weight:800;color:' + verdict.color + ';text-shadow:0 0 10px ' + verdict.color + ';">SITE SPEED: ' + verdict.label + '</div>';
        if (verdict.why.length) html += '<div style="color:#ff8c00;margin-bottom:4px;">' + verdict.why.join(' · ') + '</div>';

        if (stats.frames >= SPEED_CHECK.minFramesForVerdict) {
          html += '<div>FPS (average) ' + stats.avgFps.toFixed(1) + ' of ~' + perf.refreshHz + ' Hz display</div>' +
                  '<div>FRAME TIME avg ' + stats.avgMs.toFixed(1) + ' ms · worst ' + Math.round(stats.worstMs) + ' ms · stalls over ' + SPEED_CHECK.stallMs + ' ms: ' + stats.stalls + '</div>';
        } else {
          html += '<div>FRAMES MEASURED ' + stats.frames + ' (need ' + SPEED_CHECK.minFramesForVerdict + ' for a verdict)</div>';
        }
        html += '<div>PAGE LOAD ' + formatMs(load.pageLoadMs) + ' · INDEX.JSON ' + formatMs(load.indexMs) + '</div>';
        if (load.slowest.length) {
          html += '<div style="margin-top:4px;color:#667;">SLOWEST RESOURCES</div>';
          load.slowest.forEach(function (r, idx) { html += '<div>' + (idx + 1) + '. ' + r.name + ' — ' + formatMs(r.ms) + '</div>'; });
        }
        html += '<div style="margin-top:6px;color:#667;font-size:11px;">Measures this browser and computer right now. Press ENTER or ESC to close.</div>';
        rep.innerHTML = html;

        var closeBtn = document.createElement('button');
        closeBtn.textContent = 'Close the Grid';
        closeBtn.style.cssText = [
          'margin-top:10px', 'padding:6px 16px', 'background:transparent', 'color:#00fff2',
          'border:1px solid #00fff2', 'border-radius:4px', 'cursor:pointer',
          'font-family:"Fira Code","Consolas","Menlo","Monaco","Courier New",monospace', 'letter-spacing:2px'
        ].join(';');
        closeBtn.onclick = closeGrid;
        rep.appendChild(closeBtn);
        overlay.appendChild(rep);
      }

      copy.lines.forEach(function (text, i) {
        laterExit(function () { addLine(i, false); }, i * 750);
      });
      laterExit(showReport, copy.lines.length * 750 + 600);

      // First Enter/Esc on the exit screen skips the animation and shows the report.
      session.skipExit = function () {
        exitTimers.forEach(clearTimeout);
        exit.innerHTML = '';
        for (var i = 0; i < copy.lines.length; i++) addLine(i, true);
        showReport();
      };
    }

    runLoadingSequence();

    function runLoadingSequence() {
      var loading = document.createElement('div');
      loading.id = 'tron-egg-loading';
      loading.style.cssText = 'color:#00fff2;font-size:13px;letter-spacing:2px;text-align:center;min-height:140px;';
      overlay.appendChild(loading);

      var lines = [
        'INITIALIZING GRID CONNECTION...',
        'SCANNING FOR PROGRAMS...',
        'OPPONENT PROGRAM DETECTED',
        'BEST OF ' + TOTAL_ROUNDS + ' ROUNDS  ·  DEREZ PROTOCOL ARMED',
        'ENTERING THE GRID'
      ];

      lines.forEach(function (text, i) {
        later(function () {
          var line = document.createElement('div');
          line.textContent = text;
          line.style.cssText = 'margin-bottom:6px;opacity:0;transition:opacity .25s;' + (i === lines.length - 1 ? 'color:#ff8c00;' : '');
          loading.appendChild(line);
          later(function () { line.style.opacity = '1'; }, 10);
        }, i * 700);
      });

      later(function () {
        clearRoundUI();
        startRound(1);
      }, lines.length * 700 + 1000);
    }
  }
})();
