const { ZeebeCanary } = require("../dist");
const http = require("http");

const CHIRP_URL = process.env.CHIRP_URL || `http://localhost:3000`;
const SQUAWK_URL = process.env.SQUAWK_URL || "http://localhost:3001";

const canary = new ZeebeCanary({
  ChirpUrl: CHIRP_URL,
  SquawkUrl: SQUAWK_URL,
  CanaryId: "dockerised-canary",
  HeartbeatPeriodSeconds: 300
});

http
  .createServer((_, res) => {
    console.log(`[${new Date()}]  CHIRP`);
    res.json({ ok: true });
  })
  .listen(3000);

http
  .createServer((_, res) => {
    console.log(`[${new Date()}]  ¡¡¡¡¡SQUAWK!!!!!`);
    res.json({ ok: true });
  })
  .listen(3001);
