// Server-side handling of MSG91 verdicts, against an API started with PHONE_OTP_DRIVER=msg91
// and msg91-fault-preload.mjs (CERT_API_MSG91, default :4007). Only the provider call is
// simulated; routes, validation, the msg91 adapter and session issuance are the real ones.
// What MSG91 itself enforces (expiry, attempt and resend caps, delivery) is out of reach here.
import * as h from "./lib.mjs";

const r = h.recorder("msg91-faults");
const API = process.env.CERT_API_MSG91 ?? "http://localhost:4007";
const digits = () => h.phone().replace(/^\+/, "");

async function signIn(path, phoneDigits, accessToken) {
  const res = await h.call("POST", path, {
    base: API,
    body: { phone: `+${phoneDigits}`, accessToken },
  });
  const sessions = await h.one(
    `SELECT count(*)::int n FROM sessions s JOIN users u ON u.id=s."userId" WHERE u.phone=$1`,
    [`+${phoneDigits}`],
  );
  return {
    status: res.status,
    code: res.json?.code ?? res.json?.status ?? null,
    cookie: res.setCookie.some(
      (c) => /^dd_session=[^;]+/.test(c) && !/Max-Age=0/i.test(c),
    ),
    sessions: sessions.n,
    ms: res.ms,
  };
}

const CUSTOMER = "/v1/auth/sign-in/phone/customer";
const DEALER = "/v1/auth/sign-in/phone/dealer";

await h.check(r, "AUTH-DISC-003", async () => {
  const out = {};
  for (const [label, token] of [
    ["rejected", "fault-reject"],
    ["provider500", "fault-500"],
    ["throttled429", "fault-429"],
    ["timeout", "fault-timeout"],
    ["network", "fault-network"],
  ]) {
    const n = digits();
    out[label] = {
      customer: await signIn(CUSTOMER, n, token),
      dealer: await signIn(DEALER, n, token),
    };
  }
  r.ev(out);
  const noSession = Object.values(out).every(
    (x) =>
      !x.customer.cookie &&
      !x.dealer.cookie &&
      x.customer.sessions === 0 &&
      x.dealer.sessions === 0,
  );
  const rejectedIs4xx =
    out.rejected.customer.status >= 400 &&
    out.rejected.customer.status < 500 &&
    out.rejected.dealer.status < 500;
  const outageIs5xx = [
    "provider500",
    "throttled429",
    "timeout",
    "network",
  ].every((k) => out[k].customer.status >= 500 && out[k].dealer.status >= 500);
  const timeoutBounded = out.timeout.customer.ms < 5000;
  return noSession && rejectedIs4xx && outageIs5xx && timeoutBounded
    ? {
        layers: ["API", "SECURITY", "RECOVERY"],
        note: `MSG91 refusal → ${out.rejected.customer.status} ${out.rejected.customer.code}; provider 500/429/timeout/network → ${out.provider500.customer.status}/${out.throttled429.customer.status}/${out.timeout.customer.status}/${out.network.customer.status} (${out.timeout.customer.code}); timeout answered in ${out.timeout.customer.ms} ms; no session or cookie in any case, customer or dealer`,
      }
    : {
        status: "FAIL",
        layers: ["API", "SECURITY"],
        note: JSON.stringify(out).slice(0, 600),
      };
});

await h.check(r, "AUTH-DISC-004", async () => {
  const proved = digits();
  const claimed = digits();
  const customer = await signIn(CUSTOMER, claimed, `fault-ok-${proved}`);
  const dealer = await signIn(DEALER, claimed, `fault-ok-${proved}`);
  r.ev({ customer, dealer });
  return customer.status >= 400 &&
    dealer.status >= 400 &&
    !customer.cookie &&
    !dealer.cookie &&
    customer.sessions === 0 &&
    dealer.sessions === 0
    ? {
        layers: ["API", "SECURITY"],
        note: `a token proving one number cannot sign in another (${customer.status} ${customer.code} / ${dealer.status} ${dealer.code}); no session`,
      }
    : {
        status: "FAIL",
        layers: ["API", "SECURITY"],
        note: JSON.stringify({ customer, dealer }),
      };
});

await h.check(r, "AUTH-DISC-005", async () => {
  // Replay of the same MSG91 access token. MSG91 is expected to verify a token once; the
  // fake answers success every time, so this shows what the server adds on its own.
  const n = digits();
  const token = `fault-ok-${n}`;
  const first = await signIn(CUSTOMER, n, token);
  const second = await signIn(CUSTOMER, n, token);
  r.ev({ first, second });
  if (first.status !== 200)
    return {
      status: "FAIL",
      note: `first sign-in did not succeed (${first.status} ${first.code})`,
    };
  return second.status >= 400
    ? {
        layers: ["API", "SECURITY"],
        note: `first use ${first.status} ${first.code}; the server refuses the replayed access token itself (${second.status} ${second.code})`,
      }
    : {
        status: "BLOCKED",
        layers: ["API", "SECURITY"],
        note: `the server does not record customer access tokens: a replay accepted by MSG91 would be accepted (${first.status} then ${second.status}). Single use is therefore MSG91's guarantee alone — confirm it in MANUAL-UAT (AUTH-005). Admin proofs keep a durable redemption hash.`,
      };
});

r.save();
await h.pool.end();
