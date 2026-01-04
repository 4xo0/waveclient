import * as PIXI from 'pixi.js';

import { ROOM_LOBBY, ROOM_WAVE } from './protocol.js';

export class Renderer {
  constructor() {
    this.BG_COLOR = 0x333333;
    this.ARENA_FILL_COLOR = 0xffffff;
    this.GRID_COLOR = 0xd8d8d8;
    this.PLAYER_COLOR = 0x6ecbff;
    this.DEAD_PLAYER_COLOR = 0xff3b3b;
    this.PLAYER_RADIUS = 15;

    this.PLAYER_MAX_HP = 3;

    this.CAMERA_ZOOM = 1.5;

    this.PORTAL_SIZE = 80;
    this.DEFAULT_GRID_SIZE = 25;

    this.TRANSITION_PORTAL_RADIUS = 28;

    this.lobbyPortalSprites = new Map();
    this.lobbyPortalNodes = new Map();

    this.lobbyGhostRoot = null;
    this.lobbyGhosts = [];
    this.lobbyGhostMask = null;

    this.playerSprites = new Map();
    this.playerAliveState = new Map();

    this.playerNameLabels = new Map();

    this.deathAngleSprites = new Map();
    this.TURRET_BARREL_TIP_OFFSET = 52;

    this.playerHpBars = new Map();
    this.playerHpState = new Map();

    this.waveEntitySprites = new Map();
    this.turretRoot = null;
    this.turretBody = null;
    this.turretBarrel = null;
    this.turretShootAnim = 0;
    this.turretBarrelBaseX = 0;
    this.turretEyeL = null;
    this.turretEyeR = null;
    this.turretFaceRoot = null;
    this.turretMouth = null;
    this.miniTurretsGfx = null;
    this.miniTurretSprites = new Map();
    this.lastWaveEntityIds = null;

    this.blinkPhase = 0;
    this.blinkCooldown = 4.0 + Math.random() * 6.0;
    this.blinkTimer = 0;

    this.app = null;
    this.world = null;

    this.uiGfx = null;
    this.waveHud = null;
    this.waveBannerLabel = null;
    this.waveTimeLabel = null;
    this.waveBarGfx = null;

    this.countdownLabel = null;

    this.bg = null;
    this.arenaFillGfx = null;
    this.gridGfx = null;
    this.portalsGfx = null;
    this.lobbyGhostGfx = null;
    this.wallsGfx = null;
    this.playersGfx = null;
    this.playerNameGfx = null;
    this.waveGfx = null;

    this._lastScreenW = 0;
    this._lastScreenH = 0;

    this._currentMap = null;
    this._currentRoom = ROOM_LOBBY;
  }

