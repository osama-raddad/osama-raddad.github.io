/* Osama Raddad: the page's one script, loaded in the <head> without defer.
   Progressive enhancement only. Without it the page shows the Monochrome light
   theme, the menu stays open under the header, the background is the still silk,
   and all code can be selected and copied by hand.

   Six parts, the first three as on vynatix.com (app.js): the theme (Monochrome,
   light or dark), the mobile nav, the silk background's motion and its pause
   button; then this page's own: copy buttons, the listings' tab stops, and the
   header link for the section being read. */

// Theme: light or dark follows the visitor's choice from the toggle
// (localStorage "theme": "light" or "dark") and, without one, the system.
// It runs before the page paints, so there is no flash of the wrong theme.
(function () {
  var root = document.documentElement;
  var KEY = 'theme';
  // The canvas of each theme (md-sys-color-surface), for the browser chrome
  // colour before the body exists to be measured.
  var CANVAS = { 'mono-light': '#F5F1EA', 'mono-dark': '#14110F' };

  function isDark(theme) { return /(^|-)dark$/.test(theme); }
  function wantsDark() {
    var stored = null;
    try { stored = localStorage.getItem(KEY); } catch (e) { stored = null; }
    if (stored === 'light' || stored === 'dark') return stored === 'dark';
    return !!(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
  }
  function canvasColour(theme) {
    var bg = '';
    try { bg = getComputedStyle(document.body).backgroundColor; } catch (e) { bg = ''; }
    if (bg && bg !== 'transparent' && bg !== 'rgba(0, 0, 0, 0)') return bg;
    return CANVAS[theme] || CANVAS['mono-light'];
  }
  function applyTheme(theme, button) {
    root.setAttribute('data-theme', theme);
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', canvasColour(theme));
    // One name ("Dark theme"); aria-pressed carries the state.
    if (button) button.setAttribute('aria-pressed', String(isDark(theme)));
  }

  applyTheme(wantsDark() ? 'mono-dark' : 'mono-light', null);

  // Follow the system while the visitor has not chosen, and keep open tabs on one choice.
  function follow() {
    applyTheme(wantsDark() ? 'mono-dark' : 'mono-light', document.querySelector('.theme-toggle'));
  }
  window.addEventListener('storage', function (e) { if (e.key === KEY || e.key === null) follow(); });
  if (window.matchMedia) {
    var mq = window.matchMedia('(prefers-color-scheme: dark)');
    if (mq.addEventListener) mq.addEventListener('change', follow);
  }

  function init() {
    var button = document.querySelector('.theme-toggle');
    applyTheme(root.getAttribute('data-theme') || 'mono-light', button);
    if (!button) return;
    root.classList.add('js-theme');
    button.addEventListener('click', function () {
      var next = isDark(root.getAttribute('data-theme') || 'mono-light') ? 'mono-light' : 'mono-dark';
      applyTheme(next, button);
      try { localStorage.setItem(KEY, isDark(next) ? 'dark' : 'light'); } catch (e) { /* this page only */ }
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();

// Mobile nav — toggle the menu open/closed from the menu button.
(function () {
  // Opt into the collapsible mobile nav at once, here in the blocking head, so a phone
  // never paints the wrapped no-JS nav first and then collapses it (on a slow load that
  // moved the whole page about 115px under the reader). Without this class the nav stays
  // visible and wraps, so a no-JS visitor on a phone still has every link. init() takes
  // the class back off on a page with no menu button or nav, so no control sits dead.
  document.documentElement.classList.add('js-nav');

  // The listeners are delegated from the document and registered here too, so the menu
  // button works from the moment it is painted, not only once the page has been parsed.
  function parts() {
    return { toggle: document.querySelector('.mobile-toggle'), nav: document.querySelector('.site-header__nav') };
  }
  function setOpen(p, open) {
    p.nav.classList.toggle('open', open);
    p.toggle.setAttribute('aria-expanded', String(open));
  }

  document.addEventListener('click', function (e) {
    var t = e.target;
    if (!t || !t.closest) return;
    var p = parts();
    if (!p.toggle || !p.nav) return;
    if (t.closest('.mobile-toggle')) {
      setOpen(p, !p.nav.classList.contains('open'));
    } else if (t.closest('.site-header__nav .site-header__link')) {
      // Close the menu after following a link.
      setOpen(p, false);
    }
  });

  // Escape closes the menu and hands focus back to the button.
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    var p = parts();
    if (p.toggle && p.nav && p.nav.classList.contains('open')) {
      setOpen(p, false);
      p.toggle.focus();
    }
  });

  function init() {
    var p = parts();
    if (!p.toggle || !p.nav) document.documentElement.classList.remove('js-nav');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

// Silk waves — the page background is drawn live, and the visitor can stop it.
//
// styles.css paints a still silk behind every page (two soft layers of folds,
// body::before and body::after). When motion is wanted, this block lays a
// <canvas> over that still silk and draws the folds itself, frame by frame, in
// a small WebGL shader: the folds are computed, so they form, lean and dissolve
// rather than slide past as a picture would. The cloth also answers the
// visitor: it gives way softly around the pointer and rides with the scroll
// (listeners exist only while the canvas does). The three colours are read from
// the page (the canvas colour and the two silk layers' own), so the shader
// follows the theme and uses no colour of its own.
//
// The still silk is every other state, and no canvas exists in any of them:
// no JavaScript, prefers-reduced-motion, forced colours, a stored pause, a
// browser without WebGL, or a lost WebGL context. The footer's "Pause
// background motion" button (hidden until js-motion says it can work) stops
// the drawing and removes the canvas; the choice is kept in localStorage so
// every page agrees. Any stored value but "off" means moving. The phase comes
// from the clock, so the pattern carries on across pages instead of restarting.
(function () {
  var root = document.documentElement;
  var MOTION_KEY = 'motion';  // localStorage: "off" once paused, "on" once resumed
  // The button's two names. The page carries both, in its own language: the
  // text it is written with, and data-i18n-play for the other state.
  var LABEL = { on: 'Pause background motion', off: 'Play background motion' };
  var LOOP_MS = 240000;               // the whole pattern repeats seamlessly after four minutes
  var MAX_PIXELS = 1300000;           // the drawing buffer is capped; the silk is soft, so CSS scales it up unseen
  var quiet = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce), (forced-colors: active)') : null;
  var button = null, canvas = null, gl = null, uniforms = null, watcher = null;
  var frameId = 0, lastDraw = 0, unusable = false;
  // What the silk answers to: the pointer (where it is, and how strongly it presses: 1 while it is over the
  // page, 0 once it has left) and how far the page has scrolled. Each has a target, set by the listeners, and a
  // current value that the frame loop eases towards it, so the cloth never jumps.
  var want = { x: 0.5, y: 0.5, press: 0, scroll: 0 };
  var have = { x: 0.5, y: 0.5, press: 0, scroll: 0 };

  var VERTEX = 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}';
  // Two sine fields make the folds, and three passes of warping, each finer
  // and on its own slow beat, bend the space they are drawn in: that is what
  // makes the cloth swirl and pour like liquid instead of sliding. Where the
  // fields' sum is high the cloth catches the light, where it is low it falls
  // into shade. Every time term is
  // a whole multiple of one angle, so the pattern loops without a seam. The
  // last lines add up to one level of noise per pixel, which keeps the 8-bit
  // output from showing each brightness level as a stripe (colour banding).
  var FRAGMENT = [
    '#ifdef GL_FRAGMENT_PRECISION_HIGH',
    'precision highp float;',
    '#else',
    'precision mediump float;',
    '#endif',
    'uniform vec2 size;uniform float a;uniform vec3 c0;uniform vec3 c1;uniform vec3 c2;uniform vec3 m;uniform float s;',
    'void main(){',
    'vec2 u=gl_FragCoord.xy/size.y;',
    'vec2 dm=u-m.xy;float f=m.z*exp(-dot(dm,dm)*7.);',   // the pointer: a soft press, about a third of the view across
    'u+=dm*f*.4;u.y+=s;',                                // the cloth gives way around it, and rides with the scroll
    'vec2 q=vec2(u.x*.9-u.y*.44,u.x*.44+u.y*.9)*vec2(.8,2.3);',
    'q+=.28*vec2(sin(q.y*1.5+a*7.),cos(q.x*1.8-a*5.));',
    'q+=.17*vec2(sin(q.y*2.9-a*11.+1.3),cos(q.x*2.6+a*8.+.6));',
    'q+=.09*vec2(sin(q.y*5.1+a*13.+2.1),cos(q.x*4.7-a*9.+4.));',
    'float w=.6*sin(q.y*3.1+q.x*.9+a*6.)+.4*sin(q.y*5.3-q.x*1.7-a*10.+2.)+.5*f;',
    'float l=smoothstep(0.,1.,w);float d=smoothstep(0.,1.,-w);',
    'vec3 c=mix(c0,c1,.9*l*l);',
    'c=mix(c,c2,.8*d*d);',
    'vec2 g=mod(gl_FragCoord.xy,vec2(251.,241.));',
    'c+=(fract(sin(dot(g,vec2(12.9898,78.233)))*43758.5453)-.5)/127.5;',
    'gl_FragColor=vec4(c,1.);}'
  ].join('\n');

  function stored() {
    try { return localStorage.getItem(MOTION_KEY); } catch (e) { return null; }
  }
  function label(moving) {
    root.classList.toggle('js-waves', moving);
    if (button) button.textContent = moving ? LABEL.on : LABEL.off;
  }

  // "rgb(245, 241, 234)" or "color(srgb 0.94 0.92 0.88)" to three numbers from 0 to 1.
  function tone(text) {
    var n = (text || '').match(/-?\d*\.?\d+(?:e-?\d+)?/g);
    if (!n || n.length < 3) return null;
    var unit = /^color\(/.test(text) ? 1 : 255;
    return [n[0] / unit, n[1] / unit, n[2] / unit];
  }
  function readTones() {
    if (!gl || !document.body) return false;
    var c0 = tone(getComputedStyle(document.body).backgroundColor);
    var c1 = tone(getComputedStyle(document.body, '::before').backgroundColor);
    var c2 = tone(getComputedStyle(document.body, '::after').backgroundColor);
    if (!c0 || !c1 || !c2) return false;
    gl.uniform3f(uniforms.c0, c0[0], c0[1], c0[2]);
    gl.uniform3f(uniforms.c1, c1[0], c1[1], c1[2]);
    gl.uniform3f(uniforms.c2, c2[0], c2[1], c2[2]);
    return true;
  }
  function fit() {
    var w = window.innerWidth, h = window.innerHeight;
    var k = Math.min(1, Math.sqrt(MAX_PIXELS / Math.max(1, w * h)));
    w = Math.max(1, Math.round(w * k)); h = Math.max(1, Math.round(h * k));
    if (canvas.width === w && canvas.height === h) return;
    canvas.width = w; canvas.height = h;
    gl.viewport(0, 0, w, h);
    gl.uniform2f(uniforms.size, w, h);
  }
  // Eased by elapsed time, not by frame count, so it feels the same at 60 and at 120 frames a second.
  function ease(dt) {
    var near = function (ms) { return 1 - Math.exp(-dt / ms); };
    have.x += (want.x - have.x) * near(180); have.y += (want.y - have.y) * near(180);
    have.press += (want.press - have.press) * near(320);
    have.scroll += (want.scroll - have.scroll) * near(140);
  }
  function onPointer(e) {
    var h = window.innerHeight || 1;
    want.x = e.clientX / h; want.y = 1 - e.clientY / h;   // the shader's units: view heights, from the bottom left
    if (!want.press) { have.x = want.x; have.y = want.y; } // arriving: press in where it is, do not sweep across
    want.press = 1;
  }
  function onLeave() { want.press = 0; }
  function onScroll() { want.scroll = (window.pageYOffset || 0) / (window.innerHeight || 1) * 0.22; }
  function listen(on) {
    var f = on ? 'addEventListener' : 'removeEventListener';
    window[f]('pointermove', onPointer, { passive: true });
    window[f]('scroll', onScroll, { passive: true });
    document.documentElement[f]('pointerleave', onLeave);
    window[f]('blur', onLeave);
  }
  function draw(dt) {
    fit();
    ease(dt);
    gl.uniform3f(uniforms.m, have.x, have.y, have.press);
    gl.uniform1f(uniforms.s, have.scroll);
    gl.uniform1f(uniforms.a, (Date.now() % LOOP_MS) / LOOP_MS * 6.283185307179586);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
  // Every frame the display offers: liquid has to be smooth, and a skipped frame shows as a stutter.
  function frame(now) {
    frameId = requestAnimationFrame(frame);
    var dt = Math.min(100, Math.max(0, now - lastDraw));
    lastDraw = now;
    draw(dt);
  }

  function shader(type, source) {
    var s = gl.createShader(type);
    gl.shaderSource(s, source);
    gl.compileShader(s);
    return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null;
  }
  // Builds the canvas and its program. False (and unusable, for good) when the browser cannot do it.
  function build() {
    canvas = document.createElement('canvas');
    canvas.className = 'silk-canvas';
    canvas.setAttribute('aria-hidden', 'true');
    try {
      gl = canvas.getContext('webgl', { alpha: false, antialias: false, depth: false, stencil: false, powerPreference: 'low-power' });
    } catch (e) { gl = null; }
    if (!gl) return false;
    var vs = shader(gl.VERTEX_SHADER, VERTEX), fs = shader(gl.FRAGMENT_SHADER, FRAGMENT);
    var program = gl.createProgram();
    if (!vs || !fs) return false;
    gl.attachShader(program, vs); gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return false;
    gl.useProgram(program);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);   // one triangle over the whole view
    var at = gl.getAttribLocation(program, 'p');
    gl.enableVertexAttribArray(at);
    gl.vertexAttribPointer(at, 2, gl.FLOAT, false, 0, 0);
    uniforms = {
      size: gl.getUniformLocation(program, 'size'), a: gl.getUniformLocation(program, 'a'),
      c0: gl.getUniformLocation(program, 'c0'), c1: gl.getUniformLocation(program, 'c1'), c2: gl.getUniformLocation(program, 'c2'),
      m: gl.getUniformLocation(program, 'm'), s: gl.getUniformLocation(program, 's')
    };
    return true;
  }

  function stop() {
    if (frameId) cancelAnimationFrame(frameId);
    frameId = 0;
    if (watcher) watcher.disconnect();
    watcher = null;
    listen(false);
    root.classList.remove('js-waves-live');
    if (canvas && canvas.parentNode) canvas.parentNode.removeChild(canvas);
    canvas = null; gl = null; uniforms = null;
  }
  function giveUp() {
    unusable = true;
    stop();
    label(false);
    root.classList.remove('js-motion');   // no dead button
  }
  // Starts the live silk if it is wanted and allowed. True when it is running.
  function start() {
    if (canvas) return true;
    if (unusable || !document.body || (quiet && quiet.matches) || !root.classList.contains('js-waves')) return false;
    if (!build() || !readTones()) { giveUp(); return false; }
    canvas.addEventListener('webglcontextlost', function () {
      // Phones drop contexts freely. Back to the still silk; the button offers to start again.
      stop();
      label(false);
    });
    onScroll();
    have.scroll = want.scroll; want.press = 0; have.press = 0;
    listen(true);
    lastDraw = window.performance && performance.now ? performance.now() : 0;
    draw(0);
    document.body.insertBefore(canvas, document.body.firstChild);
    root.classList.add('js-waves-live');   // only now does the still silk step aside
    if (window.MutationObserver) {
      watcher = new MutationObserver(function () { if (gl) readTones(); });
      watcher.observe(root, { attributes: true, attributeFilter: ['data-theme'] });
    }
    frameId = requestAnimationFrame(frame);
    return true;
  }

  // First paint: only the class, so the button's label is right; the drawing starts after the page is up.
  label(stored() !== 'off');

  function init() {
    button = document.querySelector('.motion-toggle');
    if (button) {
      LABEL.on = button.textContent || LABEL.on;
      LABEL.off = button.getAttribute('data-i18n-play') || LABEL.off;
    }
    label(root.classList.contains('js-waves'));
    if (!window.WebGLRenderingContext || !window.requestAnimationFrame) { giveUp(); return; }
    if (button) {
      root.classList.add('js-motion');
      button.addEventListener('click', function () {
        var moving = !root.classList.contains('js-waves');
        label(moving);
        if (moving) start(); else stop();
        try {
          localStorage.setItem(MOTION_KEY, moving ? 'on' : 'off');
        } catch (e) {
          /* storage unavailable — the button still works for this page */
        }
      });
    }
    if (quiet && quiet.addEventListener) quiet.addEventListener('change', function () { if (quiet.matches) stop(); else start(); });
    // Not even one frame is asked for where nothing will be drawn (reduced motion, forced colours, a stored pause).
    if (root.classList.contains('js-waves') && !(quiet && quiet.matches)) requestAnimationFrame(function () { setTimeout(start, 0); });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

// This page's own features: copy buttons, listings, and the section being read.
(function () {
  'use strict';
  var root = document.documentElement;

  function ready(fn) {
    if (document.readyState !== 'loading') fn();
    else document.addEventListener('DOMContentLoaded', fn);
  }

  function selectContents(node) {
    var sel = window.getSelection ? window.getSelection() : null;
    if (!sel || !document.createRange) return;
    var range = document.createRange();
    range.selectNodeContents(node);
    sel.removeAllRanges();
    sel.addRange(range);
  }

  /* One live region serves every copy button. It is empty until a copy
     finishes, so a repeated message is announced again; only the newest
     message may clear it. */
  var liveRegion = null;
  var showTimer, clearTimer;
  function ensureLiveRegion() {
    if (liveRegion) return;
    liveRegion = document.createElement('p');
    liveRegion.className = 'vh';
    liveRegion.setAttribute('role', 'status');
    document.body.appendChild(liveRegion);
  }
  function announce(msg, ms) {
    clearTimeout(showTimer);
    clearTimeout(clearTimer);
    liveRegion.textContent = '';
    showTimer = setTimeout(function () {
      liveRegion.textContent = msg;
      clearTimer = setTimeout(function () {
        if (liveRegion.textContent === msg) liveRegion.textContent = '';
      }, ms);
    }, 50);
  }

  /* A Copy button. `o.text()` returns what it copies. On failure `o.source`
     is selected, so Ctrl+C or Cmd+C can finish the job. */
  function copyButton(o) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'copy';
    b.textContent = 'Copy';
    b.setAttribute('aria-label', o.aria);
    var timer;
    function show(text, ms) {
      b.textContent = text;
      clearTimeout(timer);
      timer = setTimeout(function () { b.textContent = 'Copy'; }, ms);
    }
    function failed() {
      selectContents(o.source);
      show('Copy failed', 3000);
      announce('Copy failed. The ' + o.noun + ' is selected, so you can copy it by hand.', 5000);
    }
    b.addEventListener('click', function () {
      var pending;
      try {
        pending = navigator.clipboard.writeText(o.text());
      } catch (e) {
        failed();
        return;
      }
      Promise.resolve(pending).then(function () {
        show('Copied', 2000);
        announce(o.done, 2000);
      }, failed);
    });
    return b;
  }

  /* Copy buttons in each listing head. */
  function buildCopyButtons() {
    if (!navigator.clipboard || !navigator.clipboard.writeText) return;
    ensureLiveRegion();
    var figures = document.querySelectorAll('figure.listing');
    Array.prototype.forEach.call(figures, function (fig) {
      var pre = fig.querySelector('pre');
      var tools = fig.querySelector('.lst-tools');
      if (!pre || !tools) return;
      var n = fig.querySelector('.lst-n');
      var label = fig.querySelector('.lst-label');
      var name = (n ? n.textContent : 'listing') + (label ? ', ' + label.textContent : '');
      tools.appendChild(copyButton({
        aria: 'Copy ' + name,
        source: pre,
        noun: 'code',
        text: function () { return pre.textContent; },
        done: (n ? n.textContent : 'Listing') + ' copied to the clipboard.'
      }));
    });
  }

  /* The contact email gets one copy button after its link. Without the
     Clipboard API no button is built, and the mailto link is all there is. */
  function buildCopyAddress() {
    if (!navigator.clipboard || !navigator.clipboard.writeText) return;
    var row = document.querySelector('.contact-email');
    var link = row && row.querySelector('a[href^="mailto:"]');
    if (!link) return;
    ensureLiveRegion();
    var address = link.getAttribute('href').replace(/^mailto:/, '');
    row.appendChild(copyButton({
      aria: 'Copy email address',
      source: link,
      noun: 'address',
      text: function () { return address; },
      done: 'Email address copied to the clipboard.'
    }));
  }

  /* Listings take a Tab stop only while they scroll sideways. The region role
     and its name exist to label that focusable scroller, so they come and go
     with it; otherwise every listing would be a landmark. Without this file
     all three stay, as written in the page. */
  function fitListings() {
    var pres = document.querySelectorAll('figure.listing pre');
    if (!pres.length) return;
    for (var j = 0; j < pres.length; j++) {
      var by = pres[j].getAttribute('aria-labelledby');
      if (by) pres[j].setAttribute('data-labelledby', by);
    }
    function fit() {
      for (var i = 0; i < pres.length; i++) {
        var pre = pres[i];
        if (pre.scrollWidth > pre.clientWidth + 1) {
          var label = pre.getAttribute('data-labelledby');
          pre.setAttribute('tabindex', '0');
          pre.setAttribute('role', 'region');
          if (label) pre.setAttribute('aria-labelledby', label);
        } else if (pre !== document.activeElement) {
          pre.removeAttribute('tabindex');
          pre.removeAttribute('role');
          pre.removeAttribute('aria-labelledby');
        }
      }
    }
    var ticking = false;
    window.addEventListener('resize', function () {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(function () { ticking = false; fit(); });
    });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(fit);
    fit();
  }

  /* The header marks the section being read (aria-current on its link). */
  function trackPosition() {
    var head = document.querySelector('.site-header');
    var links = Array.prototype.slice.call(document.querySelectorAll('.site-header__link[href^="#"]'));
    var sections = Array.prototype.slice.call(document.querySelectorAll('main > .sec[id]'));
    if (!head || !links.length || !sections.length) return;
    var current = null;
    var landing = 0;

    // The root's scroll-padding keeps a followed link's target clear of the floating
    // header; it follows the header's real height (a CSSOM write, which the CSP allows).
    function measure() {
      var r = head.getBoundingClientRect();
      var rem = parseFloat(getComputedStyle(root).fontSize) || 16;
      var stuck = parseFloat(getComputedStyle(head).top) || 0;
      if (r.height && getComputedStyle(head).position === 'sticky') {
        root.style.scrollPaddingTop = (stuck + r.height + 1.5 * rem) + 'px';
      } else {
        root.style.scrollPaddingTop = '';
      }
      landing = parseFloat(getComputedStyle(root).scrollPaddingTop) || 0;
    }

    function lastAbove(line) {
      var found = null;
      for (var i = 0; i < sections.length; i++) {
        if (sections[i].getBoundingClientRect().top <= line) found = sections[i];
      }
      return found;
    }
    function namedSection() {
      var id = location.hash.slice(1);
      try { id = decodeURIComponent(id); } catch (e) { /* keep it raw */ }
      for (var i = 0; i < sections.length; i++) if (sections[i].id === id) return sections[i];
      return null;
    }

    function update() {
      var vh = window.innerHeight;
      var line = Math.max(vh * 0.25, landing + 2);
      var sec = lastAbove(line);
      if (vh + window.scrollY >= document.documentElement.scrollHeight - 2) {
        var named = namedSection();
        var top = named ? named.getBoundingClientRect().top : -1;
        sec = named && top >= 0 && top < vh ? named : sections[sections.length - 1];
      }
      // Community has no header link; Experience stays marked while it is read.
      var id = sec ? sec.id : '';
      if (id === 'community') id = 'experience';
      if (id === current) return;
      current = id;
      links.forEach(function (a) {
        if (id && a.getAttribute('href') === '#' + id) a.setAttribute('aria-current', 'location');
        else a.removeAttribute('aria-current');
      });
    }

    var ticking = false;
    function schedule() {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(function () { ticking = false; update(); });
    }
    window.addEventListener('scroll', schedule, { passive: true });
    function remeasure() { measure(); schedule(); }
    window.addEventListener('resize', remeasure);
    window.addEventListener('hashchange', schedule);
    if (window.ResizeObserver) new window.ResizeObserver(remeasure).observe(head);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(remeasure);
    measure();
    update();
  }

  ready(function () {
    buildCopyButtons();
    buildCopyAddress();
    fitListings();
    trackPosition();
  });
})();
