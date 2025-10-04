#!/usr/bin/env python3
"""
run_demo.py
One-file, judge-ready demo runner.

- Starts a pure-Python TCP replay server over datasets in ./data/input/
- Runs a pure-Python consumer that performs BasketProof™ fusion
- Writes ./results/events.jsonl (judge-friendly JSONL)

Usage:
  python3 run_demo.py
Optional:
  python3 run_demo.py --speed 25 --port 8765
"""

from __future__ import annotations
import argparse
import csv
import json
import logging
import os
import re
import socket
import socketserver
import threading
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Iterable, List, Dict, Any, Optional

# ----------------------------
# Paths & defaults
# ----------------------------
HERE = Path(__file__).resolve().parent
DATA_INPUT = HERE / "data" / "input"
RESULTS = HERE / "results"
OUTFILE = RESULTS / "events.jsonl"

TCP_HOST = "127.0.0.1"
TCP_PORT = 8765
SPEED = 25.0  # accelerated replay
LOOP = False  # single pass only (judges want a complete run then exit)

DATASETS = [
    "POS_Transactions",
    "RFID_data",
    "Queue_monitor",
    "Product_recognism",
    "Current_inventory_data",
]

# ----------------------------
# Helpers
# ----------------------------
def iso_now():
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()

def die(msg: str, code: int = 1):
    print(f"[run_demo] ERROR: {msg}")
    raise SystemExit(code)

# ----------------------------
# Part 1: TCP replay server
# (pure Python stdlib)
# ----------------------------
DATASET_ALIASES: Dict[str, str] = {
    "POS_Transactions": "pos_transactions",
    "RFID_data": "rfid_readings",
    "Queue_monitor": "queue_monitoring",
    "Product_recognism": "product_recognition",
    "Current_inventory_data": "inventory_snapshots",
}
FILENAME_TO_CANONICAL: Dict[str, str] = {v: k for k, v in DATASET_ALIASES.items()}
EXCLUDE_DATASETS = {"events"}

def resolve_dataset_path(data_root: Path, name: str) -> Path:
    candidates = []
    search_keys = []
    alias = DATASET_ALIASES.get(name)
    if alias:
        search_keys.append(alias)
    search_keys.append(name)
    for key in search_keys:
        stem = key.rstrip("/")
        if not stem:
            continue
        for suffix in (".jsonl", ".json"):
            candidate = data_root / f"{stem}{suffix}"
            if candidate.exists():
                return candidate
            candidates.append(candidate)
    attempted = ", ".join(str(path) for path in candidates)
    raise SystemExit(f"Dataset file not found. Tried: {attempted}")

def load_events(dataset_path: Path) -> List[Dict[str, Any]]:
    with dataset_path.open("r", encoding="utf-8") as handle:
        try:
            payload = json.load(handle)
        except json.JSONDecodeError:
            handle.seek(0)
            payload = [json.loads(line) for line in handle if line.strip()]
    if isinstance(payload, list):
        return payload
    if isinstance(payload, dict):
        if "events" in payload and isinstance(payload["events"], list):
            return payload["events"]
        return [payload]
    raise ValueError(f"Unsupported JSON structure in {dataset_path}.")

def parse_timestamp(value: Any, dataset: str, source: Path) -> datetime:
    if not isinstance(value, str):
        raise ValueError(f"Event in {dataset} ({source}) missing string timestamp: {value!r}")
    try:
        return datetime.fromisoformat(value)
    except ValueError as exc:
        raise ValueError(f"Unable to parse timestamp '{value}' in {dataset} ({source})") from exc

def collect_events(dataset_paths: Iterable[Path]) -> tuple[List[Dict[str, Any]], List[str]]:
    all_events: List[Dict[str, Any]] = []
    dataset_names: List[str] = []
    for path in dataset_paths:
        dataset_name = FILENAME_TO_CANONICAL.get(path.stem, path.stem)
        dataset_names.append(dataset_name)
        raw_events = load_events(path)
        if not raw_events:
            continue
        for event in raw_events:
            ts = parse_timestamp(event.get("timestamp"), dataset_name, path)
            all_events.append({"dataset": dataset_name, "timestamp": ts, "payload": event})
    if not all_events:
        raise ValueError("No events found across provided datasets.")
    all_events.sort(key=lambda item: item["timestamp"])
    return all_events, dataset_names