  async init() {
    const app = new PIXI.Application();
    await app.init({
      background: this.BG_COLOR,
      resizeTo: window,
      antialias: true,
    });

    app.ticker.maxFPS = 0;
    app.ticker.minFPS = 0;

    document.getElementById('app').appendChild(app.canvas);

    const world = new PIXI.Container();
    app.stage.addChild(world);
    app.stage.sortableChildren = true;
    world.zIndex = 0;

    world.scale.set(this.CAMERA_ZOOM, this.CAMERA_ZOOM);
    world.sortableChildren = true;

    const uiGfx = new PIXI.Container();
    uiGfx.zIndex = 1000;
    app.stage.addChild(uiGfx);

    const waveHud = new PIXI.Container();
    waveHud.zIndex = 1001;
    uiGfx.addChild(waveHud);

    const waveBannerLabel = new PIXI.Text({
      text: 'WAVE 1',
      style: {
        fontFamily: 'Helvetica',
        fontWeight: '800',
        fontSize: 32,
        fill: 0xffffff,
        stroke: 0x000000,
        strokeThickness: 4,
      },
    });
    waveBannerLabel.anchor.set(0.5, 0);
    waveHud.addChild(waveBannerLabel);

    const waveTimeLabel = new PIXI.Text({
      text: '0:00',
      style: {
        fontFamily: 'Helvetica',
        fontWeight: '700',
        fontSize: 18,
        fill: 0xffffff,
        stroke: 0x000000,
        strokeThickness: 3,
      },
    });
    waveTimeLabel.anchor.set(0.5, 0);
    waveHud.addChild(waveTimeLabel);

    const waveBarGfx = new PIXI.Graphics();
    waveHud.addChild(waveBarGfx);

    const countdownLabel = new PIXI.Text({
      text: '',
      style: {
        fontFamily: 'Arial',
        fontSize: 48,
        fontWeight: '700',
        fill: 0xffffff,
        stroke: 0x000000,
        strokeThickness: 6,
      },
    });
    countdownLabel.anchor.set(0.5, 0.5);
    countdownLabel.x = app.screen.width / 2;
    countdownLabel.y = app.screen.height / 2;
    countdownLabel.visible = false;
    uiGfx.addChild(countdownLabel);

    window.addEventListener('resize', () => {
      countdownLabel.x = app.screen.width / 2;
      countdownLabel.y = app.screen.height / 2;
      this.layoutWaveHud();
    });

    this._lastScreenW = app.screen.width;
    this._lastScreenH = app.screen.height;
    app.ticker.add(() => {
      if (this._lastScreenW !== app.screen.width || this._lastScreenH !== app.screen.height) {
        this._lastScreenW = app.screen.width;
        this._lastScreenH = app.screen.height;
        countdownLabel.x = app.screen.width / 2;
        countdownLabel.y = app.screen.height / 2;
        this.layoutWaveHud();
      }
    });

    const bg = new PIXI.Graphics();
    bg.rect(-2000, -2000, 4000, 4000);
    bg.fill(this.BG_COLOR);
    world.addChild(bg);
    bg.zIndex = 0;

    const arenaFillGfx = new PIXI.Container();
    world.addChild(arenaFillGfx);
    arenaFillGfx.zIndex = 1;

    const gridGfx = new PIXI.Container();
    world.addChild(gridGfx);
    gridGfx.zIndex = 2;

    const portalsGfx = new PIXI.Container();
    world.addChild(portalsGfx);
    portalsGfx.zIndex = 3;
    portalsGfx.sortableChildren = true;

    const lobbyGhostGfx = new PIXI.Container();
    world.addChild(lobbyGhostGfx);
    lobbyGhostGfx.zIndex = 3;

    const wallsGfx = new PIXI.Container();
    world.addChild(wallsGfx);
    wallsGfx.zIndex = 4;

    const playersGfx = new PIXI.Container();
    world.addChild(playersGfx);
    playersGfx.zIndex = 5;

    const playerNameGfx = new PIXI.Container();
    world.addChild(playerNameGfx);
    playerNameGfx.zIndex = 6;

    const waveGfx = new PIXI.Container();
    world.addChild(waveGfx);
    waveGfx.zIndex = 4;
    waveGfx.sortableChildren = true;

    this.app = app;
    this.world = world;
    this.uiGfx = uiGfx;
    this.waveHud = waveHud;
    this.waveBannerLabel = waveBannerLabel;
    this.waveTimeLabel = waveTimeLabel;
    this.waveBarGfx = waveBarGfx;
    this.countdownLabel = countdownLabel;

    this.bg = bg;
    this.arenaFillGfx = arenaFillGfx;
    this.gridGfx = gridGfx;
    this.portalsGfx = portalsGfx;
    this.lobbyGhostGfx = lobbyGhostGfx;
    this.wallsGfx = wallsGfx;
    this.playersGfx = playersGfx;
    this.playerNameGfx = playerNameGfx;
    this.waveGfx = waveGfx;

    app.ticker.add((t) => {
      if (!this.turretRoot || !this.turretBarrel) return;
      const dt = (t.deltaMS || 0) / 1000;
      if (this.turretShootAnim > 0) {
        this.turretShootAnim = Math.max(0, this.turretShootAnim - dt);
        const u = this.turretShootAnim / 0.12;
        const kick = Math.sin((1 - u) * Math.PI) * 6;
        this.turretBarrel.x = this.turretBarrelBaseX + kick;
      } else {
        this.turretBarrel.x = this.turretBarrelBaseX;
      }
    });

    app.ticker.add((t) => {
      if (!this.turretRoot || !this.turretEyeL || !this.turretEyeR) return;
      const dt = (t.deltaMS || 0) / 1000;

      const BLINK_DUR = 0.22;

      if (this.blinkPhase === 0) {
        this.blinkCooldown -= dt;
        if (this.blinkCooldown <= 0) {
          this.blinkPhase = 1;
          this.blinkTimer = BLINK_DUR;
        }
      }

      if (this.blinkPhase === 1) {
        this.blinkTimer -= dt;
        const u = Math.max(0, Math.min(1, 1 - this.blinkTimer / BLINK_DUR));
        const tri = u < 0.5 ? u / 0.5 : (1 - u) / 0.5;
        const sy = 0.06 + 0.94 * tri;
        this.turretEyeL.scale.y = sy;
        this.turretEyeR.scale.y = sy;

        if (this.blinkTimer <= 0) {
          this.blinkPhase = 0;
          this.blinkCooldown = 4.0 + Math.random() * 6.0;
          this.turretEyeL.scale.y = 1;
          this.turretEyeR.scale.y = 1;
        }
      }
    });

    app.ticker.add((t) => {
      const dt = (t.deltaMS || 0) / 1000;
      for (const g of this.lobbyPortalSprites.values()) {
        if (g && g._kind === 3 && g instanceof PIXI.Container) {
          g.rotation += (g._spin || 0.5) * dt;
          g._pulse = (g._pulse || 0) + dt * 2.0;
          const s = 1.0 + Math.sin(g._pulse) * 0.03;
          g.scale.set(s, s);

          const base = (g._spin || 0.5) * dt;
          for (const child of g.children) {
            if (child && typeof child._spinMult === 'number') {
              child.rotation += base * child._spinMult;
            }

            if (child && typeof child._pulseMult === 'number') {
              const p = 0.5 + 0.5 * Math.sin((g._pulse || 0) * child._pulseMult);
              const a = (child.alpha || 1) * (0.75 + 0.25 * p);
              child.alpha = Math.min(0.75, Math.max(0.16, a));
            }
          }
        }
      }
    });

    app.ticker.add((t) => {
      const dt = (t.deltaMS || 0) / 1000;

      if (this._currentRoom !== ROOM_LOBBY) {
        this.clearLobbyGhosts();
        return;
      }

      if (!this._currentMap || !this._currentMap.walls) return;

      const walls = this._currentMap.walls;

      if (walls.kind === 'polygon' && Array.isArray(walls.points) && walls.points.length === 4) {
        let b = 0;
        for (const pt of walls.points) {
          b = Math.max(b, Math.abs(pt[0]), Math.abs(pt[1]));
        }

        this.ensureLobbyGhosts(b);

        for (const g of this.lobbyGhosts) {
          g._ph = (g._ph || 0) + dt * 1.3;
          const wob = Math.sin(g._ph || 0) * 0.5;

          g.x += (g._vx || 0) * dt;
          g.y += (g._vy || 0) * dt;

          const r = typeof g._r === 'number' ? g._r : 14;
          const limit = b - r - 5;
          const ax = Math.abs(g.x);
          const ay = Math.abs(g.y);
          const d = ax + ay;

          if (d > limit) {
            const sx = g.x >= 0 ? 1 : -1;
            const sy = g.y >= 0 ? 1 : -1;
            const nx = sx * 0.70710678;
            const ny = sy * 0.70710678;
            const pen = d - limit;

            g.x -= pen * nx;
            g.y -= pen * ny;

            const vx = g._vx || 0;
            const vy = g._vy || 0;
            const vn = vx * nx + vy * ny;
            g._vx = vx - 2 * vn * nx;
            g._vy = vy - 2 * vn * ny;
            g._vx *= 0.995;
            g._vy *= 0.995;
          }

          g.alpha = 0.42 + 0.18 * (0.5 + 0.5 * Math.sin((g._ph || 0) * 1.7 + wob));
        }

        return;
      }

      if (walls.kind === 'box') {
        const half = walls.halfSize;

        this.ensureLobbyGhosts(half);
        for (const g of this.lobbyGhosts) {
          g._ph = (g._ph || 0) + dt * 1.3;
          g.x += (g._vx || 0) * dt;
          g.y += (g._vy || 0) * dt;

          const r = typeof g._r === 'number' ? g._r : 14;
          if (g.x < -half + r + 2 || g.x > half - r - 2) {
            g._vx = -(g._vx || 0);
            g.x = Math.max(-half + r + 2, Math.min(half - r - 2, g.x));
          }
          if (g.y < -half + r + 2 || g.y > half - r - 2) {
            g._vy = -(g._vy || 0);
            g.y = Math.max(-half + r + 2, Math.min(half - r - 2, g.y));
          }

          g.alpha = 0.42 + 0.18 * (0.5 + 0.5 * Math.sin((g._ph || 0) * 1.7));
        }
      }
    });

    app.ticker.add((t) => {
      const dt = (t.deltaMS || 0) / 1000;
      for (const g of this.waveEntitySprites.values()) {
        if (g && g._kind === 3 && g instanceof PIXI.Container) {
          g.rotation += (g._spin || 0.5) * dt;
          g._pulse = (g._pulse || 0) + dt * 2.2;
          const s = 1.0 + Math.sin(g._pulse) * 0.03;
          g.scale.set(s, s);

          const base = (g._spin || 0.5) * dt;
          for (const child of g.children) {
            if (child && typeof child._spinMult === 'number') {
              child.rotation += base * child._spinMult;
            }

            if (child && typeof child._pulseMult === 'number') {
              const p = 0.5 + 0.5 * Math.sin((g._pulse || 0) * child._pulseMult);
              const a = (child.alpha || 1) * (0.75 + 0.25 * p);
              child.alpha = Math.min(0.75, Math.max(0.16, a));
            }
          }
        }
      }
    });

    this.layoutWaveHud();
  }

  setMap(map, room) {
    this._currentMap = map;
    this._currentRoom = room;
  }

  setRoom(room) {
    this._currentRoom = room;
  }

  mixColor(a, b, t) {
    const ar = (a >> 16) & 255;
    const ag = (a >> 8) & 255;
    const ab = a & 255;
    const br = (b >> 16) & 255;
    const bg = (b >> 8) & 255;
    const bb = b & 255;
    const r = Math.max(0, Math.min(255, Math.round(ar + (br - ar) * t)));
    const g = Math.max(0, Math.min(255, Math.round(ag + (bg - ag) * t)));
    const bl = Math.max(0, Math.min(255, Math.round(ab + (bb - ab) * t)));
    return (r << 16) | (g << 8) | bl;
  }

