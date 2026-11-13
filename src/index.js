// 수능 고사실 실시간 서버
// 사이트 파일(public/)은 Cloudflare가 그대로 내보내고, /ws 로 들어온 접속만 이 코드가 처리한다.
// 고사실 하나가 Durable Object 하나이고, 접속자들의 위치·자리·진도만 주고받는다. 시험 진도는 각자 브라우저에서 따로 흐른다.
import { DurableObject } from "cloudflare:workers";

const MAX_PEOPLE = 30;      // 한 고사실 최대 접속자
const SEATS = 28;           // 자리 수 (4줄 x 7칸)
const MAX_MSG_PER_SEC = 20; // 한 사람이 1초에 보낼 수 있는 메시지 수
const ROOM_X = 5.8, ROOM_Z0 = -4.8, ROOM_Z1 = 7.4;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/ws") {
      if (request.headers.get("Upgrade") !== "websocket") {
        return new Response("WebSocket 연결만 받습니다.", { status: 426 });
      }
      const room = (url.searchParams.get("room") || "01").replace(/[^0-9a-z-]/gi, "").slice(0, 20) || "01";
      const stub = env.ROOM.get(env.ROOM.idFromName(room));
      return stub.fetch(request);
    }
    return env.ASSETS.fetch(request);
  },
};

const clamp = (v, a, b) => Math.max(a, Math.min(b, Number.isFinite(v) ? v : a));
const cleanText = (s, n, fallback) => {
  const t = String(s ?? "").replace(/[\u0000-\u001f\u007f<>]/g, "").replace(/\s+/g, " ").trim().slice(0, n);
  return t || fallback;
};

export class Room extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    // 브라우저가 보내는 "ping"에는 서버를 깨우지 않고 "pong"으로 답한다 (요금 없음)
    this.ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair("ping", "pong"));
  }

  async fetch() {
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    if (this.ctx.getWebSockets().length >= MAX_PEOPLE) {
      server.accept();
      server.send(JSON.stringify({ t: "full" }));
      server.close(1013, "full");
      return new Response(null, { status: 101, webSocket: client });
    }
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment({
      id: crypto.randomUUID().slice(0, 8), joined: false,
      name: "수험생", color: 0, x: 5.2, z: -3.7, ry: 0, seat: null, prog: "대기 중", exam: false,
      win: 0, cnt: 0,
    });
    return new Response(null, { status: 101, webSocket: client });
  }

  peerOf(a) {
    return { id: a.id, name: a.name, color: a.color, x: a.x, z: a.z, ry: a.ry, seat: a.seat, prog: a.prog, exam: a.exam };
  }

  others(except) {
    return this.ctx.getWebSockets().filter((s) => s !== except && s.readyState === 1);
  }

  broadcast(msg, except) {
    const text = JSON.stringify(msg);
    for (const s of this.others(except)) {
      const a = s.deserializeAttachment();
      if (!a || !a.joined) continue;
      try { s.send(text); } catch (e) { /* 끊긴 연결은 close 이벤트에서 정리된다 */ }
    }
  }

  seatTaken(seat, except) {
    return this.others(except).some((s) => {
      const a = s.deserializeAttachment();
      return a && a.joined && a.seat === seat;
    });
  }

  async webSocketMessage(ws, raw) {
    if (typeof raw !== "string" || raw.length > 600) return;
    const a = ws.deserializeAttachment();
    if (!a) return;
    const now = Date.now();
    if (now - a.win > 1000) { a.win = now; a.cnt = 0; }
    if (++a.cnt > MAX_MSG_PER_SEC) { ws.serializeAttachment(a); return; }

    let m;
    try { m = JSON.parse(raw); } catch (e) { return; }

    switch (m.t) {
      case "hello": {
        a.name = cleanText(m.name, 12, "수험생");
        a.color = clamp(Math.floor(m.color), 0, 8);
        a.x = clamp(m.x, -ROOM_X, ROOM_X); a.z = clamp(m.z, ROOM_Z0, ROOM_Z1); a.ry = clamp(m.ry, -7, 7);
        a.prog = cleanText(m.prog, 40, "대기 중"); a.exam = !!m.exam;
        const wantSeat = Number.isInteger(m.seat) && m.seat >= 0 && m.seat < SEATS ? m.seat : null;
        a.seat = wantSeat !== null && !this.seatTaken(wantSeat, ws) ? wantSeat : null;
        a.joined = true;
        ws.serializeAttachment(a);
        const peers = this.others(ws).map((s) => s.deserializeAttachment()).filter((p) => p && p.joined).map((p) => this.peerOf(p));
        ws.send(JSON.stringify({ t: "welcome", id: a.id, seat: a.seat, peers }));
        if (wantSeat !== null && a.seat === null) ws.send(JSON.stringify({ t: "seat-taken", seat: wantSeat }));
        this.broadcast({ t: "join", peer: this.peerOf(a) }, ws);
        return;
      }
      case "pos": {
        if (!a.joined || a.seat !== null) break;
        a.x = clamp(m.x, -ROOM_X, ROOM_X); a.z = clamp(m.z, ROOM_Z0, ROOM_Z1); a.ry = clamp(m.ry, -7, 7);
        this.broadcast({ t: "pos", id: a.id, x: a.x, z: a.z, ry: a.ry }, ws);
        break;
      }
      case "sit": {
        if (!a.joined) break;
        const seat = Number.isInteger(m.seat) && m.seat >= 0 && m.seat < SEATS ? m.seat : null;
        if (seat === null) break;
        if (this.seatTaken(seat, ws)) { ws.send(JSON.stringify({ t: "seat-taken", seat })); break; }
        a.seat = seat;
        this.broadcast({ t: "seat", id: a.id, seat }, ws);
        break;
      }
      case "stand": {
        if (!a.joined) break;
        a.seat = null;
        a.x = clamp(m.x, -ROOM_X, ROOM_X); a.z = clamp(m.z, ROOM_Z0, ROOM_Z1); a.ry = clamp(m.ry, -7, 7);
        this.broadcast({ t: "seat", id: a.id, seat: null, x: a.x, z: a.z, ry: a.ry }, ws);
        break;
      }
      case "prog": {
        if (!a.joined) break;
        a.prog = cleanText(m.prog, 40, "대기 중"); a.exam = !!m.exam;
        this.broadcast({ t: "prog", id: a.id, prog: a.prog, exam: a.exam }, ws);
        break;
      }
      case "name": {
        if (!a.joined) break;
        a.name = cleanText(m.name, 12, "수험생");
        this.broadcast({ t: "name", id: a.id, name: a.name }, ws);
        break;
      }
    }
    ws.serializeAttachment(a);
  }

  async webSocketClose(ws) { this.leave(ws); }
  async webSocketError(ws) { this.leave(ws); }

  leave(ws) {
    const a = ws.deserializeAttachment();
    if (a && a.joined) {
      a.joined = false;
      try { ws.serializeAttachment(a); } catch (e) { /* 이미 닫힌 연결 */ }
      this.broadcast({ t: "leave", id: a.id }, ws);
    }
    try { ws.close(1000, "bye"); } catch (e) { /* 이미 닫힘 */ }
  }
}
