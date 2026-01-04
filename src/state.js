import { ROOM_LOBBY, ROOM_WAVE } from './protocol.js';

const FIXED_SCALE = 1000;
const MOVE_PER_TICK_FIXED = 2431;
const DIAG_MOVE_PER_TICK_FIXED = 1718;
const MOUSE_FULL_STRENGTH_FIXED = 150 * FIXED_SCALE;
const PLAYER_RADIUS = 15;
const CENTRAL_PILLAR_RADIUS = 40;

export class GameState {
  constructor() {
    this.mapCache = new Map();
    this.currentMap = null;

    this.currentWaveDef = null;

    this.currentWaveNumber = 1;

    this.ws = null;
    this.yourId = null;
    this.currentRoom = ROOM_LOBBY;
    this.lastSnapshot = null;

    this.hasPlayed = false;
    this.localUsername = '';
    this.playOverlayVisible = false;

    this.inputSeq = 1;

    this.pendingInputs = [];

    this.pred = {
      fx: 0,
      fy: 0,
      prevSlideX: 0,
      prevSlideY: 0,
      slowMul: 1000,
      ackSeq: 0,
    };
    this.input = {
      up: false,
      down: false,
      left: false,
      right: false,
      mouseActive: false,
      mouseDx: 0,
      mouseDy: 0,
    };
  }

  clampPredToMap() {
    const map = this.currentMap;
    if (!map || !map.walls) return;

    const room = this.currentRoom;

    if (map.walls.kind === 'box') {
      const half = (typeof map.walls.halfSize === 'number') ? map.walls.halfSize : 0;
      const limitFixed = Math.max(0, Math.round((half - PLAYER_RADIUS) * FIXED_SCALE));

      let x = this.pred.fx | 0;
      let y = this.pred.fy | 0;

      x = Math.max(-limitFixed, Math.min(limitFixed, x));
      y = Math.max(-limitFixed, Math.min(limitFixed, y));

      if (room === ROOM_WAVE) {
        const minRFixed = Math.round((CENTRAL_PILLAR_RADIUS + PLAYER_RADIUS) * FIXED_SCALE);
        const dx = x;
        const dy = y;
        const d2 = dx * dx + dy * dy;
        const minR2 = minRFixed * minRFixed;
        if (d2 < minR2) {
          const d = Math.sqrt(Math.max(1, d2));
          x = Math.round((dx * minRFixed) / d);
          y = Math.round((dy * minRFixed) / d);
        }
      }

      this.pred.fx = x | 0;
      this.pred.fy = y | 0;
      return;
    }

    if (map.walls.kind === 'polygon' && Array.isArray(map.walls.points) && map.walls.points.length === 4) {
      const pts = map.walls.points;
      let isDiamond = true;
      for (const pt of pts) {
        const px = pt[0];
        const py = pt[1];
        if (!(Math.abs(px) < 1e-6 || Math.abs(py) < 1e-6)) {
          isDiamond = false;
          break;
        }
      }

      if (isDiamond) {
        let b = 0;
        for (const pt of pts) {
          b = Math.max(b, Math.abs(pt[0]), Math.abs(pt[1]));
        }
        const limitFixed = Math.max(0, Math.round((b - PLAYER_RADIUS) * FIXED_SCALE));

        let x = this.pred.fx | 0;
        let y = this.pred.fy | 0;

        const ax = Math.abs(x);
        const ay = Math.abs(y);
        const sum = ax + ay;

        if (sum > limitFixed) {
          if (sum === 0) {
            x = limitFixed;
            y = 0;
          } else {
            x = Math.trunc((x * limitFixed) / sum);
            y = Math.trunc((y * limitFixed) / sum);
          }
        }

        this.pred.fx = x | 0;
        this.pred.fy = y | 0;
      }
    }
  }

  isqrtU64(n) {
    if (n <= 0n) return 0n;
    let x = n;
    let y = (x + 1n) >> 1n;
    while (y < x) {
      x = y;
      y = (x + n / x) >> 1n;
    }
    return x;
  }

