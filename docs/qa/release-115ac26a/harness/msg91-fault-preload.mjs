// Fault injection for the msg91 phone-OTP driver. Loaded with `--import` into an API process
// started with PHONE_OTP_DRIVER=msg91, it answers only MSG91's verifyAccessToken endpoint and
// leaves every other request untouched. The access token chooses the outcome:
//   fault-ok-<digits>   success naming that mobile        fault-reject     refused token
//   fault-500           provider 500                       fault-429        provider throttled
//   fault-timeout       never answers (adapter timeout)    fault-network    connection error
const ENDPOINT = "https://control.msg91.com/api/v5/widget/verifyAccessToken";
const real = globalThis.fetch;
globalThis.fetch = async (input, init) => {
  const url = typeof input === "string" ? input : input.url;
  if (url !== ENDPOINT) return real(input, init);
  const token = JSON.parse(init.body)["access-token"];
  const json = (status, body) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    });
  if (token.startsWith("fault-ok-"))
    return json(200, { type: "success", message: token.slice(9) });
  if (token === "fault-reject")
    return json(200, { type: "error", message: "token expired" });
  if (token === "fault-500") return json(500, { type: "error" });
  if (token === "fault-429") return json(429, { type: "error" });
  if (token === "fault-network") throw new TypeError("fetch failed");
  if (token === "fault-timeout")
    return new Promise((_, reject) =>
      init.signal?.addEventListener("abort", () => reject(init.signal.reason)),
    );
  return json(200, { type: "error", message: "unknown token" });
};
