/* Progressive enhancement only. Without this file the page follows the
   system colour scheme, the running head still links every section, and
   all code can be selected and copied by hand. */
(function () {
  'use strict';
  var root = document.documentElement;
  var KEY = 'theme';
  var COLORS = { light: '#f4f2ee', dark: '#1f1d1a' };

  function readSaved() {
    try { return window.localStorage.getItem(KEY); } catch (e) { return null; }
  }
  function writeSaved(value) {
    try {
      if (value) window.localStorage.setItem(KEY, value);
      else window.localStorage.removeItem(KEY);
    } catch (e) { /* storage blocked: the choice lasts for this page only */ }
  }

  function applyTheme(value) {
    if (value === 'light' || value === 'dark') root.setAttribute('data-theme', value);
    else root.removeAttribute('data-theme');
  }

  function mode() {
    var t = root.getAttribute('data-theme');
    return t === 'light' || t === 'dark' ? t : 'auto';
  }

  function paintMeta() {
    var metas = document.querySelectorAll('meta[name="theme-color"]');
    var forced = root.getAttribute('data-theme');
    for (var i = 0; i < metas.length; i++) {
      var m = metas[i];
      if (!m.hasAttribute('data-media')) m.setAttribute('data-media', m.getAttribute('media') || '');
      var media = m.getAttribute('data-media');
      if (forced === 'light' || forced === 'dark') {
        m.removeAttribute('media');
        m.setAttribute('content', COLORS[forced]);
      } else {
        if (media) m.setAttribute('media', media);
        m.setAttribute('content', /dark/.test(media) ? COLORS.dark : COLORS.light);
      }
    }
  }

  // Apply a saved choice before first paint. This file loads in <head>, after
  // the theme-color metas, so the browser UI can match the page straight away.
  applyTheme(readSaved());
  paintMeta();

  // Keep every open tab on the same choice.
  var syncThemeSwitch = function () {};
  window.addEventListener('storage', function (e) {
    if (e.key !== KEY && e.key !== null) return;
    applyTheme(readSaved());
    paintMeta();
    syncThemeSwitch();
  });

  function ready(fn) {
    if (document.readyState !== 'loading') fn();
    else document.addEventListener('DOMContentLoaded', fn);
  }

  /* Theme: Auto follows the system; Light and Dark are remembered.
     One choice of three, so it is a radio group: Tab reaches the checked
     option and the arrow keys move between them. */
  function buildThemeSwitch() {
    var slot = document.querySelector('[data-theme-slot]');
    if (!slot) return;
    var group = document.createElement('div');
    group.className = 'theme-switch';
    var label = document.createElement('span');
    label.className = 'theme-k';
    label.id = 'theme-k';
    label.textContent = 'Theme';
    var opts = document.createElement('span');
    opts.className = 'theme-opts';
    opts.setAttribute('role', 'radiogroup');
    opts.setAttribute('aria-labelledby', 'theme-k');
    var choices = [['auto', 'Auto'], ['light', 'Light'], ['dark', 'Dark']];
    var buttons = [];

    function sync() {
      var m = mode();
      for (var i = 0; i < buttons.length; i++) {
        var on = buttons[i].getAttribute('data-mode') === m;
        buttons[i].setAttribute('aria-checked', String(on));
        buttons[i].tabIndex = on ? 0 : -1;
      }
    }
    function choose(value) {
      applyTheme(value);
      writeSaved(value === 'auto' ? null : value);
      paintMeta();
      sync();
    }

    choices.forEach(function (c, index) {
      var b = document.createElement('button');
      b.type = 'button';
      b.setAttribute('role', 'radio');
      b.setAttribute('data-mode', c[0]);
      b.textContent = c[1];
      b.addEventListener('click', function () { choose(c[0]); });
      b.addEventListener('keydown', function (e) {
        var to = null;
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') to = (index + 1) % buttons.length;
        else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') to = (index + buttons.length - 1) % buttons.length;
        else if (e.key === 'Home') to = 0;
        else if (e.key === 'End') to = buttons.length - 1;
        if (to === null) return;
        e.preventDefault();
        choose(buttons[to].getAttribute('data-mode'));
        buttons[to].focus();
      });
      buttons.push(b);
      opts.appendChild(b);
    });
    group.appendChild(label);
    group.appendChild(opts);
    slot.appendChild(group);
    syncThemeSwitch = sync;
    sync();
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

  /* Running head: mark the section being read and name the current project. */
  function trackPosition() {
    var head = document.querySelector('.runhead');
    var here = document.querySelector('[data-here]');
    if (!head || !here) return;

    function tocEntry(id) {
      var a = document.querySelector('.toc a[href="#' + id + '"]');
      if (!a) return null;
      var num = a.querySelector('.toc-n');
      var title = a.querySelector('.toc-t');
      return { n: num ? num.textContent : '', t: title ? title.textContent : a.textContent };
    }

    var sections = Array.prototype.slice.call(document.querySelectorAll('main > .sec[id]'));
    var projects = Array.prototype.slice.call(document.querySelectorAll('#work .project[id], #work .archive[id]'));
    var links = Array.prototype.slice.call(head.querySelectorAll('.rh-links a'));
    if (!sections.length) return;
    var current = '';
    var landing = 0;

    // With a large default font the head wraps onto two rows, taller than the
    // one-row --rh-h the stylesheet assumes, so scroll-padding follows its real
    // height (a CSSOM write, which the CSP allows). A followed link then lands
    // its target at scroll-padding plus scroll-margin.
    function measure() {
      var h = head.offsetHeight;
      if (h) {
        var rem = parseFloat(getComputedStyle(root).fontSize) || 16;
        root.style.scrollPaddingTop = (h + 0.75 * rem) + 'px';
      }
      landing = (parseFloat(getComputedStyle(root).scrollPaddingTop) || 0) +
        (parseFloat(getComputedStyle(sections[0]).scrollMarginTop) || 0);
    }

    function lastAbove(list, line) {
      var found = null;
      for (var i = 0; i < list.length; i++) {
        if (list[i].getBoundingClientRect().top <= line) found = list[i];
      }
      return found;
    }

    function namedSection() {
      var id = location.hash.slice(1);
      try { id = decodeURIComponent(id); } catch (e) { /* keep it raw */ }
      for (var i = 0; i < sections.length; i++) {
        if (sections[i].id === id) return sections[i];
      }
      return null;
    }

    function update() {
      var vh = window.innerHeight;
      // The reading line sits a quarter of the way down, and never above the
      // point where a followed link lands its target.
      var line = Math.max(vh * 0.25, landing + 2);
      var atEnd = vh + window.scrollY >= document.documentElement.scrollHeight - 2;
      var sec = lastAbove(sections, line);
      if (atEnd) {
        // The last sections can be too short to reach the line. At the page end
        // mark the last one, unless the address names a section whose top is on
        // screen: a link to it was just followed.
        var named = namedSection();
        var top = named ? named.getBoundingClientRect().top : -1;
        sec = named && top >= 0 && top < vh ? named : sections[sections.length - 1];
      }
      var proj = sec && sec.id === 'work' ? lastAbove(projects, line) : null;
      var target = proj || sec;
      var id = target ? target.id : '';
      if (id === current) return;
      current = id;

      links.forEach(function (a) {
        if (sec && a.getAttribute('href') === '#' + sec.id) a.setAttribute('aria-current', 'location');
        else a.removeAttribute('aria-current');
      });

      var entry = id ? tocEntry(id) : null;
      while (here.firstChild) here.removeChild(here.firstChild);
      if (!entry) {
        here.hidden = true;
        here.removeAttribute('data-depth');
        return;
      }
      var num = document.createElement('span');
      num.className = 'rh-n';
      num.textContent = entry.n;
      here.appendChild(num);
      here.appendChild(document.createTextNode(entry.t));
      here.setAttribute('data-depth', proj ? '2' : '1');
      here.hidden = false;
    }

    // Checked on every scrolled frame: about a dozen rects, and update() stops
    // early when nothing has changed.
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
    // The head's height also changes when the web fonts arrive or it rewraps.
    if (window.ResizeObserver) new window.ResizeObserver(remeasure).observe(head);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(remeasure);
    measure();
    update();
  }

  ready(function () {
    paintMeta();
    buildThemeSwitch();
    buildCopyButtons();
    buildCopyAddress();
    fitListings();
    trackPosition();
  });
})();
