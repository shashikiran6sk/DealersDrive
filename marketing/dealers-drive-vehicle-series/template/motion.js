/* Photo-led ads: real gallery photography, source-verified facts, two native layouts. */
const car = window.VEHICLE;
if (!car) throw Error('Render with scripts/render.mjs so verified vehicle data is supplied.');
const vertical = new URLSearchParams(location.search).get('layout') === 'vertical';
const W = vertical ? 1080 : 1920,
  H = vertical ? 1920 : 1080;
const stage = document.getElementById('stage');
stage.style.width = W + 'px';
stage.style.height = H + 'px';
const clamp = (t) => Math.max(0, Math.min(1, t));
const out = (t) => 1 - Math.pow(1 - clamp(t), 4);
const ease = (t, d = 0, l = 0.6) => out((t - d) / l);
const mix = (a, b, p) => a + (b - a) * p;
const escape = (s) =>
  String(s).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
const joined = (...values) =>
  values
    .filter((v) => v !== '' && v !== null && v !== undefined)
    .map(escape)
    .join(' <span style="opacity:.35">/</span> ');
const style = (o) =>
  Object.entries(o)
    .map(([k, v]) => k.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase()) + ':' + v)
    .join(';');
const box = (html, o = {}, cls = 'layer') =>
  `<div class="${cls}" style="${style(o)}">${html}</div>`;
const pos = (x, y, w, h) => ({
  left: x + 'px',
  top: y + 'px',
  ...(w ? { width: w + 'px' } : {}),
  ...(h ? { height: h + 'px' } : {}),
});
const measure = document.createElement('canvas').getContext('2d');
const fitted = (s, size, width, weight = 800, spacing = -0.065) => {
  const plain = String(s)
    .replace(/<[^>]+>/g, '')
    .replaceAll('&amp;', '&');
  measure.font = `${weight} ${size}px Manrope`;
  const needed = measure.measureText(plain).width + Math.max(0, plain.length - 1) * spacing * size;
  return Math.min(size, (size * width * 0.98) / Math.max(1, needed));
};
const title = (s, x, y, w, size, o = {}) =>
  box(s, { ...pos(x, y, w), fontSize: size + 'px', ...o }, 'layer title');
const reveal = (s, x, y, w, size, t, d = 0, o = {}) =>
  !s
    ? ''
    : box(
        box(
          s,
          {
            position: 'relative',
            fontSize: fitted(s, size, w) + 'px',
            transform: `translateY(${(1 - ease(t, d)) * 115}%)`,
            ...o,
          },
          'title',
        ),
        pos(x, y, w, size * 1.18),
        'mask',
      );
const label = (s, x, y, w, o = {}) => box(s, { ...pos(x, y, w), ...o }, 'layer label');
const detail = (s, x, y, w, size = 28, o = {}) =>
  !s
    ? ''
    : box(
        s,
        { ...pos(x, y, w), fontSize: fitted(s, size, w, 500, -0.02) + 'px', ...o },
        'layer detail',
      );