  buildLobbyPortalGfx(r, tint) {
    const base = tint >>> 0;
    const hot = this.mixColor(base, 0xffffff, 0.55);
    const deep = this.mixColor(base, 0x000000, 0.55);
    const gold = this.mixColor(hot, 0xffd36b, 0.45);

    const c = new PIXI.Container();
    c._kind = 3;

    const halo = new PIXI.Graphics();
    const haloSteps = 12;
    for (let i = 0; i < haloSteps; i++) {
      const t = i / (haloSteps - 1);
      const rr = r * (1.35 - t * 0.55);
      const a = 0.06 * (1 - t) * (1 - t);
      halo.circle(0, 0, rr);
      halo.fill({ color: base, alpha: a });
    }
    halo.blendMode = 'add';
    halo.alpha = 0.72;
    c.addChild(halo);

    const ring = new PIXI.Graphics();
    ring.circle(0, 0, r * 1.02);
    ring.stroke({ color: hot, width: 4, alpha: 0.9 });
    ring.circle(0, 0, r * 0.86);
    ring.stroke({ color: deep, width: 3, alpha: 0.55 });
    c.addChild(ring);

    const diamond = new PIXI.Graphics();
    const d = r * 0.92;
    diamond.moveTo(0, -d);
    diamond.lineTo(d, 0);
    diamond.lineTo(0, d);
    diamond.lineTo(-d, 0);
    diamond.closePath();
    diamond.stroke({ color: gold, width: 3, alpha: 0.85 });
    diamond.blendMode = 'add';
    diamond._spinMult = -1.25;
    diamond._pulseMult = 1.8;
    c.addChild(diamond);

    const swirlA = new PIXI.Graphics();
    const armsA = 8;
    for (let i = 0; i < armsA; i++) {
      const a0 = (i / armsA) * Math.PI * 2;
      const a1 = a0 + Math.PI / 1.9;
      swirlA.arc(0, 0, r * 0.76, a0, a1);
      swirlA.stroke({ color: deep, width: 3, alpha: 0.18 });
    }
    swirlA._spinMult = 1.35;
    c.addChild(swirlA);

    const swirlB = new PIXI.Graphics();
    const armsB = 6;
    for (let i = 0; i < armsB; i++) {
      const a0 = (i / armsB) * Math.PI * 2 + Math.PI / 12;
      const a1 = a0 + Math.PI / 1.55;
      swirlB.arc(0, 0, r * 0.58, a0, a1);
      swirlB.stroke({ color: this.mixColor(base, 0xffffff, 0.12), width: 4, alpha: 0.20 });
    }
    swirlB._spinMult = -1.85;
    c.addChild(swirlB);

    const core = new PIXI.Graphics();
    const coreSteps = 9;
    for (let i = 0; i < coreSteps; i++) {
      const t = i / (coreSteps - 1);
      const rr = r * (0.62 - t * 0.42);
      const a = 0.26 * (1 - t);
      core.circle(0, 0, rr);
      core.fill({ color: 0x000000, alpha: a });
    }
    c.addChild(core);

    c.zIndex = 1;
    return c;
  }

  buildWavePortalGfx(r) {
    return this.buildLobbyPortalGfx(r, 0x7a2cff);
  }

  waveEntityRadius(state) {
    if (state.currentMap && state.currentMap.wave && typeof state.currentMap.wave.entityRadius === 'number') {
      return state.currentMap.wave.entityRadius;
    }
    return 18;
  }

  ensureTurret() {
    if (this.turretRoot) return;
    this.turretRoot = new PIXI.Container();
    this.turretRoot.zIndex = 0;
    this.waveGfx.addChild(this.turretRoot);

    this.turretBody = new PIXI.Graphics();
    this.turretBody.circle(0, 0, 25);
    this.turretBody.fill(0x9a9a9a);
    this.turretBody.stroke({ color: 0x4a4a4a, width: 4, alpha: 1 });
    this.turretBody._isSquare = false;
    this.turretRoot.addChild(this.turretBody);

    this.turretBarrel = new PIXI.Graphics();
    this.turretBarrel.rect(14, -8, 40, 16);
    this.turretBarrel.fill(0x9a9a9a);
    this.turretBarrel.stroke({ color: 0x4a4a4a, width: 4, alpha: 1 });
    this.turretRoot.addChild(this.turretBarrel);
    this.turretBarrelBaseX = this.turretBarrel.x;

    this.turretEyeL = null;
    this.turretEyeR = null;
    this.turretFaceRoot = null;
    this.turretMouth = null;
  }

  triggerTurretShootAnim() {
    this.turretShootAnim = 0.12;
  }

  clearMissingWaveEntities(existingIds) {
    for (const [id, g] of this.waveEntitySprites.entries()) {
      if (!existingIds.has(id)) {
        g.destroy();
        this.waveEntitySprites.delete(id);
      }
    }
  }

  clearMissingDeathAngles(existingIds) {
    for (const [id, g] of this.deathAngleSprites.entries()) {
      if (!existingIds.has(id)) {
        g.destroy();
        this.deathAngleSprites.delete(id);
      }
    }
  }

  getDeathAngleSprite(id) {
    let g = this.deathAngleSprites.get(id);
    if (!g) {
      g = new PIXI.Graphics();
      g.zIndex = 4;
      this.waveGfx.addChild(g);
      this.deathAngleSprites.set(id, g);
    }
    return g;
  }

  ensureMiniTurrets() {
    if (this.miniTurretsGfx) return;
    this.miniTurretsGfx = new PIXI.Container();
    this.miniTurretsGfx.zIndex = 2;
    this.waveGfx.addChild(this.miniTurretsGfx);
  }

  clearMiniTurrets() {
    if (this.miniTurretsGfx) {
      this.miniTurretsGfx.destroy({ children: true });
      this.miniTurretsGfx = null;
    }
    this.miniTurretSprites.clear();
  }

  getMiniTurretSprite(idx) {
    let g = this.miniTurretSprites.get(idx);
    if (!g) {
      g = new PIXI.Container();
      const body = new PIXI.Graphics();
      body.circle(0, 0, 14);
      body.fill(0x8a8a8a);
      body.stroke({ color: 0x3f3f3f, width: 3, alpha: 1 });
      g.addChild(body);

      const barrel = new PIXI.Graphics();
      barrel.rect(8, -4, 18, 8);
      barrel.fill(0x8a8a8a);
      barrel.stroke({ color: 0x3f3f3f, width: 3, alpha: 1 });
      g.addChild(barrel);
      g._barrel = barrel;

      this.miniTurretsGfx.addChild(g);
      this.miniTurretSprites.set(idx, g);
    }
    return g;
  }