class EventStreamRequestHandler(socketserver.BaseRequestHandler):
    def handle(self) -> None:  # type: ignore[override]
        server: ReplayTCPServer = self.server  # type: ignore[assignment]
        client_host, client_port = self.client_address
        logging.info("Client connected from %s:%s", client_host, client_port)

        # banner
        banner = {
            "service": "project-sentinel-event-stream",
            "datasets": server.dataset_names,
            "events": len(server.events),
            "loop": server.loop,
            "speed_factor": server.speed,
            "cycle_seconds": server.cycle_span.total_seconds(),
            "schema": "newline-delimited JSON objects",
        }
        self.request.sendall(json.dumps(banner).encode("utf-8") + b"\n")

        try:
            loop_index = 0
            prev: Optional[datetime] = None
            sequence = 1
            # Single or looping
            while True:
                logging.info("Starting replay cycle %d", loop_index + 1)
                for record in server.events:
                    adjusted: datetime = record["timestamp"] + (server.cycle_span * loop_index)
                    if prev is not None:
                        delta_s = (adjusted - prev).total_seconds()
                        gap = (delta_s / server.speed) if server.speed > 0 else 0
                        if gap <= 0:
                            gap = 0.1 / max(1.0, server.speed)
                        time.sleep(gap)
                    prev = adjusted

                    original_timestamp = record["payload"].get("timestamp")
                    event_copy = dict(record["payload"])
                    event_copy["timestamp"] = adjusted.isoformat()

                    frame = {
                        "dataset": record["dataset"],
                        "sequence": sequence,
                        "timestamp": adjusted.isoformat(),
                        "original_timestamp": original_timestamp,
                        "event": event_copy,
                    }
                    self.request.sendall(json.dumps(frame).encode("utf-8") + b"\n")
                    sequence += 1

                if not server.loop:
                    logging.info("Loop disabled, ending stream")
                    break
                loop_index += 1
                logging.info("Completed cycle %d, rolling next", loop_index)
        except (BrokenPipeError, ConnectionResetError):
            logging.info("Client %s:%s disconnected", client_host, client_port)
        finally:
            logging.info("Stream to %s:%s ended", client_host, client_port)

class ReplayTCPServer(socketserver.ThreadingTCPServer):
    allow_reuse_address = True
    def __init__(self, addr, events, dataset_names, speed, loop, cycle_span):
        super().__init__(addr, EventStreamRequestHandler)
        self.events = list(events)
        self.dataset_names = dataset_names
        self.speed = speed
        self.loop = loop
        self.cycle_span = cycle_span

def start_server(host, port, data_root: Path, datasets: List[str], speed: float, loop: bool) -> ReplayTCPServer:
    if not data_root.exists():
        die(f"Data directory not found: {data_root}")
    dataset_paths = [resolve_dataset_path(data_root, name) for name in datasets]
    events, dataset_names = collect_events(dataset_paths)
    first = events[0]["timestamp"]
    last = events[-1]["timestamp"]

    min_gap: Optional[timedelta] = None
    for i in range(len(events) - 1):
        gap = events[i + 1]["timestamp"] - events[i]["timestamp"]
        if gap.total_seconds() > 0 and (min_gap is None or gap < min_gap):
            min_gap = gap
    if min_gap is None:
        min_gap = timedelta(seconds=1)

    cycle_span = (last - first) + min_gap
    if cycle_span.total_seconds() <= 0:
        cycle_span = timedelta(seconds=1)

    srv = ReplayTCPServer((host, port), events, dataset_names, speed, loop, cycle_span)
    t = threading.Thread(target=srv.serve_forever, daemon=True)
    t.start()
    logging.info("TCP server started on %s:%s (speed=%sx, datasets=%s)", host, port, speed, dataset_names)
    return srv

