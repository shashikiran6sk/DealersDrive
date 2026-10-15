function origin(value, local) {
  const url = new URL(value);
  if (url.username || url.password || url.search || url.hash || url.pathname !== '/')
    throw new Error('Build endpoints must be service origins without credentials.');
  if (url.protocol !== 'https:' && !(local && url.protocol === 'http:'))
    throw new Error('Non-development builds require HTTPS.');
  return url;
}

function buildConfig(config, env) {
  const mode = env.EXPO_PUBLIC_APP_ENV ?? 'development';
  if (!['development', 'preview', 'production'].includes(mode))
    throw new Error('Unknown Android build environment.');
  const local = mode === 'development';
  const api = env.EXPO_PUBLIC_API_BASE_URL ?? (local ? 'http://10.0.2.2:4000' : '');
  const web = env.EXPO_PUBLIC_WEB_BASE_URL ?? (local ? 'http://10.0.2.2:3000' : '');
  origin(api, local);
  const website = origin(web, local);
  const production = mode === 'production';
  if (production && env.APP_RELEASE_APPROVED !== 'true')
    throw new Error('Production build requires the separate owner release approval gate.');
  const packageName = production
    ? env.APP_ANDROID_PACKAGE
    : `com.dealersdrive.customer.${local ? 'dev' : 'preview'}`;
  if (
    typeof packageName !== 'string' ||
    !/^[a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*){2,}$/.test(packageName) ||
    (production && /\.(dev|preview|test)$/.test(packageName))
  )
    throw new Error('Set the owner-approved production Android package.');
  const versionCode = Number(env.APP_ANDROID_VERSION_CODE ?? (production ? '' : '1'));
  if (!Number.isSafeInteger(versionCode) || versionCode < 1 || versionCode > 2100000000)
    throw new Error('Set a positive Android version code within Play limits.');
  const host = env.APP_LINK_HOST;
  if (host && (host !== website.hostname || website.port || website.protocol !== 'https:'))
    throw new Error('App Links host must match the HTTPS website origin.');
  if (production && !host) throw new Error('Production requires the approved App Links host.');
  return {
    ...config,
    android: {
      ...config.android,
      package: packageName,
      versionCode,
      intentFilters: host
        ? [
            {
              action: 'VIEW',
              autoVerify: true,
              category: ['BROWSABLE', 'DEFAULT'],
              data: [
                { scheme: 'https', host, pathPrefix: '/car/' },
                { scheme: 'https', host, pathPrefix: '/dealers/' },
                { scheme: 'https', host, path: '/cars' },
                { scheme: 'https', host, path: '/dealers' },
              ],
            },
          ]
        : [],
    },
  };
}
module.exports = { buildConfig };