  getWaveEntitySprite(id, r, kind, flags = 0) {
    let g = this.waveEntitySprites.get(id);

    if (g && kind === 3 && !(g instanceof PIXI.Container)) {
      g.destroy();
      this.waveEntitySprites.delete(id);
      g = null;
    }
    if (g && kind !== 3 && !(g instanceof PIXI.Graphics)) {
      g.destroy();
      this.waveEntitySprites.delete(id);
      g = null;
    }

    if (!g) {
      if (kind === 3) {
        const pg = this.buildWavePortalGfx(r);
        pg._kind = kind;
        pg._spin = (Math.random() * 2 - 1) * 0.6;
        pg._pulse = Math.random() * Math.PI * 2;
        pg.zIndex = 1;
        this.waveGfx.addChild(pg);
        this.waveEntitySprites.set(id, pg);
        return pg;
      }

      if (kind === 4) {
        const gg = new PIXI.Graphics();
        gg._kind = kind;
        gg._healthBuff = true;
        const glowSteps = 6;
        for (let i = 0; i < glowSteps; i++) {
          const t = i / (glowSteps - 1);
          const rr = r * (1.75 - t * 0.55);
          const a = 0.08 * (1 - t) * (1 - t);
          gg.circle(0, 0, rr);
          gg.fill({ color: 0x37d05a, alpha: a });
        }
        gg.circle(0, 0, r);
        gg.fill({ color: 0x37d05a, alpha: 0.95 });
        gg.stroke({ color: 0x0d2a14, width: 2, alpha: 1 });

        const plusW = Math.max(6, r * 0.95);
        const plusT = Math.max(3, r * 0.28);
        gg.roundRect(-plusW / 2, -plusT / 2, plusW, plusT, plusT * 0.25);
        gg.fill({ color: 0xffffff, alpha: 0.95 });
        gg.roundRect(-plusT / 2, -plusW / 2, plusT, plusW, plusT * 0.25);
        gg.fill({ color: 0xffffff, alpha: 0.95 });

        gg.blendMode = 'normal';
        gg.zIndex = 2;
        this.waveGfx.addChild(gg);
        this.waveEntitySprites.set(id, gg);
        return gg;
      }

      if (kind === 5) {
        const gg = new PIXI.Graphics();
        gg._kind = kind;
        gg.circle(0, 0, r);
        gg.fill({ color: 0x050505, alpha: 0.98 });
        gg.stroke({ color: 0x2a2a2a, width: 3, alpha: 0.9 });
        gg.zIndex = 1;
        this.waveGfx.addChild(gg);
        this.waveEntitySprites.set(id, gg);
        return gg;
      }

      if (kind === 6) {
        const gg = new PIXI.Graphics();
        gg._kind = kind;
        gg.circle(0, 0, r);
        gg.fill({ color: 0xa05353, alpha: 0.95 });
        gg.stroke({ color: 0x000000, width: 3, alpha: 0.95 });
        gg.zIndex = 1;
        this.waveGfx.addChild(gg);
        this.waveEntitySprites.set(id, gg);
        return gg;
      }

      if (kind === 7) {
        const gg = new PIXI.Graphics();
        gg._kind = kind;
        gg.circle(0, 0, r);
        gg.fill({ color: 0x3b0b0b, alpha: 0.95 });
        gg.stroke({ color: 0x000000, width: 2, alpha: 0.9 });
        gg.zIndex = 2;
        this.waveGfx.addChild(gg);
        this.waveEntitySprites.set(id, gg);
        return gg;
      }

      if (kind === 8) {
        const gg = new PIXI.Graphics();
        gg._kind = kind;
        gg.rect(-r, -r, r * 2, r * 2);
        gg.fill({ color: 0x050505, alpha: 0.98 });
        gg.stroke({ color: 0x000000, width: 2, alpha: 0.95 });
        gg.zIndex = 1;
        this.waveGfx.addChild(gg);
        this.waveEntitySprites.set(id, gg);
        return gg;
      }

      if (kind === 10) {
        const gg = new PIXI.Graphics();
        gg._kind = kind;
        gg.circle(0, 0, r);
        gg.fill({ color: 0x966e14, alpha: 0.95 });
        gg.stroke({ color: 0x000000, width: 2, alpha: 1 });
        gg.zIndex = 1;
        this.waveGfx.addChild(gg);
        this.waveEntitySprites.set(id, gg);
        return gg;
      }

      if (kind === 11) {
        const gg = new PIXI.Graphics();
        gg._kind = kind;

        const auraR = r + 150;
        gg.circle(0, 0, auraR);
        gg.fill({ color: 0xff0000, alpha: 0.3 });

        gg.circle(0, 0, r);
        gg.fill({ color: 0xff0000, alpha: 0.95 });
        gg.stroke({ color: 0x000000, width: 2, alpha: 1 });
        gg.zIndex = 1;
        this.waveGfx.addChild(gg);
        this.waveEntitySprites.set(id, gg);
        return gg;
      }

      if (kind === 12) {
        const gg = new PIXI.Graphics();
        gg._kind = kind;
        gg._flags = flags;
        gg.circle(0, 0, r);
        const armed = (flags & 1) !== 0;
        gg.fill({ color: 0x75eb26, alpha: armed ? 1.0 : 0.18 });
        gg.stroke({ color: 0x000000, width: 2, alpha: 1 });
        gg.zIndex = 1;
        this.waveGfx.addChild(gg);
        this.waveEntitySprites.set(id, gg);
        return gg;
      }

      if (kind === 13) {
        const gg = new PIXI.Graphics();
        gg._kind = kind;

        const auraR = r + 150;
        gg.circle(0, 0, auraR);
        gg.fill({ color: 0x420808, alpha: 0.3 });

        gg.circle(0, 0, r);
        gg.fill({ color: 0x420808, alpha: 0.95 });
        gg.stroke({ color: 0x000000, width: 2, alpha: 1 });
        gg.zIndex = 1;
        this.waveGfx.addChild(gg);
        this.waveEntitySprites.set(id, gg);
        return gg;
      }

      if (kind === 14) {
        const gg = new PIXI.Graphics();
        gg._kind = kind;
        gg.circle(0, 0, r);
        gg.fill({ color: 0x562e75, alpha: 0.95 });
        gg.stroke({ color: 0x000000, width: 2, alpha: 1 });
        gg.zIndex = 1;
        this.waveGfx.addChild(gg);
        this.waveEntitySprites.set(id, gg);
        return gg;
      }

      const gg = new PIXI.Graphics();
      gg._kind = kind;
      gg.circle(0, 0, r);
      gg.fill(kind === 2 ? 0x2b7bff : 0x8c8c8c);
      gg.stroke({ color: 0x000000, width: 2, alpha: 1 });
      gg.zIndex = 1;
      this.waveGfx.addChild(gg);
      this.waveEntitySprites.set(id, gg);
      return gg;
    }

    if (kind === 12 && (g._flags ?? 0) !== flags) {
      g._flags = flags;
      const armed = (flags & 1) !== 0;
      g.clear();
      g.circle(0, 0, r);
      g.fill({ color: 0x75eb26, alpha: armed ? 1.0 : 0.18 });
      g.stroke({ color: 0x000000, width: 2, alpha: 1 });
    }

    if (g instanceof PIXI.Graphics) {
      const needsHealthBuffRedraw = kind === 4 && !g._healthBuff;
      if (typeof g._kind === 'number' && (g._kind !== kind || needsHealthBuffRedraw)) {
        g.clear();
        g._kind = kind;
        if (kind === 4) {
          g._healthBuff = true;
          const glowSteps = 6;
          for (let i = 0; i < glowSteps; i++) {
            const t = i / (glowSteps - 1);
            const rr = r * (1.75 - t * 0.55);
            const a = 0.08 * (1 - t) * (1 - t);
            g.circle(0, 0, rr);
            g.fill({ color: 0x37d05a, alpha: a });
          }
          g.circle(0, 0, r);
          g.fill({ color: 0x37d05a, alpha: 0.95 });
          g.stroke({ color: 0x0d2a14, width: 2, alpha: 1 });

          const plusW = Math.max(6, r * 0.95);
          const plusT = Math.max(3, r * 0.28);
          g.roundRect(-plusW / 2, -plusT / 2, plusW, plusT, plusT * 0.25);
          g.fill({ color: 0xffffff, alpha: 0.95 });
          g.roundRect(-plusT / 2, -plusW / 2, plusT, plusW, plusT * 0.25);
          g.fill({ color: 0xffffff, alpha: 0.95 });

          g.zIndex = 2;
        } else {
          g._healthBuff = false;
          if (kind === 8) {
            g.rect(-r, -r, r * 2, r * 2);
            g.fill({ color: 0x050505, alpha: 0.98 });
            g.stroke({ color: 0x000000, width: 2, alpha: 0.95 });
          } else {
            g.circle(0, 0, r);
            if (kind === 5) {
              g.fill({ color: 0x050505, alpha: 0.98 });
              g.stroke({ color: 0x2a2a2a, width: 3, alpha: 0.9 });
            } else if (kind === 6) {
              g.fill({ color: 0xa05353, alpha: 0.95 });
              g.stroke({ color: 0x000000, width: 3, alpha: 0.95 });
            } else if (kind === 7) {
              g.fill({ color: 0x3b0b0b, alpha: 0.95 });
              g.stroke({ color: 0x000000, width: 2, alpha: 0.9 });
            } else if (kind === 10) {
              g.fill({ color: 0x966e14, alpha: 0.95 });
              g.stroke({ color: 0x000000, width: 2, alpha: 1 });
            } else if (kind === 11) {
              g.fill({ color: 0xff0000, alpha: 0.95 });
              g.stroke({ color: 0x000000, width: 2, alpha: 1 });
            } else if (kind === 12) {
              g.fill({ color: 0x75eb26, alpha: 0.5 });
              g.stroke({ color: 0x000000, width: 2, alpha: 1 });
            } else if (kind === 13) {
              g.fill({ color: 0x420808, alpha: 0.95 });
              g.stroke({ color: 0x000000, width: 2, alpha: 1 });
            } else if (kind === 14) {
              g.fill({ color: 0x562e75, alpha: 0.95 });
              g.stroke({ color: 0x000000, width: 2, alpha: 1 });
            } else {
              g.fill(kind === 2 ? 0x2b7bff : 0x8c8c8c);
              g.stroke({ color: 0x000000, width: 2, alpha: 1 });
            }
          }

          g.zIndex = 1;
        }
      }
    }

    return g;
  }

