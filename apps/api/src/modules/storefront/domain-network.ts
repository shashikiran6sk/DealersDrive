import { Resolver } from 'node:dns/promises';
import { isIP } from 'node:net';
import { connect } from 'node:tls';

import { StorefrontHostname } from '@dealers-drive/contracts';

export function publicIpv4(value: string): boolean {
  if (isIP(value) !== 4) return false;
  const [a = 0, b = 0] = value.split('.').map(Number);
  return !(
    a === 0 ||
    a === 10 ||
    a === 127 ||
    a >= 224 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && (b === 168 || b === 0 || b === 2)) ||
    (a === 198 && (b === 18 || b === 19 || b === 51)) ||
    (a === 203 && b === 0) ||
    (a === 100 && b >= 64 && b <= 127)
  );
}

export async function domainOwnership(hostname: string, token: string): Promise<boolean> {
  StorefrontHostname.parse(hostname);
  const resolver = new Resolver({ timeout: 1500, tries: 1 });
  try {
    const records = await resolver.resolveTxt(`_dealers-drive.${hostname}`);
    return records.some((record) => record.join('') === token);
  } catch {
    return false;
  }
}

export async function certificateReady(hostname: string): Promise<boolean> {
  StorefrontHostname.parse(hostname);
  const resolver = new Resolver({ timeout: 1500, tries: 1 });
  let addresses: string[];
  try {
    addresses = await resolver.resolve4(hostname);
  } catch {
    return false;
  }
  if (!addresses.length || addresses.some((address) => !publicIpv4(address))) return false;
  return new Promise((resolve) => {
    const socket = connect({
      host: addresses[0],
      port: 443,
      servername: hostname,
      rejectUnauthorized: true,
    });
    const finish = (ready: boolean) => {
      socket.destroy();
      resolve(ready);
    };
    socket.setTimeout(2500, () => finish(false));
    socket.once('error', () => finish(false));
    socket.once('secureConnect', () => finish(socket.authorized));
  });
}