# ----------------------------
# Part 2: Consumer (fusion + mapper)
# ----------------------------
class FusionEngine:
    """
    @algorithm BasketProof | Multi-sensor consensus scoring
    """
    def __init__(self, products_csv: Path, vision_conf=0.85, weight_tol_pct=0.07):
        self.vision_conf = vision_conf
        self.weight_tol_pct = weight_tol_pct
        self.state = {}  # station -> {pos:[], rfid:[], vision:[], queue:{}, score, reasons}
        self.weights = self._load_weights(products_csv)

    def _load_weights(self, path: Path):
        weights = {}
        try:
            with open(path, "r", encoding="utf-8") as f:
                rdr = csv.DictReader(f)
                for row in rdr:
                    sku = row.get("SKU") or row.get("sku")
                    w = row.get("weight_g") or row.get("Weight") or row.get("weight")
                    if sku and w:
                        try:
                            weights[sku] = float(w)
                        except:
                            pass
        except Exception:
            pass
        return weights

    def _get(self, st):
        if st not in self.state:
            self.state[st] = {"pos": [], "rfid": [], "vision": [], "queue": {}, "score": 0.0, "reasons": []}
        return self.state[st]

    def last_pos(self, st):
        s = self._get(st)
        return s["pos"][-1] if s["pos"] else None

    def get_queue(self, st):
        return self._get(st)["queue"]

    def push_pos(self, st, data, status=None):
        s = self._get(st)
        s["pos"].append(data)
        if len(s["pos"]) > 10:
            s["pos"].pop(0)
        if data.get("sku"):
            exp = self.weights.get(data["sku"])
            try:
                if exp is not None:
                    data["expected_weight"] = float(exp)
            except Exception:
                pass

    def push_rfid(self, st, data):
        # ignore null-only frames
        if not any((data.get("sku"), data.get("epc"), data.get("location"))):
            return
        s = self._get(st)
        s["rfid"].append(data)
        if len(s["rfid"]) > 20:
            s["rfid"].pop(0)

    def push_vision(self, st, data, status=None):
        if not data.get("predicted_product"):
            return
        s = self._get(st)
        s["vision"].append(data)
        if len(s["vision"]) > 10:
            s["vision"].pop(0)

    def set_queue(self, st, q):
        self._get(st)["queue"] = q or {}

    def compute(self, st):
        s = self._get(st)
        score = 0.0
        reasons = []

        v = s["vision"][-1] if s["vision"] else None
        p = s["pos"][-1] if s["pos"] else None

        # 1) scan avoidance
        if v and v.get("predicted_product") and float(v.get("accuracy", 0.0)) >= self.vision_conf:
            seen_in_pos = any(x.get("sku") == v["predicted_product"] for x in s["pos"])
            if not seen_in_pos:
                score += 0.40
                reasons.append(f"Vision {v['predicted_product']}@{float(v.get('accuracy',0.0)):.2f} not in POS")
                in_bag = any(
                    (r.get("sku") == v["predicted_product"]) and str(r.get("location","")).upper().startswith("IN")
                    for r in s["rfid"]
                )
                if in_bag:
                    score += 0.20
                    reasons.append("RFID in scan/bag area for vision SKU")

        # 2) barcode switching
        if v and v.get("predicted_product") and p and p.get("sku") and v["predicted_product"] != p["sku"]:
            score += 0.30
            reasons.append(f"Vision {v['predicted_product']} ≠ POS {p['sku']}")

        # 3) weight discrepancy
        if p and (p.get("weight_g") is not None):
            try:
                observed = float(p["weight_g"])
                expected = float(p.get("expected_weight") or self.weights.get(p["sku"]) or observed)
                tol = self.weight_tol_pct * expected
                if abs(observed - expected) > tol:
                    score += 0.25
                    reasons.append(f"Weight delta {observed-expected:.0f}g (obs={observed}, exp={expected})")
            except Exception:
                pass

        # 4) queue bump
        q = s.get("queue") or {}
        if (q.get("customer_count", 0) >= 6) or (q.get("average_dwell_time", 0) >= 120):
            score += 0.05
            reasons.append("High queue pressure")

        s["score"] = max(0.0, min(1.0, score))
        s["reasons"] = reasons
        return {"score": s["score"], "reasons": reasons}