  getPlayerSprite(id, alive) {
    let g = this.playerSprites.get(id);
    if (!g) {
      g = new PIXI.Graphics();
      g.circle(0, 0, this.PLAYER_RADIUS);
      g.fill(alive ? this.PLAYER_COLOR : this.DEAD_PLAYER_COLOR);
      this.playersGfx.addChild(g);
      this.playerSprites.set(id, g);
      this.playerAliveState.set(id, alive);
      return g;
    }

    const prev = this.playerAliveState.get(id);
    if (prev !== alive) {
      g.clear();
      g.circle(0, 0, this.PLAYER_RADIUS);
      g.fill(alive ? this.PLAYER_COLOR : this.DEAD_PLAYER_COLOR);
      this.playerAliveState.set(id, alive);
    }

    return g;
  }

  clearMissingPlayers(existingIds) {
    for (const [id, g] of this.playerSprites.entries()) {
      if (!existingIds.has(id)) {
        g.destroy();
        this.playerSprites.delete(id);
        this.playerAliveState.delete(id);
      }
    }

    for (const [id, t] of this.playerNameLabels.entries()) {
      if (!existingIds.has(id)) {
        t.destroy();
        this.playerNameLabels.delete(id);
      }
    }

    for (const [id, b] of this.playerHpBars.entries()) {
      if (!existingIds.has(id)) {
        b.destroy();
        this.playerHpBars.delete(id);
        this.playerHpState.delete(id);
      }
    }
  }

  getPlayerNameLabel(id) {
    let t = this.playerNameLabels.get(id);
    if (!t) {
      t = new PIXI.Text({
        text: '',
        style: {
          fontFamily: 'Arial',
          fontSize: 14,
          fill: 0x000000,
        },
      });
      t.anchor.set(0.5, 1);
      this.playerNameGfx.addChild(t);
      this.playerNameLabels.set(id, t);
    }
    return t;
  }

  getPlayerHpBar(id) {
    let g = this.playerHpBars.get(id);
    if (!g) {
      g = new PIXI.Graphics();
      this.playersGfx.addChild(g);
      this.playerHpBars.set(id, g);
    }
    return g;
  }

  updatePlayerHpBar(id, hp, alive, x, y) {
    const bar = this.getPlayerHpBar(id);
    const h = alive ? (typeof hp === 'number' ? hp : this.PLAYER_MAX_HP) : 0;
    const max = this.PLAYER_MAX_HP;
    const t = Math.max(0, Math.min(1, h / max));

    const w = 38;
    const hh = 7;
    const yy = y - this.PLAYER_RADIUS - 2 - hh;

    bar.x = x - w / 2;
    bar.y = yy;
    bar.clear();

    bar.rect(0, 0, w, hh);
    bar.fill({ color: 0x000000, alpha: 0.35 });

    bar.rect(1, 1, (w - 2) * t, hh - 2);
    const fill = 0x22c55e;
    bar.fill({ color: fill, alpha: 1 });

    bar.rect(0, 0, w, hh);
    bar.stroke({ color: 0x000000, width: 2, alpha: 0.85 });

    this.playerHpState.set(id, h);
  }

