# Local checkout recovery contract

Source: https://payos.vn/docs/api/ — v2 create includes QR; GET contains status/identity/received amount, not QR.
Uses only synthetic merchant credentials and a fixed test checksum key. No upstream forwarding.
Run: `postman simulation run postman/simulations/payos-checkout.sim.yaml --port 4901 --output ndjson`.
Run test-classpath `com.example.backend.service.PayOSCheckoutSimulationProbe` with that process listening.
Normal order 101 returns signed QR; order 102 is accepted but loses its POST response, then recovers by GET only.
Owner workspace/mock lookup was not performed; this narrow local stand-in follows the public provider contract.
This verifies the real SDK/gateway HTTP/signature path; persistence/locking and browser behavior use separate isolated regression tests. It does not verify live PayOS performance or bank transfers.

2026-10-28: real Java21 SDK/gateway probe PASS against local CLI 1.75.0 simulation, normal signed QR and lost-acknowledgement order 102 recovered by GET. Observed member request events; no external forwarding. On this Windows host CLI needed a TTY and `--no-history` to emit its listening event.
