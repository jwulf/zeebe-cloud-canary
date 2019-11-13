const { ZeebeCanary } = require("../dist");
const http = require("http");

const CHIRP_URL = process.env.CHIRP_URL || `http://localhost:3000`;
const SQUAWK_URL = process.env.SQUAWK_URL || "http://localhost:3001";
const CANARY_HEARTBEAT_SEC = process.env.CANARY_HEARTBEAT_SEC || 30;
const DEBUG = process.env.DEBUG || false;

const canary = new ZeebeCanary({
  ChirpUrl: CHIRP_URL,
  SquawkUrl: SQUAWK_URL,
  CanaryId: "dockerised-canary",
  HeartbeatPeriodSeconds: CANARY_HEARTBEAT_SEC,
  Debug: DEBUG
});

http
  .createServer((_, res) => {
    console.log(`[${new Date()}]  CHIRP`);
    res.end("CHIRP OK");
  })
  .listen(3000);

http
  .createServer((_, res) => {
    console.log(`[${new Date()}]  ¡¡¡¡¡SQUAWK!!!!!`);
    res.end("SQUAWK OK");
  })
  .listen(3001);