  renderWave(snap, state) {
    if (snap.room !== ROOM_WAVE) {
      this.waveGfx.removeChildren();
      this.waveEntitySprites.clear();
      this.deathAngleSprites.clear();
      this.turretRoot = null;
      this.turretBody = null;
      this.turretBarrel = null;
      this.turretShootAnim = 0;
      this.turretBarrelBaseX = 0;
      this.turretEyeL = null;
      this.turretEyeR = null;
      this.turretFaceRoot = null;
      this.turretMouth = null;
      this.miniTurretsGfx = null;
      this.miniTurretSprites.clear();
      this.lastWaveEntityIds = null;
      return;
    }

    this.ensureTurret();

    const sp = (typeof snap.waveSubphase === 'number') ? snap.waveSubphase : 2;
    if (this.turretBody) {
      const wantSquare = sp === 3;
      const isSquare = !!this.turretBody._isSquare;
      if (wantSquare !== isSquare) {
        this.turretBody.clear();
        if (wantSquare) {
          this.turretBody.rect(-25, -25, 50, 50);
        } else {
          this.turretBody.circle(0, 0, 25);
        }
        this.turretBody.fill(0x9a9a9a);
        this.turretBody.stroke({ color: 0x4a4a4a, width: 4, alpha: 1 });
        this.turretBody._isSquare = wantSquare;
      }
    }

    this.turretRoot.rotation = snap.turretAngle || 0;
    if (this.turretFaceRoot) this.turretFaceRoot.rotation = -this.turretRoot.rotation;

    const turretAlpha = (typeof snap.turretAlpha === 'number') ? snap.turretAlpha : 1;
    this.turretRoot.alpha = turretAlpha;
    this.turretRoot.visible = true;

    const ids = new Set();
    const r = this.waveEntityRadius(state);
    const wallScale = (state.currentMap && state.currentMap.wave && typeof state.currentMap.wave.wallEnemyRadiusScale === 'number')
      ? state.currentMap.wave.wallEnemyRadiusScale
      : 2;
    const ents = snap.entities || [];
    if (!this.lastWaveEntityIds) this.lastWaveEntityIds = new Set();
    let anyNew = false;
    for (const e of ents) {
      if (!this.lastWaveEntityIds.has(e.id) && e.kind !== 3 && e.kind !== 9) {
        anyNew = true;
      }
      ids.add(e.id);

      if (e.kind === 9) {
        const angle = e.x;
        const age = e.y;

        const dirx = Math.cos(angle);
        const diry = Math.sin(angle);

        const half = (state.currentMap && state.currentMap.walls && typeof state.currentMap.walls.halfSize === 'number')
          ? state.currentMap.walls.halfSize
          : 200;
        const len = half / Math.max(1e-6, Math.max(Math.abs(dirx), Math.abs(diry)));

        const sx = dirx * this.TURRET_BARREL_TIP_OFFSET;
        const sy = diry * this.TURRET_BARREL_TIP_OFFSET;
        const ex = dirx * len;
        const ey = diry * len;

        const t = Math.max(0, Math.min(1, age / 1.5));
        const orange = 0xff9a1f;
        const red = 0xff2222;
        const col = this.mixColor(orange, red, t);
        const alpha = 0.20 + 0.55 * t;
        const w = 10 - 4 * t;

        const g = this.getDeathAngleSprite(e.id);
        g.clear();
        g.moveTo(sx, sy);
        g.lineTo(ex, ey);
        g.stroke({ color: col, width: w, alpha });
        continue;
      }

      const rr = e.kind === 3
        ? this.TRANSITION_PORTAL_RADIUS
        : (typeof e.r === 'number'
          ? e.r
          : (e.kind === 5 ? r * wallScale : (e.kind === 7 ? r * 0.5 : r)));
      const g = this.getWaveEntitySprite(e.id, rr, e.kind, e.flags ?? 0);
      g.x = e.x;
      g.y = e.y;
    }
    this.lastWaveEntityIds = ids;
    if (anyNew) this.triggerTurretShootAnim();
    this.clearMissingWaveEntities(ids);
    this.clearMissingDeathAngles(ids);

    const wavePhase = (typeof snap.wavePhase === 'number') ? snap.wavePhase : 0;
    if (wavePhase > 0) {
      this.ensureMiniTurrets();
      const half = (state.currentMap && state.currentMap.walls && typeof state.currentMap.walls.halfSize === 'number')
        ? state.currentMap.walls.halfSize
        : 200;
      const inset = 22;
      const b = half - inset;
      const corners = [
        [-b, -b],
        [b, -b],
        [b, b],
        [-b, b],
      ];
      for (let i = 0; i < 4; i++) {
        const mt = this.getMiniTurretSprite(i);
        mt.x = corners[i][0];
        mt.y = corners[i][1];
        const angle = i * (Math.PI / 2);
        mt.rotation = angle;
      }
      this.miniTurretsGfx.visible = true;
    } else {
      if (this.miniTurretsGfx) this.miniTurretsGfx.visible = false;
    }
  }

  renderArenaFill(state) {
    this.arenaFillGfx.removeChildren();
    if (!state.currentMap || !state.currentMap.walls) return;

    const w = state.currentMap.walls;
    const g = new PIXI.Graphics();

    if (w.kind === 'polygon') {
      g.moveTo(w.points[0][0], w.points[0][1]);
      for (let i = 1; i < w.points.length; i++) g.lineTo(w.points[i][0], w.points[i][1]);
      g.closePath();
      g.fill(this.ARENA_FILL_COLOR);
      this.arenaFillGfx.addChild(g);
      return;
    }

    if (w.kind === 'box') {
      const half = w.halfSize;
      g.rect(-half, -half, half * 2, half * 2);
      g.fill(this.ARENA_FILL_COLOR);
      this.arenaFillGfx.addChild(g);
    }
  }

  getGridSize(state) {
    return (state.currentMap && state.currentMap.grid && state.currentMap.grid.size) ? state.currentMap.grid.size : this.DEFAULT_GRID_SIZE;
  }

  portalsFromMap(state) {
    if (!state.currentMap || !state.currentMap.portals) return [];
    return state.currentMap.portals.map((p) => ({
      id: p.id,
      x: p.rect[0],
      y: p.rect[1],
      w: p.rect[2],
      h: p.rect[3],
      tint: p.tint,
      targetRoom: p.targetRoom,
    }));
  }

  strokeGrid(g) {
    g.stroke({ color: this.GRID_COLOR, width: 2, alpha: 0.65 });
  }

  addIfMissing(arr, v) {
    for (const x of arr) {
      if (Math.abs(x - v) < 1e-6) return;
    }
    arr.push(v);
  }

  buildBoxGridGraphics(state, halfSize) {
    const g = new PIXI.Graphics();
    const min = -halfSize;
    const max = halfSize;
    const gridSize = this.getGridSize(state);

    const xs = [];
    const ys = [];

    const xStart = Math.ceil(min / gridSize) * gridSize;
    const xEnd = Math.floor(max / gridSize) * gridSize;
    const yStart = Math.ceil(min / gridSize) * gridSize;
    const yEnd = Math.floor(max / gridSize) * gridSize;

    for (let x = xStart; x <= xEnd; x += gridSize) xs.push(x);
    for (let y = yStart; y <= yEnd; y += gridSize) ys.push(y);

    this.addIfMissing(xs, min);
    this.addIfMissing(xs, max);
    this.addIfMissing(ys, min);
    this.addIfMissing(ys, max);

    xs.sort((a, b) => a - b);
    ys.sort((a, b) => a - b);

    for (const x of xs) {
      g.moveTo(x, min);
      g.lineTo(x, max);
    }
    for (const y of ys) {
      g.moveTo(min, y);
      g.lineTo(max, y);
    }

    this.strokeGrid(g);
    return g;
  }

  lineSquareIntersections(kind, c, halfSize) {
    const h = halfSize;
    const pts = [];
    const push = (x, y) => {
      if (x >= -h - 1e-6 && x <= h + 1e-6 && y >= -h - 1e-6 && y <= h + 1e-6) {
        for (const p of pts) {
          if (Math.abs(p[0] - x) < 1e-6 && Math.abs(p[1] - y) < 1e-6) return;
        }
        pts.push([x, y]);
      }
    };

    if (kind === 'sum') {
      push(-h, c + h);
      push(h, c - h);
      push(c + h, -h);
      push(c - h, h);
    } else {
      push(-h, -h - c);
      push(h, h - c);
      push(c - h, -h);
      push(c + h, h);
    }

    if (pts.length >= 2) return [pts[0], pts[1]];
    return null;
  }

  buildDiamondGridGraphics(state, halfSize) {
    const g = new PIXI.Graphics();
    const desired = this.getGridSize(state);
    const b = halfSize;

    const n = Math.max(1, Math.round((2 * b) / desired));
    const step = (2 * b) / n;

    const values = [];
    for (let i = 0; i <= n; i++) values.push(-b + i * step);

    for (const u of values) {
      const v0 = -b;
      const v1 = b;
      const x0 = (u + v0) / 2;
      const y0 = (u - v0) / 2;
      const x1 = (u + v1) / 2;
      const y1 = (u - v1) / 2;
      g.moveTo(x0, y0);
      g.lineTo(x1, y1);
    }

    for (const v of values) {
      const u0 = -b;
      const u1 = b;
      const x0 = (u0 + v) / 2;
      const y0 = (u0 - v) / 2;
      const x1 = (u1 + v) / 2;
      const y1 = (u1 - v) / 2;
      g.moveTo(x0, y0);
      g.lineTo(x1, y1);
    }

    this.strokeGrid(g);
    return g;
  }

