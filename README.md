# 🛍️ Retail360+ — Smart Retail Data Fusion Platform

> Real-time retail intelligence dashboard for anomaly detection, queue insights, and customer experience optimization — built with **MERN + Socket.IO + Python stream server**.

---

## Overview

Retail360+ connects multiple IoT data sources — POS, RFID, Vision, and Queue sensors — into one intelligent real-time dashboard.  
It continuously ingests live event streams via a **Python TCP replay server** and fuses them with Node.js algorithms to detect:
- Scanner avoidance  
- Barcode switching  
- Weight mismatches  
- Long queues and staffing needs  

Built for hackathon-grade reliability, it simulates a fully operational smart store with **live baskets, incident feeds, and digital twin visualizations.**

---

## System Architecture
```text
┌───────────────────────────────┐
│        Frontend (React)       │
│  ──────────────────────────   │
│  • Live Digital Twin UI       │
│  • Basket & Incident Feeds    │
│  • Immune Response Simulation │
└─────────────┬─────────────────┘
              │ WebSocket (Socket.IO)
┌─────────────▼─────────────────┐
│       Backend (Node + Express)│
│  ───────────────────────────  │
│  • TCP client (Python stream) │
│  • Fusion algorithms (#@algorithm)│
│  • Incident + event mapping   │
│  • Emits real-time updates    │
└─────────────┬─────────────────┘
              │ TCP (JSONL frames)
┌─────────────▼─────────────────┐
│   Python Stream Server        │
│  • Replays datasets as events │
│  • Feeds: POS, RFID, Vision   │
│  • 10x speed configurable     │
└───────────────────────────────┘
```
## Algorithms

| Algorithm | Purpose |
|------------|----------|
| **#@algorithm Fusion** | Combines POS, RFID, Vision, and Queue signals to compute consensus scores. |
| **#@algorithm Weight Tolerance** | Detects weight mismatches using product catalog and thresholds. |
| **#@algorithm Event Mapper** | Maps fusion results into standardized events for `events.jsonl`. |
| **#@algorithm Queue Monitor** | Detects high dwell times and customer load for staffing recommendations. |

---

## Tech Stack

- **Frontend:** React + TailwindCSS + Vite  
- **Backend:** Node.js + Express + Socket.IO  
- **Stream Engine:** Python (TCP Replay Server)  
- **Data:** JSONL + CSV (POS, RFID, Vision, Queue)  
- **Architecture:** Event-driven / Real-time Fusion  

---

## Live Data Flow

1. **Python Stream Server** replays all datasets (`rfid_readings.jsonl`, `pos_transactions.jsonl`, etc.)  
2. **Node backend** connects via TCP and parses JSONL events.  
3. Each frame is routed by dataset type (POS, RFID, Vision, Queue).  
4. **Fusion engine** computes a confidence score per kiosk.  
5. Events & incidents are emitted via **Socket.IO** to the React frontend.  
6. **Frontend dashboard** updates live baskets, kiosk statuses, and incidents dynamically.  

---

## Immune Response Simulation

Trigger scenarios directly from the dashboard:

- 🟠 **Suspicious Item** — Scanner avoidance  
- 🔴 **Weight Mismatch** — Weight sensor discrepancy  
- 🟣 **RFID Anomaly** — Tag reading failure  
- 🟢 **Normal Checkout** — Successful transaction  

Each simulation runs a predefined JSONL sequence (`scan_avoidance.jsonl`, etc.) through the `/simulate` route — producing new incidents and event logs in real time.

## Output Artifacts

| File | Description |
|------|--------------|
| **events.jsonl** | Consolidated ground-truth event log for judges |
| **POS_Transactions**, **RFID_data**, **Queue_monitor**, etc. | Input dataset streams |
| **products_list.csv**, **customer_data.csv** | Reference catalogs |

---

## How to Run

### 1️. Start the Python Stream Server
```bash
cd data/streaming-server
python stream_server.py --port 8765 --speed 10 --loop
```
### 2. Start the Backend
```bash
cd server
npm install
npm run dev
```

### 3️. Start the Frontend
```bash
cd client
npm install
npm run dev
```
