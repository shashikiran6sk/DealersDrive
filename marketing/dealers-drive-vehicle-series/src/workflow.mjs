import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import {
  SETTINGS,
  PromoError,
  sha,
  fingerprint,
  parseUrls,
  normalize,
  validatePlan,
  galleryKey,
  inputKey,
  renderVehicle,
} from './core.mjs';
import * as source from './source.mjs';
import * as media from './media.mjs';

export const ROOT = fileURLToPath(new URL('..', import.meta.url));
export async function read(file) {
  return JSON.parse(await fs.readFile(file, 'utf8'));
}
export async function write(file, value) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const temp = file + '.' + randomUUID() + '.tmp';
  await fs.writeFile(temp, JSON.stringify(value, null, 2) + '\n');
  await fs.rename(temp, file);
}
async function exists(file) {
  try {
    await fs.access(file);
    return true;
  } catch {
    return false;
  }
}
export function inside(root, file) {
  const rel = path.relative(root, path.resolve(file));
  if (rel.startsWith('..') || path.isAbsolute(rel))
    throw new PromoError('PATH', 'Path is outside its job.');
  return path.resolve(file);
}
export class Workflow {
  constructor({
    root = ROOT,
    runs = process.env.PROMO_RUNS_DIR || path.join(root, 'runs'),
    fixture = null,
  } = {}) {
    this.root = root;
    this.runs = path.resolve(runs);
    this.fixture = fixture ? path.resolve(fixture) : null;
  }
  async fixtureData() {
    return this.fixture ? read(path.join(this.fixture, 'fixture.json')) : null;
  }
  async listing(url) {
    const f = await this.fixtureData();
    if (f) {
      if (!f.listings[url]) throw new PromoError('UNAVAILABLE', 'No fixture for this URL.');
      return structuredClone(f.listings[url].vehicle);
    }
    return source.listing(url);
  }
  async image(url) {
    const f = await this.fixtureData();
    if (f) {
      const relative = Object.values(f.listings)
        .flatMap((l) => Object.entries(l.images))
        .find(([u]) => u === url)?.[1];
      if (!relative) throw new PromoError('INVALID_MEDIA', 'Unknown fixture image.');
      return fs.readFile(inside(this.fixture, path.join(this.fixture, relative)));
    }
    return source.get(url, { image: true });
  }
  async directory(id) {
    if (!/^[a-z0-9-]+$/.test(id)) throw new PromoError('PATH', 'Use a job id returned by prepare.');
    const base = await fs.realpath(this.runs),
      dir = await fs.realpath(path.join(base, id));
    inside(base, dir);
    return dir;
  }
  async job(id) {
    const dir = await this.directory(id),
      job = await read(path.join(dir, 'job.json'));
    if (job.id !== id) throw new PromoError('JOB', 'Job identity mismatch.');
    if (job.fixtureDir) this.fixture = job.fixtureDir;
    return { dir, job };
  }
  async planCache(capture) {
    return path.join(
      this.runs,
      'cache',
      'plans',
      capture.facts.slug,
      galleryKey(capture) + '.json',
    );
  }
  async prepare(values) {
    const urls = parseUrls(values),
      id =
        new Date()
          .toISOString()
          .replace(/[^0-9a-z]/gi, '')
          .toLowerCase() +
        '-' +
        randomUUID().slice(0, 8),
      dir = path.join(this.runs, id);
    await fs.mkdir(path.join(dir, 'media'), { recursive: true });
    const style = await media.snapshot(this.root, dir),
      cars = [],
      skipped = [],
      errors = [],
      plans = {};
    for (const url of urls) {
      try {
        const raw = await this.listing(url),
          capture = normalize(raw, url);
        capture.images = await Promise.all(
          capture.images.map(async (image) => {
            const bytes = await this.image(image.url),
              ext = await media.imageExtension(bytes),
              hash = sha(bytes),
              file = hash + '.' + ext;
            await fs.writeFile(path.join(dir, 'media', file), bytes);
            return { ...image, hash, file };
          }),
        );
        const sourceFile = 'source/' + capture.facts.slug + '.json';
        // Save only the public contract fields used for this workflow.
        const snapshot = {
          slug: raw.slug,
          availability: raw.availability,
          year: raw.year,
          priceLabel: raw.priceLabel,
          specs: raw.specs,
          images: raw.images,
          primaryIndex: raw.primaryIndex,
          facts: raw.facts,
          dealer: {
            location: raw.dealer?.location,
            city: raw.dealer?.city,
            district: raw.dealer?.district,
          },
        };
        await write(path.join(dir, sourceFile), snapshot);
        capture.sourceFile = sourceFile;
        capture.sourceHash = sha(await fs.readFile(path.join(dir, sourceFile)));
        capture.galleryKey = galleryKey(capture);
        try {
          const old = await read(await this.planCache(capture));
          plans[capture.facts.slug] = validatePlan(old, capture);
        } catch {
          plans[capture.facts.slug] = {};
        }
        await media.contactSheet(dir, capture);
        cars.push(capture);
      } catch (e) {
        (e.code === 'UNAVAILABLE' ? skipped : errors).push({
          url,
          code: e.code || 'SOURCE',
          reason: e.message,
        });
      }
    }
    const job = {
      version: 1,
      id,
      createdAt: new Date().toISOString(),
      urls,
      styleKey: style,
      fixtureDir: this.fixture,
      cars,
      skipped,
      errors,
    };
    await write(path.join(dir, 'job.json'), job);
    await write(path.join(dir, 'photo-plan.json'), { version: 1, cars: plans });
    return {
      job: id,
      directory: dir,
      cars: cars.map((c) => ({
        slug: c.facts.slug,
        title: [c.facts.year, c.facts.make, c.facts.model, c.facts.variant]
          .filter(Boolean)
          .join(' '),
        gallery: path.join(dir, 'review', c.facts.slug + '-gallery.jpg'),
        photos: c.images.map((i, n) => ({ index: n + 1, hash: i.hash, file: i.file })),
        needsSelection: !plans[c.facts.slug]?.hero,
      })),
      skipped,
      errors,
      next: cars.length
        ? 'Inspect contact sheets, select actual photo roles, then preview.'
        : 'No eligible cars.',
    };
  }
  async load(id) {
    const { dir, job } = await this.job(id);
    if (job.styleKey !== (await media.styleKey(this.root)))
      throw new PromoError('STYLE_CHANGED', 'The renderer or branding changed; prepare a new job.');
    for (const c of job.cars) {
      const sourcePath = inside(dir, path.join(dir, c.sourceFile));
      if (sha(await fs.readFile(sourcePath)) !== c.sourceHash)
        throw new PromoError('SOURCE_CHANGED', 'The captured source snapshot changed.');
      const normalized = normalize(await read(sourcePath), c.facts.listingUrl);
      if (
        fingerprint(normalized.facts) !== fingerprint(c.facts) ||
        fingerprint(normalized.images) !==
          fingerprint(c.images.map(({ url, alt }) => ({ url, alt }))) ||
        normalized.primaryIndex !== c.primaryIndex ||
        galleryKey(c) !== c.galleryKey
      )
        throw new PromoError(
          'SOURCE_CHANGED',
          'Job facts or gallery do not match their captured source.',
        );
      for (const image of c.images)
        if (sha(await fs.readFile(inside(dir, path.join(dir, 'media', image.file)))) !== image.hash)
          throw new PromoError('SOURCE_CHANGED', 'A captured photograph changed.');
    }
    const plan = await read(path.join(dir, 'photo-plan.json'));
    for (const c of job.cars) validatePlan(plan.cars?.[c.facts.slug], c);
    return { dir, job, plan };
  }
  async select(id, slug, roles) {
    const { dir, job } = await this.job(id),
      capture = job.cars.find((c) => c.facts.slug === (slug || job.cars[0]?.facts.slug));
    if (!capture || (!slug && job.cars.length !== 1))
      throw new PromoError('PHOTO_PLAN', 'Specify --car for a multi-car job.');
    const selected = {};
    for (const [role, n] of Object.entries(roles)) {
      if (!Number.isInteger(n) || n < 1 || n > capture.images.length)
        throw new PromoError('PHOTO_PLAN', 'Photo indices must refer to this contact sheet.');
      selected[role] = capture.images[n - 1].hash;
    }
    validatePlan(selected, capture);
    const plan = await read(path.join(dir, 'photo-plan.json'));
    plan.cars[capture.facts.slug] = selected;
    await write(path.join(dir, 'photo-plan.json'), plan);
    await write(await this.planCache(capture), selected);
    return { job: id, car: capture.facts.slug, roles: selected, next: 'preview' };
  }
  async locked(id, fn) {
    const { dir } = await this.job(id),
      file = path.join(dir, '.lock');
    if (await exists(file)) {
      const pid = Number(await fs.readFile(file, 'utf8'));
      let alive = true;
      try {
        process.kill(pid, 0);
      } catch (e) {
        if (e.code === 'ESRCH') alive = false;
      }
      if (alive) throw new PromoError('BUSY', 'This job is already running.');
      await fs.unlink(file);
    }
    const lock = await fs.open(file, 'wx');
    await lock.writeFile(String(process.pid));
    try {
      return await fn();
    } finally {
      await lock.close();
      await fs.unlink(file).catch(() => {});
    }
  }
  key(job, capture, plan) {
    return inputKey(
      capture,
      plan,
      fingerprint({ style: job.styleKey, fixture: Boolean(job.fixtureDir) }),
    );
  }
  async preview(id) {
    return this.locked(id, async () => {
      const { dir, job, plan } = await this.load(id),
        proofs = [],
        keys = {};
      for (const c of job.cars) {
        const p = plan.cars[c.facts.slug];
        keys[c.facts.slug] = this.key(job, c, p);
        for (const format of Object.keys(SETTINGS.formats))
          proofs.push(
            await media.preview(
              dir,
              { ...renderVehicle(c, p), fixture: Boolean(job.fixtureDir) },
              format,
            ),
          );
      }
      await write(path.join(dir, 'preview.json'), {
        keys,
        proofs,
        checkedAt: new Date().toISOString(),
      });
      return { job: id, proofs, next: 'Inspect the previews, then render.' };
    });
  }
  async render(id) {
    return this.locked(id, async () => {
      const { dir, job, plan } = await this.load(id);
      let preview;
      try {
        preview = await read(path.join(dir, 'preview.json'));
      } catch {
        throw new PromoError(
          'NEEDS_PREVIEW',
          'Run preview and inspect its frames before rendering.',
        );
      }
      const tasks = [];
      for (const c of job.cars) {
        const key = this.key(job, c, plan.cars[c.facts.slug]);
        if (preview.keys[c.facts.slug] !== key)
          throw new PromoError(
            'NEEDS_PREVIEW',
            'The facts or photo plan changed; run preview again.',
          );
        for (const format of Object.keys(SETTINGS.formats)) tasks.push({ c, key, format });
      }
      const results = [];
      const worker = async () => {
        while (tasks.length) {
          const { c, key, format } = tasks.shift(),
            name = c.facts.slug + '-' + format;
          const destination = path.join(dir, 'exports', name + '.mp4'),
            reportFile = path.join(dir, 'results', name + '.json'),
            cache = path.join(this.runs, 'cache', 'results', key, format);
          let previous;
          for (const [movie, record] of [
            [destination, reportFile],
            [cache + '.mp4', cache + '.json'],
          ]) {
            try {
              const r = await read(record);
              const content = await fs.readFile(movie);
              if (validResult(r, c.facts.slug, format, key) && sha(content) === r.sha256) {
                previous = { ...r, movie, content };
                break;
              }
            } catch {}
          }
          await fs.mkdir(path.dirname(destination), { recursive: true });
          let report;
          if (previous) {
            if (previous.movie !== destination) await fs.writeFile(destination, previous.content);
            report = { ...previous };
            delete report.movie;
            delete report.content;
            report.reused = true;
          } else {
            const temp = destination.replace(/\.mp4$/, '.part.mp4');
            try {
              await media.render(
                dir,
                { ...renderVehicle(c, plan.cars[c.facts.slug]), fixture: Boolean(job.fixtureDir) },
                format,
                temp,
              );
              report = { ...(await media.verify(temp, format)), inputKey: key, reused: false };
              await fs.rename(temp, destination);
            } finally {
              await fs.unlink(temp).catch(() => {});
            }
          }
          report.file = path.relative(dir, destination);
          report.car = c.facts.slug;
          report.format = format;
          await write(reportFile, report);
          await fs.mkdir(path.dirname(cache), { recursive: true });
          const cacheTemp = cache + '.' + randomUUID() + '.tmp';
          await fs.copyFile(destination, cacheTemp);
          await fs.rename(cacheTemp, cache + '.mp4');
          await write(cache + '.json', report);
          results.push(report);
        }
      };
      const outcomes = await Promise.allSettled([worker(), worker()]);
      const failed = outcomes.find((r) => r.status === 'rejected');
      if (failed) throw failed.reason;
      return { job: id, results, next: 'deliver' };
    });
  }
  async deliver(id) {
    const { dir, job, plan } = await this.load(id),
      results = [],
      changed = [];
    if (!job.cars.length) return { job: id, files: [], skipped: job.skipped, errors: job.errors };
    for (const c of job.cars) {
      try {
        const current = normalize(await this.listing(c.facts.listingUrl), c.facts.listingUrl);
        current.images = await Promise.all(
          current.images.map(async (image) => ({
            ...image,
            hash: sha(await this.image(image.url)),
          })),
        );
        if (
          fingerprint(current.facts) !== fingerprint(c.facts) ||
          galleryKey(current) !== c.galleryKey
        )
          changed.push({ url: c.facts.listingUrl, reason: 'Listing facts or gallery changed.' });
      } catch (e) {
        changed.push({ url: c.facts.listingUrl, reason: e.message });
      }
      for (const format of Object.keys(SETTINGS.formats)) {
        const report = await read(path.join(dir, 'results', c.facts.slug + '-' + format + '.json'));
        if (
          !validResult(report, c.facts.slug, format, this.key(job, c, plan.cars[c.facts.slug])) ||
          sha(await fs.readFile(inside(dir, path.join(dir, report.file)))) !== report.sha256
        )
          throw new PromoError(
            'OUTPUT_CHANGED',
            'An output is incomplete or changed; run render to repair it.',
          );
        results.push(report);
      }
    }
    await write(path.join(dir, 'availability.json'), {
      checkedAt: new Date().toISOString(),
      changed,
    });
    if (changed.length)
      throw new PromoError(
        'STALE',
        'Listing data changed. Prepare the URLs again; unchanged videos can be reused.',
        { urls: job.urls, changed },
      );
    const index = path.join(dir, 'index.md'),
      lines = [
        '# Dealers-Drive car promos',
        '',
        ...(job.fixtureDir ? ['**TEST FIXTURES — not live vehicle advertisements.**', ''] : []),
        '| Vehicle | Vertical | Horizontal |',
        '| --- | --- | --- |',
      ];
    for (const c of job.cars) {
      const title = [c.facts.year, c.facts.make, c.facts.model, c.facts.variant]
        .filter(Boolean)
        .join(' ');
      lines.push(
        `| ${title.replaceAll('|', ' ')} | [Vertical](exports/${c.facts.slug}-vertical.mp4) | [Horizontal](exports/${c.facts.slug}-horizontal.mp4) |`,
      );
    }
    await fs.writeFile(index, lines.join('\n') + '\n');
    await write(path.join(dir, 'delivery.json'), {
      job: id,
      fixture: Boolean(job.fixtureDir),
      verifiedAt: new Date().toISOString(),
      results,
      skipped: job.skipped,
      errors: job.errors,
    });
    const archives = job.cars.length > 1 ? await media.packageJob(dir) : [];
    return {
      job: id,
      fixture: Boolean(job.fixtureDir),
      files: results.map((r) => ({
        car: r.car,
        format: r.format,
        path: path.join(dir, r.file),
        reused: r.reused,
      })),
      archives,
      index,
      skipped: job.skipped,
      errors: job.errors,
    };
  }
}
export function validResult(r, slug, format, key) {
  const v = SETTINGS.formats[format];
  return Boolean(
    r?.verified &&
    r.inputKey === key &&
    r.car === slug &&
    r.format === format &&
    r.width === v.width &&
    r.height === v.height &&
    r.fps === SETTINGS.fps &&
    r.frames === SETTINGS.fps * SETTINGS.duration &&
    Math.abs(r.duration - SETTINGS.duration) <= 0.03,
  );
}