  buildGridGraphics(state, boundsHalfSize) {
    const g = new PIXI.Graphics();
    const min = -boundsHalfSize;
    const max = boundsHalfSize;
    const gridSize = this.getGridSize(state);

    const xStart = Math.ceil(min / gridSize) * gridSize;
    const xEnd = Math.floor(max / gridSize) * gridSize;
    const yStart = Math.ceil(min / gridSize) * gridSize;
    const yEnd = Math.floor(max / gridSize) * gridSize;

    for (let x = xStart; x <= xEnd; x += gridSize) {
      g.moveTo(x, min);
      g.lineTo(x, max);
    }
    for (let y = yStart; y <= yEnd; y += gridSize) {
      g.moveTo(min, y);
      g.lineTo(max, y);
    }
    this.strokeGrid(g);

    return g;
  }

  renderGrid(state) {
    this.gridGfx.removeChildren();

    if (this.lobbyGhostMask) {
      this.lobbyGhostMask.destroy();
      this.lobbyGhostMask = null;
    }
    this.lobbyGhostGfx.mask = null;

    if (!state.currentMap || !state.currentMap.walls) return;

    const walls = state.currentMap.walls;

    if (walls.kind === 'polygon') {
      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;
      for (const pt of walls.points) {
        minX = Math.min(minX, pt[0]);
        minY = Math.min(minY, pt[1]);
        maxX = Math.max(maxX, pt[0]);
        maxY = Math.max(maxY, pt[1]);
      }
      const bounds = Math.max(Math.abs(minX), Math.abs(minY), Math.abs(maxX), Math.abs(maxY));
      const isDiamond = Array.isArray(walls.points) && walls.points.length === 4
        && Math.abs(walls.points[0][0]) < 1e-6
        && Math.abs(walls.points[1][1]) < 1e-6
        && Math.abs(walls.points[2][0]) < 1e-6
        && Math.abs(walls.points[3][1]) < 1e-6;

      let diamondB = bounds;
      if (isDiamond) {
        diamondB = 0;
        for (const pt of walls.points) diamondB = Math.max(diamondB, Math.abs(pt[0]) + Math.abs(pt[1]));
      }

      const grid = isDiamond ? this.buildDiamondGridGraphics(state, diamondB) : this.buildGridGraphics(state, bounds);

      const mask = new PIXI.Graphics();
      mask.moveTo(walls.points[0][0], walls.points[0][1]);
      for (let i = 1; i < walls.points.length; i++) mask.lineTo(walls.points[i][0], walls.points[i][1]);
      mask.closePath();
      mask.fill({ color: 0xffffff, alpha: 0 });
      mask.stroke({ color: 0xffffff, width: 4, alpha: 0 });

      grid.mask = mask;
      this.gridGfx.addChild(grid);
      this.gridGfx.addChild(mask);

      if (state.currentRoom === ROOM_LOBBY) {
        this.lobbyGhostMask = new PIXI.Graphics();
        this.lobbyGhostMask.moveTo(walls.points[0][0], walls.points[0][1]);
        for (let i = 1; i < walls.points.length; i++) this.lobbyGhostMask.lineTo(walls.points[i][0], walls.points[i][1]);
        this.lobbyGhostMask.closePath();
        this.lobbyGhostMask.fill({ color: 0xffffff, alpha: 0 });
        this.lobbyGhostGfx.mask = this.lobbyGhostMask;
        this.lobbyGhostGfx.addChild(this.lobbyGhostMask);
      }
      return;
    }

    if (walls.kind === 'box') {
      const half = walls.halfSize;
      const grid = this.buildBoxGridGraphics(state, half);

      const mask = new PIXI.Graphics();
      const pad = 10;
      mask.rect(-half - pad, -half - pad, (half + pad) * 2, (half + pad) * 2);
      mask.fill({ color: 0xffffff, alpha: 0 });

      grid.mask = mask;
      this.gridGfx.addChild(grid);
      this.gridGfx.addChild(mask);

      if (state.currentRoom === ROOM_LOBBY) {
        this.lobbyGhostMask = new PIXI.Graphics();
        this.lobbyGhostMask.rect(-half, -half, half * 2, half * 2);
        this.lobbyGhostMask.fill({ color: 0xffffff, alpha: 0 });
        this.lobbyGhostGfx.mask = this.lobbyGhostMask;
        this.lobbyGhostGfx.addChild(this.lobbyGhostMask);
      }
    }
  }

  circleRectOverlap(cx, cy, r, rect) {
    const closestX = Math.max(rect.x, Math.min(cx, rect.x + rect.w));
    const closestY = Math.max(rect.y, Math.min(cy, rect.y + rect.h));
    const dx = cx - closestX;
    const dy = cy - closestY;
    return dx * dx + dy * dy <= r * r;
  }

  ensureLobbyGhosts(boundsHalfSize) {
    if (this.lobbyGhostRoot) return;
    this.lobbyGhostRoot = new PIXI.Container();
    this.lobbyGhostRoot.zIndex = 0;
    this.lobbyGhostGfx.addChild(this.lobbyGhostRoot);

    this.lobbyGhosts = [];
    const count = 18;

    const b = (typeof boundsHalfSize === 'number' && boundsHalfSize > 0) ? boundsHalfSize : 200;
    const sepPad = 6;
    const placed = [];

    for (let i = 0; i < count; i++) {
      const gg = new PIXI.Graphics();
      const r = Math.random() < 0.22 ? (20 + Math.random() * 6) : (12 + Math.random() * 6);
      gg._r = r;

      gg.circle(0, 0, r);
      gg.fill({ color: 0xffffff, alpha: 0.45 });
      gg.stroke({ color: 0x000000, width: Math.max(2, Math.round(r * 0.18)), alpha: 0.32 });

      const ex = r * 0.28;
      const ey = r * -0.22;
      const er = Math.max(1.8, r * 0.16);
      gg.circle(-ex, ey, er);
      gg.fill({ color: 0x000000, alpha: 0.22 });
      gg.circle(ex, ey, er);
      gg.fill({ color: 0x000000, alpha: 0.22 });
      gg.blendMode = 'normal';

      const v = 45 + Math.random() * 70;
      const a = Math.random() * Math.PI * 2;

      const wallBuf = 2;
      const limit = Math.max(30, b - (r + wallBuf + 8));
      let x = 0;
      let y = 0;
      let ok = false;
      for (let tries = 0; tries < 90; tries++) {
        const rx = (Math.random() * 2 - 1) * limit;
        const ry = (Math.random() * 2 - 1) * limit;
        if (Math.abs(rx) + Math.abs(ry) > limit) continue;

        let good = true;
        for (const p of placed) {
          const dx = rx - p.x;
          const dy = ry - p.y;
          const rr = (r + p.r + sepPad);
          if (dx * dx + dy * dy < rr * rr) {
            good = false;
            break;
          }
        }
        if (!good) continue;

        x = rx;
        y = ry;
        ok = true;
        break;
      }

      if (!ok) {
        x = (Math.random() * 2 - 1) * (limit * 0.35);
        y = (Math.random() * 2 - 1) * (limit * 0.35);
      }
      placed.push({ x, y, r });

      gg.x = x;
      gg.y = y;
      gg._vx = Math.cos(a) * v;
      gg._vy = Math.sin(a) * v;
      gg._ph = Math.random() * Math.PI * 2;

      this.lobbyGhostRoot.addChild(gg);
      this.lobbyGhosts.push(gg);
    }
  }

