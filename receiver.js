import express from "express"
import { Webhook } from "standardwebhooks"

const secret = process.env.OFAUTH_WEBHOOK_SECRET
if (!secret) throw new Error("Set OFAUTH_WEBHOOK_SECRET")
const verifier = new Webhook(secret)
const app = express()

app.post("/webhooks/ofauth", express.raw({ type: "application/json", limit: "2mb" }), (req, res) => {
  if (!Buffer.isBuffer(req.body)) return res.sendStatus(400)
  let event
  try {
    event = verifier.verify(req.body.toString("utf8"), {
      "webhook-id": req.get("webhook-id"),
      "webhook-timestamp": req.get("webhook-timestamp"),
      "webhook-signature": req.get("webhook-signature")
    })
  } catch {
    return res.sendStatus(400)
  }
  if (event?.type === "ofauth.webhook.challenge") {
    if (typeof event.challenge !== "string" || !event.challenge) return res.sendStatus(400)
    return res.type("text/plain").send(event.challenge)
  }
  if (!event || typeof event.eventId !== "string" || typeof event.type !== "string") {
    return res.sendStatus(400)
  }
  console.log({ eventId: event.eventId, type: event.type, test: event.test })
  res.sendStatus(204)
})

app.listen(3001, "127.0.0.1")
