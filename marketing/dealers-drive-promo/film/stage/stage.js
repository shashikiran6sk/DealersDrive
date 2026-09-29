/* global window, document */
(function () {
  const CURSOR_SVG =
    '<svg class="cursor" viewBox="0 0 26 34" xmlns="http://www.w3.org/2000/svg"><path d="M3 2 L3 27 L9.5 21 L13.6 31 L17.8 29.2 L13.8 19.6 L22.5 19.6 Z" fill="#111" stroke="#fff" stroke-width="2" stroke-linejoin="round"/></svg>';

  const TOUCH_SVG =
    '<svg class="cursor" viewBox="0 0 26 34" xmlns="http://www.w3.org/2000/svg"><circle cx="3" cy="2" r="11" fill="rgba(255,255,255,0.55)" stroke="rgba(15,110,92,0.9)" stroke-width="2.5"/></svg>';

  const state = { clips: [], width: 0, height: 0, format: 'landscape' };

  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const ease = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
  const easeOut = (x) => 1 - Math.pow(1 - x, 3);

  function sample(keys, t, fallback) {
    if (!keys || keys.length === 0) return fallback;
    if (t <= keys[0].t) return keys[0];
    for (let i = 0; i < keys.length - 1; i += 1) {
      const a = keys[i];
      const b = keys[i + 1];
      if (t >= a.t && t <= b.t) {
        const span = b.t - a.t || 1;
        const k = (b.ease === 'linear' ? (x) => x : ease)((t - a.t) / span);
        const out = { t };
        for (const key of Object.keys(b)) {
          if (typeof b[key] === 'number' && typeof a[key] === 'number')
            out[key] = a[key] + (b[key] - a[key]) * k;
          else out[key] = t - a.t < span / 2 ? a[key] : b[key];
        }
        return out;
      }
    }
    return keys[keys.length - 1];
  }

  function el(tag, cls, parent, html) {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (html !== undefined) node.innerHTML = html;
    if (parent) parent.appendChild(node);
    return node;
  }

  function unit() {
    return Math.min(state.width, state.height) / 1080;
  }

  function buildLower(clip, root) {
    if (!clip.lower || clip.lower.length === 0) return;
    clip.lowerNodes = clip.lower.map((item) => {
      const node = el('div', 'lower', root);
      const u = unit();
      const portrait = state.format === 'portrait';
      const square = state.format === 'square';
      node.style.left = `${(portrait ? 48 : 56) * u}px`;
      if (portrait || square) node.style.right = `${(portrait ? 48 : 56) * u}px`;
      node.style.bottom = `${(portrait ? 120 : 48) * u}px`;
      node.style.maxWidth = portrait || square ? 'none' : '52%';
      node.style.padding = `${20 * u}px ${28 * u}px ${22 * u}px`;
      node.style.fontSize = `${u}px`;
      if (item.kicker) {
        const k = el('div', 'kicker', node, item.kicker);
        k.style.fontSize = `${(portrait ? 24 : 17) * u}px`;
      }
      if (item.text) {
        const line = el('div', 'line', node, item.text);
        line.style.fontSize = `${(portrait ? 38 : square ? 30 : 31) * u}px`;
      }
      return { node, item };
    });
  }

  function renderLower(clip, lt) {
    if (!clip.lowerNodes) return;
    for (const { node, item } of clip.lowerNodes) {
      const fade = 0.35;
      const a = clamp((lt - item.from) / fade, 0, 1) * clamp((item.to - lt) / fade, 0, 1);
      node.style.opacity = String(a);
      node.style.transform = `translateY(${(1 - easeOut(clamp((lt - item.from) / 0.5, 0, 1))) * 18 * unit()}px)`;
    }
  }

  function buildUi(clip, root) {
    const vw = clip.viewport.width;
    const vh = clip.viewport.height;
    const card = clip.frame === 'card';
    if (card || state.format !== 'landscape')
      el('div', `backdrop${clip.backdrop === 'light' ? ' light' : ''}`, root);
    const camera = el('div', 'camera', root);
    const screen = el('div', `screen${card ? ' card' : ''}`, camera);
    screen.style.width = `${vw}px`;
    screen.style.height = `${vh}px`;
    clip.shotNodes = clip.shots.map((shot) => {
      let img;
      if (shot.tiles) {
        img = el('div', 'shot', screen);
        img.style.width = `${vw}px`;
        img.style.height = `${shot.pageHeight}px`;
        for (const tile of shot.tiles) {
          const part = el('img', '', img);
          part.src = tile.src;
          part.style.cssText = `position:absolute;left:0;top:${tile.y}px;width:${vw}px;display:block`;
        }
      } else {
        img = el('img', 'shot', screen);
        img.src = shot.src;
        img.style.width = `${vw}px`;
      }
      let pinned = null;
      if (shot.pinned) {
        pinned = el('img', 'pinned', screen);
        pinned.src = shot.pinned.src;
        pinned.style.width = `${vw}px`;
      }
      return { img, pinned, shot };
    });
    clip.ripples = (clip.cursor || [])
      .filter((k) => k.click)
      .map(() => el('div', 'ripple', screen));
    const pointer = state.format === 'portrait' ? TOUCH_SVG : CURSOR_SVG;
    clip.cursorNode =
      clip.cursor && clip.cursor.length ? el('div', '', screen, pointer).firstChild : null;
    if (clip.cursorNode) screen.appendChild(clip.cursorNode);
    clip.camera = camera;
    clip.screen = screen;
    if (clip.stamp) {
      const u = unit();
      const stamp = el('div', 'stamp', root, clip.stamp);
      const portrait = state.format === 'portrait';
      const stacked = state.format !== 'landscape';
      stamp.style.cssText = `position:absolute;${stacked ? `left:0;right:0;text-align:center;bottom:${(portrait ? 150 : 70) * u}px` : `left:${70 * u}px;top:50%;margin-top:${-70 * u}px`};font-weight:800;letter-spacing:-0.03em;color:#fff;font-size:${(portrait ? 110 : stacked ? 88 : 96) * u}px;line-height:1`;
      clip.stampNode = stamp;
    }
    buildLower(clip, root);
  }

  function baseScale(clip) {
    const vw = clip.viewport.width;
    const vh = clip.viewport.height;
    if (clip.frame === 'card')
      return (
        Math.min(state.width / vw, state.height / vh) *
        (state.format === 'landscape' ? clip.cardScale || 0.84 : 0.9)
      );
    if (state.format === 'landscape') return Math.max(state.width / vw, state.height / vh);
    if (state.format === 'square') return state.height / vh;
    return state.width / vw;
  }

  function renderUi(clip, lt) {
    const vw = clip.viewport.width;
    const vh = clip.viewport.height;
    const cam = sample(clip.cameraKeys, lt, { x: vw / 2, y: vh / 2, z: 1 });
    const s = baseScale(clip) * cam.z;
    const W = state.width;
    const H = state.height;
    const focusX =
      state.format === 'square' &&
      !clip.ownSquareCamera &&
      clip.squareFocusX !== undefined &&
      clip.frame !== 'card'
        ? clip.squareFocusX
        : cam.x;
    let tx = W / 2 - focusX * s;
    let ty = H / 2 - cam.y * s;
    if (clip.frame === 'card' && state.format === 'landscape') tx += W * (clip.cardShiftX ?? 0.12);
    if (clip.frame === 'card' && state.format !== 'landscape')
      ty -= H * (state.format === 'square' ? 0.1 : 0.06);
    if (clip.frame !== 'card') {
      tx = vw * s <= W ? (W - vw * s) / 2 : clamp(tx, W - vw * s, 0);
      ty = vh * s <= H ? (H - vh * s) / 2 : clamp(ty, H - vh * s, 0);
    }
    clip.camera.style.transform = `translate(${tx}px, ${ty}px) scale(${s})`;

    for (const { img, pinned, shot } of clip.shotNodes) {
      const from = shot.from || 0;
      const to = shot.to === undefined ? Infinity : shot.to;
      const fade = shot.fade === undefined ? 0.28 : shot.fade;
      let a = fade > 0 ? clamp((lt - from) / fade, 0, 1) : lt >= from ? 1 : 0;
      if (lt > to) a = 0;
      img.style.opacity = String(a);
      img.style.display = a > 0 ? 'block' : 'none';
      const scroll = sample(shot.scroll, lt - from, { y: 0 });
      img.style.transform = `translateY(${-scroll.y}px)`;
      if (pinned) {
        pinned.style.display = a > 0 && scroll.y > 1 ? 'block' : 'none';
        pinned.style.opacity = String(a);
      }
    }

    if (clip.cursorNode) {
      const c = sample(clip.cursor, lt, { x: vw / 2, y: vh / 2 });
      let press = 1;
      clip.cursor
        .filter((k) => k.click)
        .forEach((k, i) => {
          const d = lt - k.t;
          const ripple = clip.ripples[i];
          if (d >= 0 && d <= 0.6) {
            const p = d / 0.6;
            ripple.style.opacity = String(1 - p);
            ripple.style.left = `${k.x}px`;
            ripple.style.top = `${k.y}px`;
            ripple.style.transform = `scale(${0.4 + p * 1.2})`;
          } else ripple.style.opacity = '0';
          if (d >= -0.08 && d <= 0.18) press = 0.85;
        });
      const hidden = c.hide || lt < (clip.cursor[0].t || 0) - 0.01;
      clip.cursorNode.style.opacity = hidden ? '0' : '1';
      clip.cursorNode.style.transform = `translate(${c.x - 3}px, ${c.y - 2}px) scale(${(1 / (baseScale(clip) * cam.z)) * unit() * 1.15 * press})`;
    }
    if (clip.stampNode) {
      const p = easeOut(clamp((lt - 0.1) / 0.45, 0, 1));
      clip.stampNode.style.opacity = String(p);
      clip.stampNode.style.transform = `translateY(${(1 - p) * 30 * unit()}px)`;
    }
    renderLower(clip, lt);
  }

  function buildTitle(clip, root) {
    const u = unit();
    if (clip.photo) {
      clip.photoNode = el('div', 'photo', root);
      clip.photoNode.style.backgroundImage = `url('${clip.photo}')`;
      const shade = el('div', 'shade', root);
      shade.style.background =
        clip.shade ||
        'linear-gradient(90deg, rgba(8,9,10,0.82) 0%, rgba(8,9,10,0.55) 45%, rgba(8,9,10,0.15) 100%)';
    } else {
      el('div', `backdrop${clip.backdrop === 'light' ? ' light' : ''}`, root);
    }
    const card = el('div', `title-card${clip.align === 'left' ? ' left' : ''}`, root);
    if (clip.backdrop === 'light') card.style.color = '#0d0e10';
    if (state.format === 'portrait') card.style.padding = `0 ${70 * u}px`;
    clip.lines = [];
    const add = (node, delay) => {
      clip.lines.push({ node, delay });
      return node;
    };
    if (clip.brand) {
      const b = add(
        el(
          'div',
          `brand${clip.backdrop === 'light' ? ' dark' : ''}`,
          card,
          `<span class="mark">DD</span><span>Dealers-Drive</span>`,
        ),
        clip.brand.delay ?? 0.1,
      );
      b.style.fontSize = `${(clip.brand.size || 44) * u}px`;
    }
    if (clip.eyebrow) {
      const e = add(el('div', 'eyebrow', card, clip.eyebrow), 0.15);
      e.style.fontSize = `${24 * u}px`;
    }
    if (clip.headline) {
      const h = add(el('h1', '', card, clip.headline), 0.3);
      h.style.fontSize = `${(clip.headlineSize || (state.format === 'portrait' ? 84 : 88)) * u}px`;
      if (clip.backdrop === 'light') h.style.color = '#0d0e10';
    }
    if (clip.sub) {
      const p = add(el('p', '', card, clip.sub), 0.55);
      p.style.fontSize = `${(state.format === 'portrait' ? 38 : 34) * u}px`;
      if (clip.backdrop === 'light') p.style.color = '#4a4e53';
    }
    if (clip.words) {
      const row = el('h1', '', card);
      row.style.fontSize = `${(clip.headlineSize || 120) * u}px`;
      row.style.display = 'flex';
      row.style.gap = `${0.35 * (clip.headlineSize || 120) * u}px`;
      row.style.flexWrap = 'wrap';
      row.style.justifyContent = 'center';
      clip.words.forEach((w) => add(el('span', 'word', row, w.text), w.at));
    }
    buildLower(clip, root);
  }

  function renderTitle(clip, lt) {
    if (clip.photoNode) {
      const k = clamp(lt / clip.dur, 0, 1);
      const z = (clip.zoomFrom || 1.08) + ((clip.zoomTo || 1.0) - (clip.zoomFrom || 1.08)) * k;
      clip.photoNode.style.transform = `scale(${z}) translateX(${(clip.panX || 0) * k}px)`;
    }
    for (const { node, delay } of clip.lines) {
      const p = easeOut(clamp((lt - delay) / 0.7, 0, 1));
      node.style.opacity = String(p);
      node.style.transform = `translateY(${(1 - p) * 26 * unit()}px)`;
    }
    renderLower(clip, lt);
  }

  window.setupFilm = async function setupFilm({ width, height, format, clips }) {
    state.width = width;
    state.height = height;
    state.format = format;
    const stage = document.getElementById('stage');
    stage.style.width = `${width}px`;
    stage.style.height = `${height}px`;
    state.clips = clips.map((clip) => {
      const root = el('div', 'clip', stage);
      root.style.display = 'none';
      const built = { ...clip, root };
      if (clip.kind === 'ui') {
        const keys = format === 'square' && clip.squareCamera ? clip.squareCamera : clip.camera;
        built.cameraKeys = (keys || []).map((k) => ({ z: 1, ...k }));
        built.ownSquareCamera = format === 'square' && Boolean(clip.squareCamera);
        buildUi(built, root);
      } else buildTitle(built, root);
      return built;
    });
    await document.fonts.ready;
    const images = [...document.images];
    await Promise.all(
      images.map((img) =>
        img.complete
          ? img.decode().catch(() => {})
          : new Promise((r) => {
              img.onload = () => img.decode().then(r, r);
              img.onerror = r;
            }),
      ),
    );
    const photos = state.clips
      .filter((c) => c.photo)
      .map(
        (c) =>
          new Promise((r) => {
            const i = new Image();
            i.onload = r;
            i.onerror = r;
            i.src = c.photo;
          }),
      );
    await Promise.all(photos);
    const broken = images.filter((img) => !img.naturalWidth).map((img) => img.src);
    return { clips: state.clips.length, images: images.length, broken };
  };

  window.renderAt = function renderAt(t) {
    for (const clip of state.clips) {
      const lt = t - clip.start;
      const visible = lt >= 0 && lt <= clip.dur;
      clip.root.style.display = visible ? 'block' : 'none';
      if (!visible) continue;
      const fadeIn = clip.fadeIn === undefined ? 0.5 : clip.fadeIn;
      clip.root.style.opacity = String(fadeIn > 0 ? clamp(lt / fadeIn, 0, 1) : 1);
      if (clip.kind === 'ui') renderUi(clip, lt);
      else renderTitle(clip, lt);
    }
  };
})();