  clearLobbyGhosts() {
    if (!this.lobbyGhostRoot) return;
    this.lobbyGhostRoot.destroy({ children: true });
    this.lobbyGhostRoot = null;
    this.lobbyGhosts = [];
    this.lobbyGhostGfx.removeChildren();
  }

  renderPortals(state) {
    if (state.currentRoom !== ROOM_LOBBY) {
      this.portalsGfx.removeChildren();
      for (const [id, node] of this.lobbyPortalNodes.entries()) {
        node.pg.destroy();
        if (node.label) node.label.destroy();
        this.lobbyPortalNodes.delete(id);
        this.lobbyPortalSprites.delete(id);
      }
      return;
    }

    const existing = new Set();

    for (const portal of this.portalsFromMap(state)) {
      existing.add(portal.id);
      const cx = portal.x + portal.w / 2;
      const cy = portal.y + portal.h / 2;
      const r = Math.max(18, Math.min(portal.w, portal.h) * 0.48);

      let node = this.lobbyPortalNodes.get(portal.id);
      if (!node) {
        const pg = this.buildLobbyPortalGfx(r, portal.tint);
        pg._spin = (portal.id % 2 === 0 ? 1 : -1) * (0.55 + (portal.id % 3) * 0.08);
        pg._pulse = Math.random() * Math.PI * 2;
        this.portalsGfx.addChild(pg);
        this.lobbyPortalSprites.set(portal.id, pg);

        let label = null;
        /*
        if (portal.id === 0) {
          label = new PIXI.Text({
            text: 'WAVE',
            style: {
              fontFamily: 'Arial',
              fontSize: 16,
              fontWeight: '700',
              fill: 0xffffff,
              stroke: 0x111111,
              strokeThickness: 3,
            },
          });
          label.anchor.set(0.5, 0.5);
          label.zIndex = 100;
          portalsGfx.addChild(label);
        }
        */

        node = { pg, label, tint: portal.tint };
        this.lobbyPortalNodes.set(portal.id, node);
      }

      node.pg.x = cx;
      node.pg.y = cy;

      if (node.label) {
        node.label.x = cx;
        node.label.y = cy - r - 10;
      }
    }

    for (const [id, node] of this.lobbyPortalNodes.entries()) {
      if (!existing.has(id)) {
        node.pg.destroy();
        if (node.label) node.label.destroy();
        this.lobbyPortalNodes.delete(id);
        this.lobbyPortalSprites.delete(id);
      }
    }
  }

  renderWalls() {
    this.wallsGfx.removeChildren();
    return;
  }

  renderArenaDecor(state) {
    this.renderArenaFill(state);
    this.renderGrid(state);
    this.renderWalls();
    this.renderPortals(state);
  }

  updateCamera(state) {
    const p = state.localPlayerPos();
    this.world.x = this.app.screen.width / 2 - p.x * this.CAMERA_ZOOM;
    this.world.y = this.app.screen.height / 2 - p.y * this.CAMERA_ZOOM;
  }

  renderSnapshot(snap, state) {
    const ids = new Set();
    for (const p of snap.players) {
      ids.add(p.id);
      const g = this.getPlayerSprite(p.id, p.alive !== false);
      if (state && p.id === state.yourId && state.hasPlayed && state.pred && p.alive !== false) {
        g.x = (state.pred.fx || 0) / 1000;
        g.y = (state.pred.fy || 0) / 1000;
      } else {
        g.x = p.x;
        g.y = p.y;
      }

      const nameLabel = this.getPlayerNameLabel(p.id);
      const nm = (typeof p.name === 'string' && p.name.length > 0) ? p.name : '';
      if (nm) {
        nameLabel.text = nm;
        nameLabel.visible = true;
        nameLabel.x = g.x;
        nameLabel.y = g.y - this.PLAYER_RADIUS - 2 - 6 - 2;
      } else {
        nameLabel.visible = false;
      }

      this.updatePlayerHpBar(p.id, p.hp, p.alive !== false, g.x, g.y);
    }
    this.clearMissingPlayers(ids);
    this.renderWave(snap, state);
    this.updateCamera(state);
  }

  fmtTimeSeconds(sec) {
    const s = Math.max(0, Math.ceil(sec || 0));
    const m = Math.floor(s / 60);
    const r = s - m * 60;
    return `${m}:${String(r).padStart(2, '0')}`;
  }

  layoutWaveHud() {
    const cx = this.app.screen.width / 2;
    const top = 6;

    this.waveBannerLabel.x = cx;
    this.waveBannerLabel.y = top;

    const barY = top + 44;
    const barW = Math.min(520, Math.max(240, Math.floor(this.app.screen.width * 0.42)));
    const barH = 12;

    this.waveBarGfx._w = barW;
    this.waveBarGfx._h = barH;
    this.waveBarGfx._x0 = Math.floor(cx - barW / 2);
    this.waveBarGfx._y0 = barY;

    this.waveTimeLabel.visible = false;
  }

  renderWaveHud(waveNum, waveSubphase, timeRemaining, timeTotal) {
    this.waveHud.visible = this._currentRoom === ROOM_WAVE;
    if (!this.waveHud.visible) return;

    const wn = Math.max(1, waveNum || 1);
    const sp = (typeof waveSubphase === 'number') ? waveSubphase : 2;
    if (wn === 1) {
      if (sp <= 1) {
        this.waveBannerLabel.text = 'WAVE 1: FIRST PHASE';
      } else if (sp === 2) {
        this.waveBannerLabel.text = 'WAVE 1: SECOND PHASE';
      } else {
        this.waveBannerLabel.text = 'WAVE 1: FINAL PHASE';
      }
    } else {
      this.waveBannerLabel.text = `WAVE ${wn}: FINAL PHASE`;
    }
    this.waveTimeLabel.visible = false;

    const barW = this.waveBarGfx._w || 360;
    const barH = this.waveBarGfx._h || 12;
    const x0 = this.waveBarGfx._x0 || (this.app.screen.width / 2 - barW / 2);
    const y0 = this.waveBarGfx._y0 || 52;

    const total = Math.max(0, timeTotal || 0);
    const rem = Math.max(0, timeRemaining || 0);
    const t = (total > 0.001) ? Math.max(0, Math.min(1, rem / total)) : 0;

    this.waveBarGfx.clear();

    this.waveBarGfx.rect(x0, y0, barW, barH);
    this.waveBarGfx.fill({ color: 0x000000, alpha: 0.35 });

    const fillW = Math.max(0, Math.floor((barW - 4) * t));
    this.waveBarGfx.rect(x0 + 2, y0 + 2, fillW, barH - 4);
    this.waveBarGfx.fill({ color: 0x8b5cf6, alpha: 0.95 });

    this.waveBarGfx.rect(x0, y0, barW, barH);
    this.waveBarGfx.stroke({ color: 0x000000, width: 3, alpha: 0.85 });
  }

  renderCountdown(currentRoom, countdownRemaining) {
    this._currentRoom = currentRoom;
    if (currentRoom === ROOM_WAVE && (countdownRemaining || 0) > 0.001) {
      const rem = countdownRemaining;
      const n = Math.ceil(rem);
      this.countdownLabel.text = `Wave starting in: ${n}`;
      this.countdownLabel.visible = true;

      const frac = rem - Math.floor(rem);
      const a = 0.15 + 0.85 * frac;
      const s = 0.9 + 0.25 * frac;
      this.countdownLabel.alpha = a;
      this.countdownLabel.scale.set(s, s);
    } else {
      this.countdownLabel.visible = false;
    }
  }
}