class Mapper:
    """Writes judge-friendly events.jsonl lines."""
    def __init__(self, out_path: Path):
        self.out_path = out_path
        self.out_path.parent.mkdir(parents=True, exist_ok=True)
        self._fh = open(self.out_path, "w", encoding="utf-8")
        self._counter = 0

    def _next_id(self):
        eid = f"E{self._counter:03d}"
        self._counter += 1
        return eid

    def _write(self, payload: dict):
        self._fh.write(json.dumps(payload, ensure_ascii=False) + "\n")
        self._fh.flush()

    def from_fusion(self, station_id, fusion_result, last_pos):
        ts = iso_now()
        reasons = fusion_result.get("reasons") or []
        for r in reasons:
            # Scanner Avoidance
            if r.startswith("Vision") and "not in POS" in r:
                self._write({
                    "timestamp": ts,
                    "event_id": self._next_id(),
                    "event_data": {
                        "event_name": "Scanner Avoidance",
                        "station_id": station_id,
                        "customer_id": last_pos.get("customer_id") if last_pos else None,
                        "product_sku": (last_pos or {}).get("sku") or self._parse_sku(r)
                    }
                })
            # Barcode Switching
            if r.startswith("Vision") and "≠ POS" in r:
                self._write({
                    "timestamp": ts,
                    "event_id": self._next_id(),
                    "event_data": {
                        "event_name": "Barcode Switching",
                        "station_id": station_id,
                        "customer_id": last_pos.get("customer_id") if last_pos else None,
                        "actual_sku": self._parse_sku(r, "Vision"),
                        "scanned_sku": (last_pos or {}).get("sku")
                    }
                })
            # Weight Discrepancies
            if r.startswith("Weight delta"):
                self._write({
                    "timestamp": ts,
                    "event_id": self._next_id(),
                    "event_data": {
                        "event_name": "Weight Discrepancies",
                        "station_id": station_id,
                        "customer_id": last_pos.get("customer_id") if last_pos else None,
                        "product_sku": (last_pos or {}).get("sku"),
                        "expected_weight": (last_pos or {}).get("expected_weight"),
                        "actual_weight": (last_pos or {}).get("weight_g")
                    }
                })

    def maybe_status(self, station_id, dataset_name, status):
        if not status:
            return
        if re.search(r"(Crash|Read Error|Failure)", str(status), flags=re.IGNORECASE):
            self._write({
                "timestamp": iso_now(),
                "event_id": self._next_id(),
                "event_data": {
                    "event_name": "Unexpected Systems Crash",
                    "station_id": station_id,
                    "duration_seconds": 0
                }
            })

    def from_queue(self, station_id, queue):
        if not queue:
            return
        cc = queue.get("customer_count") or 0
        dt = queue.get("average_dwell_time") or 0

        if cc >= 6:
            self._write({
                "timestamp": iso_now(),
                "event_id": self._next_id(),
                "event_data": {
                    "event_name": "Long Queue Length",
                    "station_id": station_id,
                    "num_of_customers": cc
                }
            })
            self._write({
                "timestamp": iso_now(),
                "event_id": self._next_id(),
                "event_data": {
                    "event_name": "Staffing Needs",
                    "station_id": station_id,
                    "Staff_type": "Cashier"
                }
            })
            self._write({
                "timestamp": iso_now(),
                "event_id": self._next_id(),
                "event_data": {
                    "event_name": "Checkout Station Action",
                    "station_id": station_id,
                    "Action": "Open"
                }
            })

        if dt >= 120:
            self._write({
                "timestamp": iso_now(),
                "event_id": self._next_id(),
                "event_data": {
                    "event_name": "Long Wait Time",
                    "station_id": station_id,
                    "wait_time_seconds": dt
                }
            })

    def _parse_sku(self, reason, prefix="PRD_"):
        m = re.search(r"(PRD_[A-Z]_\d+|PRD_\w+)", reason or "")
        return m.group(1) if m else None