const line = (x, y, w, o = {}) => box('', { ...pos(x, y, w), ...o }, 'layer line');
const pill = (s, x, y, o = {}) => box(s, { left: x + 'px', top: y + 'px', ...o }, 'layer pill');
const photo = (kind, x, y, w, h, o = {}) => {
  const id = car.photos[kind];
  if (!id) throw Error('Missing actual photograph ' + kind);
  return box(
    `<img src="../media/${id}" class="${o.interior ? 'interior' : ''}" alt="${kind}">`,
    {
      ...pos(x, y, w, h),
      opacity: o.opacity ?? 1,
      transform: `perspective(2400px) translate3d(${o.dx || 0}px,${o.dy || 0}px,0) rotateX(${o.rx || 0}deg) rotateY(${o.ry || 0}deg) rotateZ(${o.r || 0}deg) scale(${o.scale || 1})`,
      borderRadius: (o.radius ?? 22) + 'px',
      ...(o.shadow ? { boxShadow: '0 28px 65px #0003' } : {}),
      ...(o.style || {}),
    },
    'photo',
  );
};
function brand(x, y, w, dark = false, opacity = 1) {
  const color = dark ? 'white' : 'black';
  return (
    box(
      `<img src="../assets/brand/icon-${color}.svg">`,
      { ...pos(x, y, w * 0.164, w * 0.107), opacity },
      'layer brand',
    ) +
    box(
      `<img src="../assets/brand/wordmark-${color}.svg">`,
      { ...pos(x + w * 0.209, y + w * 0.025, w * 0.791, w * 0.105), opacity },
      'layer brand',
    )
  );
}
function chrome(dark = false, section = '') {
  return (
    brand(vertical ? 70 : 95, vertical ? 105 : 65, vertical ? 320 : 280, dark) +
    label(
      car.fixture ? 'TEST FIXTURE' : 'USED CAR',
      vertical ? 780 : 1645,
      vertical ? 112 : 72,
      250,
      {
        textAlign: 'right',
        fontSize: vertical ? '18px' : '16px',
        opacity: 0.58,
      },
    ) +
    line(vertical ? 70 : 95, H - (vertical ? 145 : 70), W - (vertical ? 140 : 190)) +
    label(section, vertical ? 70 : 95, H - (vertical ? 122 : 51), 1000, {
      fontSize: vertical ? '15px' : '13px',
      opacity: 0.6,
    })
  );
}
function opening(t) {
  const p = ease(t, 0, 0.65);
  let h = '';
  if (vertical) {
    h += label(escape(car.make), 70, 250, 900, { fontSize: '29px' });
    h += reveal(escape(car.model.toUpperCase()), 62, 310, 960, 240, t, 0);
    h += detail(joined(car.year, car.variant), 78, 580, 900, 37, { opacity: ease(t, 0.12) });
    h += photo('hero', 40, 680, 1000, 825, { dx: (1 - p) * 110, r: mix(-3, 0, p), radius: 0 });
    h += pill(joined(car.fuel, car.transmission), 75, 1565, { opacity: ease(t, 0.3) });
    h += detail(escape(car.location), 80, 1655, 850, 31, { opacity: ease(t, 0.4) });
  } else {
    h += label(escape(car.make), 100, 230, 650, { fontSize: '29px' });
    h += reveal(escape(car.model.toUpperCase()), 85, 295, 660, 198, t, 0);
    h += detail(joined(car.year, car.variant), 100, 525, 730, 36, { opacity: ease(t, 0.12) });
    h += pill(joined(car.fuel, car.transmission), 100, 650, { opacity: ease(t, 0.3) });
    h += detail(escape(car.location), 105, 755, 650, 29, { opacity: ease(t, 0.4) });
    h += photo('hero', 780, 150, 1080, 780, { dx: (1 - p) * 160, r: mix(-3, 0, p), radius: 0 });
  }
  return h + chrome(false, `${car.year} ${car.make.toUpperCase()} ${car.model.toUpperCase()}`);
}
function asking(t) {
  const p = ease(t, 0, 0.6),
    second = t >= 2,
    q = ease(t, 2, 0.6);
  let h = '';
  if (vertical) {
    h += label('ASKING PRICE', 70, 260, 900, { opacity: p });
    h += reveal(
      escape(car.priceLakh === null ? car.priceLabel : '₹' + car.priceLakh),
      60,
      325,
      970,
      190,
      t,
      0.03,
    );
    if (car.priceLakh !== null)
      h += label('LAKH', 77, 535, 800, { fontSize: '36px', letterSpacing: '.25em', opacity: p });
    h += photo('front', 70, 660, 940, 850, {
      dx: -q * 1200,
      opacity: 1 - q,
      r: -2 * (1 - q),
      shadow: true,
    });
    h += photo('rear', 70, 660, 940, 850, {
      dx: (1 - q) * 1200,
      opacity: q,
      r: 2 * (1 - q),
      shadow: true,
    });
    h += detail(joined(car.year, car.variant), 77, 1590, 910, 35, { opacity: p });
  } else {
    h += label('ASKING PRICE', 100, 265, 700, { opacity: p });
    h += reveal(
      escape(car.priceLakh === null ? car.priceLabel : '₹' + car.priceLakh),
      85,
      340,
      750,
      170,
      t,
      0.03,
    );
    if (car.priceLakh !== null)
      h += label('LAKH', 105, 550, 700, { fontSize: '38px', letterSpacing: '.25em', opacity: p });
    h += detail(joined(car.year, car.variant), 105, 690, 680, 32, { opacity: p });
    h += photo('front', 880, 200, 920, 690, {
      dx: -q * 1200,
      opacity: 1 - q,
      r: -2 * (1 - q),
      shadow: true,
    });
    h += photo('rear', 880, 200, 920, 690, {
      dx: (1 - q) * 1200,
      opacity: q,
      r: 2 * (1 - q),
      shadow: true,
    });
  }
  return h + chrome(true, 'VIEW THE ACTUAL VEHICLE');
}
function inside(t) {
  const p = ease(t, 0, 0.6),
    q = ease(t, 0.22, 0.65),
    focus = ease(t, 2.5, 0.65);
  let h = '';
  const mainKey = car.photos.dashboard ? 'dashboard' : car.photos.rearSeats ? 'rearSeats' : 'rear';
  const detailKey = car.photos.frontSeats
    ? 'frontSeats'
    : car.photos.rearSeats
      ? 'rearSeats'
      : 'front';
  const mainInterior = ['dashboard', 'rearSeats'].includes(mainKey),
    detailInterior = ['frontSeats', 'rearSeats'].includes(detailKey);
  const cabin = mainInterior && detailInterior;
  h += label(
    cabin ? 'THE CABIN' : 'A CLOSER LOOK',
    vertical ? 70 : 95,
    vertical ? 250 : 200,
    1000,
    { opacity: p },
  );
  h += reveal(
    cabin
      ? t < 2.5
        ? 'Look inside.'
        : 'Cabin. Up close.'
      : t < 2.5
        ? 'Look closer.'
        : 'Details. Up close.',
    vertical ? 65 : 95,
    vertical ? 310 : 260,
    vertical ? 960 : 1720,
    vertical ? 104 : 120,
    t < 2.5 ? t : t - 2.5,
    0.03,
  );
  if (vertical) {
    h += photo(
      mainKey,
      mix(65, 130, focus),
      mix(550, 500, focus),
      mix(950, 820, focus),
      mix(580, 500, focus),
      { dy: (1 - p) * 170, r: mix(-4, -1, p), interior: mainInterior, shadow: true },
    );
    h += photo(
      detailKey,
      mix(260, 190, focus),
      mix(1110, 970, focus),
      mix(560, 700, focus),
      mix(580, 720, focus),
      { dy: (1 - q) * 220, r: mix(5, 2, q), interior: detailInterior, shadow: true },
    );
  } else {
    h += photo(mainKey, 120, 440, 1080, 535, {
      dx: -(1 - p) * 800,
      r: mix(-5, -1, p),
      interior: mainInterior,
      shadow: true,
    });
    h += photo(
      detailKey,
      mix(1290, 1140, focus),
      mix(320, 240, focus),
      mix(510, 650, focus),
      mix(655, 750, focus),
      { dx: (1 - q) * 800, r: mix(5, 2, q), interior: detailInterior, shadow: true },
    );
  }
  return h + chrome(false, 'REAL LISTING PHOTOGRAPHS');
}
function facts(t) {
  const p = ease(t, 0, 0.65),
    second = t >= 2.5,
    q = ease(t, 2.5, 0.6);
  let h = '';
  const km = car.kilometres.replace(/\s*km$/, '');
  const metric = km || car.owners || car.variant || car.model;
  if (vertical) {
    h += label(second || !km ? 'THE DETAILS' : 'KILOMETRES DRIVEN', 70, 250, 930, { opacity: p });
    if (!second) {
      h += reveal(escape(metric), 60, 320, 970, 188, t, 0.02);
      if (km) h += label('KM', 78, 535, 900, { fontSize: '35px', opacity: p });
      h += photo('side', 40, 680, 1000, 620, { dy: (1 - p) * 100, r: mix(2, 0, p), radius: 0 });
      if (km) h += detail(escape(car.owners), 80, 1440, 920, 46, { opacity: p });
      h += detail(joined(car.fuel, car.transmission), 80, 1540, 920, 36, { opacity: p });
    } else {
      h += reveal(
        escape(car.fuel || (!car.transmission ? car.variant || car.model : '')),
        65,
        320,
        960,
        135,
        t - 2.5,
        0.02,
      );
      h += reveal(escape(car.transmission), 65, 475, 960, 112, t - 2.5, 0.12);
      h += photo('oppositeSide', 40, 740, 1000, 600, {
        dx: (1 - q) * 300,
        r: mix(-3, 0, q),
        radius: 0,
      });
      h += detail(joined(car.year, car.owners), 80, 1450, 930, 40, { opacity: q });
      h += detail(escape(car.kilometres), 80, 1540, 930, 36, { opacity: q });
    }
  } else {
    h += label(second || !km ? 'THE DETAILS' : 'KILOMETRES DRIVEN', 100, 240, 900, { opacity: p });
    if (!second) {
      h += reveal(escape(metric), 85, 310, 1070, 190, t, 0.02);
      if (km) h += label('KM', 107, 540, 800, { fontSize: '35px', opacity: p });
      if (km) h += detail(escape(car.owners), 105, 680, 900, 42, { opacity: p });
      h += detail(joined(car.fuel, car.transmission), 105, 765, 900, 29, { opacity: p });
      h += photo('side', 920, 285, 940, 595, { dx: (1 - p) * 250, r: mix(3, 0, p), radius: 0 });
    } else {
      h += reveal(
        escape(car.fuel || (!car.transmission ? car.variant || car.model : '')),
        95,
        325,
        850,
        142,
        t - 2.5,
        0.02,
      );
      h += reveal(escape(car.transmission), 95, 490, 920, 114, t - 2.5, 0.12);
      h += detail(joined(car.year, car.owners), 105, 700, 850, 35, { opacity: q });
      h += detail(escape(car.kilometres), 105, 775, 850, 30, { opacity: q });
      h += photo('oppositeSide', 940, 285, 920, 595, {
        dx: (1 - q) * 250,
        r: mix(-3, 0, q),
        radius: 0,
      });
    }
  }
  return h + chrome(false, 'DETAILS FROM THE LIVE LISTING');
}
function recap(t) {
  const p = ease(t, 0, 0.65);
  let h = '';
  if (vertical) {
    h += label(`${car.year} ${escape(car.make.toUpperCase())}`, 70, 250, 930, { opacity: p });
    h += reveal(escape(car.model.toUpperCase()), 62, 310, 960, 230, t, 0.02);
    h += photo('front', 40, 610, 1000, 770, { dx: (1 - p) * 130, r: mix(2, 0, p), radius: 0 });
    h += reveal(escape(car.priceDisplay), 70, 1435, 940, 116, t, 0.15);
    h += detail(
      `${escape(car.location)} <span style="opacity:.35">/</span> ${escape(car.variant)}`,
      78,
      1590,
      930,
      33,
      { opacity: p },
    );
  } else {
    h += label(`${car.year} ${escape(car.make.toUpperCase())}`, 100, 240, 800, { opacity: p });
    h += reveal(escape(car.model.toUpperCase()), 88, 310, 740, 190, t, 0.02);
    h += reveal(escape(car.priceDisplay), 100, 565, 720, 104, t, 0.15);
    h += detail(
      `${escape(car.location)} <span style="opacity:.35">/</span> ${escape(car.variant)}`,
      105,
      730,
      850,
      29,
      { opacity: p },
    );
    h += photo('front', 860, 170, 1000, 760, { dx: (1 - p) * 150, r: mix(2, 0, p), radius: 0 });
  }
  return h + chrome(false, 'EXPLORE THIS CAR ON DEALERS-DRIVE');
}
function ending(t) {
  const p = ease(t, 0, 0.65);
  let h = '';
  if (vertical) {
    h += brand(70, 230, 760, true, p);
    h += reveal('Explore this car.', 65, 630, 960, 104, t, 0.02);
    h += reveal('Enquire online.', 65, 760, 960, 104, t, 0.12);
    h += detail(`${car.year} ${escape(car.make)} ${escape(car.model)}`, 75, 1040, 930, 40, {
      opacity: p,
    });
    h += detail(
      [escape(car.priceDisplay), escape(car.location)].filter(Boolean).join(' · '),
      75,
      1120,
      930,
      38,
      {
        opacity: p,
      },
    );
    h += detail('www.dealers-drive.com ↗', 75, 1435, 930, 41, { opacity: p });
  } else {
    h += brand(100, 175, 640, true, p);
    h += reveal('Explore this car.', 95, 385, 1720, 124, t, 0.02);
    h += reveal('Enquire online.', 95, 535, 1720, 124, t, 0.12);
    h += detail(
      joined([car.year, car.make, car.model].filter(Boolean).join(' '), car.priceDisplay),
      105,
      750,
      1550,
      34,
      { opacity: p },
    );
    h += detail('www.dealers-drive.com ↗', 105, 870, 1600, 34, { opacity: p });
  }
  return h;
}
window.seek = async function (time) {
  await document.fonts.load('800 200px Manrope');
  await document.fonts.load('500 40px Manrope');
  const t = Math.max(0, Math.min(19.999, time));
  const scene = t < 2 ? 0 : t < 6 ? 1 : t < 11 ? 2 : t < 16 ? 3 : t < 18 ? 4 : 5;
  const start = [0, 2, 6, 11, 16, 18][scene];
  const dark = scene === 1 || scene === 5;
  stage.style.background = dark ? '#090a09' : '#fff';
  stage.style.color = dark ? '#f7f7f2' : '#101110';
  stage.innerHTML = [opening, asking, inside, facts, recap, ending][scene](t - start);
  await document.fonts.ready;
  await Promise.all([...document.images].map((i) => i.decode()));
  await new Promise(requestAnimationFrame);
  return { time: t, scene, vehicle: car.id };
};
window.ready = window.seek(0);
