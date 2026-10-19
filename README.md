# OFAuth webhook receiver

Run a local Express receiver that verifies Standard Webhooks signatures, echoes signed destination challenges, and logs accepted event metadata. It does not change application state.

## Install

Use Node.js 22 or later.

```bash
git clone https://github.com/ofauth-source/example-node-webhooks.git
cd example-node-webhooks
npm ci
```

## Generate a local test secret

For signed local fixtures, start without a `.env` file. Generate a secret without printing it:

```bash
node --input-type=module -e '
import { randomBytes } from "node:crypto"
import { writeFileSync } from "node:fs"
writeFileSync(".env", "OFAUTH_WEBHOOK_SECRET=whsec_" +
	randomBytes(32).toString("base64") + "\n", { flag: "wx", mode: 0o600 })
'
```

The command refuses to overwrite an existing file. A generated local secret is only for your local signed fixtures. It is not an OFAuth destination secret.

If you already have an OFAuth destination, copy the template instead and replace its placeholder with that destination's signing secret:

```bash
cp .env.example .env
```

Keep `.env` private and excluded from version control. No OAuth token or API scope is needed to receive or verify signed HTTP requests. Your destination selects its environment and subscribed events.

## Run and check

Start the receiver:

```bash
npm start
```

It listens silently at `http://127.0.0.1:3001/webhooks/ofauth`. In another terminal in this directory, run:

```bash
npm run check:webhooks
```

Expect eight `PASS` lines and `webhook-test-results.json` with `"passed": true`. Checks cover the exact plain-text challenge, a valid event, a duplicate event, an unused event type, a modified body, a missing signature, an expired timestamp, and a wrong route. The checks send only synthetic loopback requests and do not change accounts.

The receiver returns `200` with the exact challenge, `204` for accepted events, and `400` for missing, invalid, or stale signatures. Accepted events print their ID, type, and test flag. Press Ctrl+C to stop the receiver.

## Use your destination's secret

To receive OFAuth deliveries through your own HTTPS endpoint or tunnel, replace the local secret in `.env` with the destination's secret, then restart the receiver. Destination verification succeeds only when this receiver verifies the signed challenge and echoes its exact text. Confirm the destination is Verified and Active. See [Test webhooks locally](https://docs.ofauth.com/v3/guides/webhooks-local).

## Before applying customer updates

The receiver only logs events. It acknowledges duplicates without durable deduplication. Before adding side effects, durably save events, deduplicate by `eventId`, and acknowledge only after saving succeeds. Use per-account `order` to avoid applying older state. Map authorization and linked-account ownership to your application's user, keep environments separate, and keep synthetic fixtures out of customer records. A real designated account in Test can also have `test: true`.

Keep the raw-body handler before any JSON middleware. Verify signatures before reading event data or answering challenges. Do not log signing secrets or full event bodies. See the [receiver implementation reference](https://docs.ofauth.com/v3/guides/webhook-handler).
