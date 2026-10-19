import { randomUUID } from "node:crypto"
import { writeFileSync } from "node:fs"
import { Webhook } from "standardwebhooks"

const secret = process.env.OFAUTH_WEBHOOK_SECRET
if (!secret) throw new Error("Set OFAUTH_WEBHOOK_SECRET")
const signer = new Webhook(secret)
const endpoint = "http://127.0.0.1:3001/webhooks/ofauth"
const checks = []

async function check(name, event, expectedStatus, options = {}) {
	const id = randomUUID()
	const date = new Date(Date.now() - (options.stale ? 10 * 60_000 : 0))
	const body = JSON.stringify(event)
	const headers = {
		"content-type": "application/json",
		"webhook-id": id,
		"webhook-timestamp": String(Math.floor(date.getTime() / 1000)),
		"webhook-signature": signer.sign(id, date, body)
	}
	if (options.unsigned) delete headers["webhook-signature"]
	const response = await fetch(options.wrongPath ? endpoint + "/missing" : endpoint, {
		method: "POST",
		headers,
		body: options.modified ? body + " " : body,
		signal: AbortSignal.timeout(5000)
	})
	const responseBody = await response.text()
	const challengeMatches = !options.challenge || (
		responseBody === event.challenge &&
		response.headers.get("content-type")?.startsWith("text/plain")
	)
	const passed = response.status === expectedStatus && challengeMatches
	checks.push({ name, expectedStatus, actualStatus: response.status, passed })
	console.log(`${passed ? "PASS" : "FAIL"} ${name}: ${response.status}`)
}

const fixture = {
	eventId: "local-event-1",
	type: "linked_account.expired",
	schemaVersion: "1",
	order: 1,
	occurredAt: new Date().toISOString(),
	environment: "sandbox",
	integrationId: "int_local_fixture",
	externalOauthClientId: "local_fixture_client",
	authorizationId: "local_fixture_authorization",
	linkedAccountId: "local_fixture_account",
	test: true,
	data: {
		authorization_id: "local_fixture_authorization",
		linked_account_id: "local_fixture_account",
		reason: "provider_session_expired"
	}
}

await check("exact challenge", {
	type: "ofauth.webhook.challenge", challenge: "local-verification-check"
}, 200, { challenge: true })
await check("signed fixture", fixture, 204)
await check("duplicate fixture", fixture, 204)
await check("unknown event", { ...fixture, type: "example.unhandled" }, 204)
await check("modified body", fixture, 400, { modified: true })
await check("missing signature", fixture, 400, { unsigned: true })
await check("stale timestamp", fixture, 400, { stale: true })
await check("wrong route", fixture, 404, { wrongPath: true })

const passed = checks.every(check => check.passed)
writeFileSync("webhook-test-results.json", JSON.stringify({ passed, checks }, null, 2))
console.log("Saved webhook-test-results.json")
if (!passed) process.exitCode = 1