# ----------------------------
# Part 3: TCP client (consumer loop)
# ----------------------------
def readlines(sock: socket.socket):
    buff = ""
    sock.settimeout(10.0)
    while True:
        chunk = sock.recv(4096).decode("utf-8", errors="ignore")
        if not chunk:
            break
        buff += chunk
        while "\n" in buff:
            line, buff = buff.split("\n", 1)
            if line.strip():
                yield line.strip()

def consume_once(host, port, products_csv: Path, out_file: Path):
    fusion = FusionEngine(products_csv=products_csv)
    mapper = Mapper(out_file)

    s = socket.create_connection((host, port))
    print(f"[consumer] Connected to {host}:{port}")

    frames = 0
    for raw in readlines(s):
        try:
            frame = json.loads(raw)
        except json.JSONDecodeError:
            continue

        # Skip banner
        if isinstance(frame, dict) and "service" in frame:
            print(f"[server] datasets={frame.get('datasets')} speed={frame.get('speed_factor')}")
            continue

        ds = (frame.get("dataset") or "").lower()
        evt = frame.get("event") or {}
        station = evt.get("station_id", "SCC?")

        if "pos_transactions" in ds:
            fusion.push_pos(station, evt.get("data") or {}, status=evt.get("status"))
            result = fusion.compute(station)
            mapper.maybe_status(station, "POS_Transactions", evt.get("status"))
            mapper.from_fusion(station, result, fusion.last_pos(station))

        elif "rfid_data" in ds or "rfid_readings" in ds:
            fusion.push_rfid(station, evt.get("data") or {})

        elif "product_recognism" in ds or "product_recognition" in ds:
            fusion.push_vision(station, evt.get("data") or {}, status=evt.get("status"))
            result = fusion.compute(station)
            mapper.maybe_status(station, "Product_recognism", evt.get("status"))
            mapper.from_fusion(station, result, fusion.last_pos(station))

        elif "queue_monitor" in ds:
            fusion.set_queue(station, evt.get("data") or {})
            mapper.from_queue(station, fusion.get_queue(station))

        elif "current_inventory_data" in ds or "inventory_snapshots" in ds:
            # optional: diff snapshots here and call mapper.inventory_discrepancy(...)
            pass

        frames += 1

    s.close()
    print(f"[consumer] Stream closed. Frames processed: {frames}")
    print(f"[consumer] Events written -> {out_file}")

# ----------------------------
# Main
# ----------------------------
def parse_args():
    p = argparse.ArgumentParser(description="One-file runner: stream server + fusion consumer")
    p.add_argument("--host", default=TCP_HOST)
    p.add_argument("--port", type=int, default=TCP_PORT)
    p.add_argument("--speed", type=float, default=SPEED)
    p.add_argument("--loop", action="store_true", help="Loop the stream (default: single pass)")
    return p.parse_args()

def main():
    args = parse_args()
    logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")

    # Validate inputs
    if not DATA_INPUT.exists():
        die(f"Missing input dir: {DATA_INPUT}")
    required = [
        "pos_transactions.jsonl", "rfid_readings.jsonl", "queue_monitoring.jsonl",
        "product_recognition.jsonl", "inventory_snapshots.jsonl", "products_list.csv"
    ]
    missing = [p for p in required if not (DATA_INPUT / p).exists()]
    if missing:
        die("Missing required dataset files in data/input: " + ", ".join(missing))

    RESULTS.mkdir(parents=True, exist_ok=True)
    out_file = OUTFILE

    # Start server
    srv = start_server(
        host=args.host,
        port=args.port,
        data_root=DATA_INPUT,
        datasets=DATASETS,
        speed=args.speed,
        loop=args.loop or LOOP,
    )

    # Small stagger
    time.sleep(0.4)

    # Consume once (will finish after server finishes one pass & client socket closes)
    try:
        consume_once(args.host, args.port, DATA_INPUT / "products_list.csv", out_file)
    finally:
        try:
            srv.shutdown()
        except Exception:
            pass

    if out_file.exists():
        lines = sum(1 for _ in open(out_file, "r", encoding="utf-8"))
        print(f"\n[run_demo] ✅ Done. Results at: {out_file}  (lines={lines})")
    else:
        die("Consumer didn't create results/events.jsonl")

if __name__ == "__main__":
    main()