  applyInputToPred(input) {
    if (!this.lastSnapshot || this.yourId == null) {
      this.pred.prevSlideX = 0;
      this.pred.prevSlideY = 0;
      return;
    }

    const me = this.lastSnapshot.players.find((pp) => pp.id === this.yourId);
    if (!me || me.alive === false) {
      this.pred.prevSlideX = 0;
      this.pred.prevSlideY = 0;
      return;
    }

    const baseDist = (MOVE_PER_TICK_FIXED * (this.pred.slowMul | 0) / 1000) | 0;

    let dx = 0;
    let dy = 0;

    if (input.mouseActive) {
      const mdx = BigInt(input.mouseDx | 0);
      const mdy = BigInt(input.mouseDy | 0);
      const dist2 = mdx * mdx + mdy * mdy;
      const dist = this.isqrtU64(dist2);
      if (dist > 0n) {
        const clamped = dist > BigInt(MOUSE_FULL_STRENGTH_FIXED) ? BigInt(MOUSE_FULL_STRENGTH_FIXED) : dist;
        const num = BigInt(baseDist) * clamped;
        const den = dist * BigInt(MOUSE_FULL_STRENGTH_FIXED);
        dx = Number((mdx * num) / den) | 0;
        dy = Number((mdy * num) / den) | 0;
      }
    } else {
      let sx = 0;
      let sy = 0;
      if (input.up) sy -= 1;
      if (input.down) sy += 1;
      if (input.left) sx -= 1;
      if (input.right) sx += 1;

      if (sx !== 0 && sy !== 0) {
        dx = (sx * DIAG_MOVE_PER_TICK_FIXED) | 0;
        dy = (sy * DIAG_MOVE_PER_TICK_FIXED) | 0;
      } else {
        dx = (sx * baseDist) | 0;
        dy = (sy * baseDist) | 0;
      }
    }

    const slideX = (this.pred.prevSlideX / 4) | 0;
    const slideY = (this.pred.prevSlideY / 4) | 0;

    const totalDx = (dx + slideX) | 0;
    const totalDy = (dy + slideY) | 0;

    this.pred.fx = (this.pred.fx + totalDx) | 0;
    this.pred.fy = (this.pred.fy + totalDy) | 0;
    this.clampPredToMap();
    this.pred.prevSlideX = totalDx;
    this.pred.prevSlideY = totalDy;
  }

  setPredFromServerPlayer(p) {
    if (p && typeof p.fx === 'number' && typeof p.fy === 'number') {
      this.pred.fx = p.fx | 0;
      this.pred.fy = p.fy | 0;
    } else {
      const x = (p && typeof p.x === 'number') ? p.x : 0;
      const y = (p && typeof p.y === 'number') ? p.y : 0;
      this.pred.fx = Math.round(x * FIXED_SCALE) | 0;
      this.pred.fy = Math.round(y * FIXED_SCALE) | 0;
    }

    this.pred.prevSlideX = (p && typeof p.prevSlideX === 'number') ? (p.prevSlideX | 0) : 0;
    this.pred.prevSlideY = (p && typeof p.prevSlideY === 'number') ? (p.prevSlideY | 0) : 0;
    this.pred.slowMul = (p && typeof p.slowMul === 'number') ? (p.slowMul | 0) : 1000;
    this.pred.ackSeq = (p && typeof p.lastInputSeq === 'number') ? (p.lastInputSeq >>> 0) : 0;
  }

  reconcileWithSnapshot(snap) {
    if (!snap || !Array.isArray(snap.players) || this.yourId == null) return;
    const me = snap.players.find((pp) => pp.id === this.yourId);
    if (!me) return;

    this.setPredFromServerPlayer(me);

    if (typeof me.lastInputSeq !== 'number') {
      this.pendingInputs.length = 0;
      return;
    }

    const ack = this.pred.ackSeq >>> 0;
    if (this.pendingInputs.length > 0) {
      this.pendingInputs = this.pendingInputs.filter((pi) => (pi.seq >>> 0) > ack);
      for (const pi of this.pendingInputs) {
        this.pred.slowMul = (typeof pi.slowMul === 'number') ? (pi.slowMul | 0) : this.pred.slowMul;
        this.applyInputToPred(pi.input);
      }
    }
  }

  async loadMapByRoom(room, waveNumber) {
    if (room === ROOM_WAVE) {
      return this.waveVirtualMap();
    }

    const mapId = 'lobby';
    if (this.mapCache.has(mapId)) return this.mapCache.get(mapId);

    const res = await fetch(`/maps/${mapId}.json`);
    const json = await res.json();
    this.mapCache.set(mapId, json);
    return json;
  }

  waveVirtualMap() {
    if (!this.currentWaveDef) return null;
    const w = this.currentWaveDef;
    return {
      id: `wave${w.waveNumber}`,
      room: ROOM_WAVE,
      grid: { size: 25 },
      walls: { kind: 'box', strokeWidth: 4, halfSize: w.halfSize },
      wave: {
        entityRadius: w.entityRadius,
        spawnMargin: w.spawnMargin,
        wallEnemyRadiusScale: 2,
      },
      portals: [],
    };
  }

  wasdBits() {
    let b = 0;
    if (this.input.up) b |= 0b0001;
    if (this.input.down) b |= 0b0010;
    if (this.input.left) b |= 0b0100;
    if (this.input.right) b |= 0b1000;
    return b;
  }

  localPlayerPos() {
    if (this.hasPlayed && this.yourId != null) {
      return { x: this.pred.fx / FIXED_SCALE, y: this.pred.fy / FIXED_SCALE };
    }
    if (!this.lastSnapshot || this.yourId == null) return { x: 0, y: 0 };
    const p = this.lastSnapshot.players.find((pp) => pp.id === this.yourId);
    if (!p) return { x: 0, y: 0 };
    return { x: p.x, y: p.y };
  }
}

export { ROOM_LOBBY, ROOM_WAVE };
