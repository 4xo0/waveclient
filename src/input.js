import {
  decodeServerMessage,
  encodeEnterPortal,
  encodeInput,
  encodePartyInvite,
  encodePartyInviteResponse,
  encodeSetName,
  ROOM_LOBBY,
  ROOM_WAVE,
} from './protocol.js';

export class InputController {
  constructor(state, renderer, opts) {
    this.state = state;
    this.renderer = renderer;

    this.playOverlay = opts?.playOverlay ?? null;
    this.usernameInput = opts?.usernameInput ?? null;
    this.playBtn = opts?.playBtn ?? null;

    this._intervalId = null;

    this.contextMenu = document.getElementById('contextMenu');
    this.contextAddToParty = document.getElementById('contextAddToParty');
    this._contextTargetId = null;

    this.leaderboardList = document.getElementById('leaderboardList');

    this.partyInvitePanel = document.getElementById('partyInvitePanel');
    this.partyInviteTitle = document.getElementById('partyInviteTitle');
    this.partyInviteAccept = document.getElementById('partyInviteAccept');
    this.partyInviteDecline = document.getElementById('partyInviteDecline');

    this._pendingInviteFromId = null;
    this._pendingInviteFromName = '';
    this._partyId = 0;
    this._partyLeaderId = 0;
    this._partyMembers = [];

    this._onKeyDown = (e) => {
      if (e.code === 'KeyW') this.state.input.up = true;
      if (e.code === 'KeyS') this.state.input.down = true;
      if (e.code === 'KeyA') this.state.input.left = true;
      if (e.code === 'KeyD') this.state.input.right = true;
    };

    this._onKeyUp = (e) => {
      if (e.code === 'KeyW') this.state.input.up = false;
      if (e.code === 'KeyS') this.state.input.down = false;
      if (e.code === 'KeyA') this.state.input.left = false;
      if (e.code === 'KeyD') this.state.input.right = false;
    };

    this._onPointerDown = (e) => {

      if (e.button === 2) return;

      this.hideContextMenu();

      this.state.input.mouseActive = !this.state.input.mouseActive;
      if (this.state.input.mouseActive) {
        this.updateMouseVector(e);
      } else {
        this.state.input.mouseDx = 0;
        this.state.input.mouseDy = 0;
      }
    };

    this._onContextMenu = (e) => {
      e.preventDefault();

      if (this.state.currentRoom !== ROOM_LOBBY) {
        this.hideContextMenu();
        return;
      }
      if (!this.state.lastSnapshot || this.state.yourId == null) {
        this.hideContextMenu();
        return;
      }

      const canvas = this.renderer?.app?.canvas;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const screenX = e.clientX - rect.left;
      const screenY = e.clientY - rect.top;

      const worldX = (screenX - this.renderer.world.x) / this.renderer.CAMERA_ZOOM;
      const worldY = (screenY - this.renderer.world.y) / this.renderer.CAMERA_ZOOM;

      const r = this.renderer.PLAYER_RADIUS;
      const r2 = r * r;

      let best = null;
      for (const p of this.state.lastSnapshot.players) {
        if (p.id === this.state.yourId) continue;
        const dx = worldX - p.x;
        const dy = worldY - p.y;
        const d2 = dx * dx + dy * dy;
        if (d2 <= r2) {
          if (!best || d2 < best.d2) best = { id: p.id, d2 };
        }
      }

      if (!best) {
        this.hideContextMenu();
        return;
      }

      this._contextTargetId = best.id;
      this.showContextMenu(e.clientX, e.clientY);
    };

    this._onContextAddToParty = () => {
      const ws = this.state.ws;
      if (!ws || ws.readyState !== WebSocket.OPEN) return;
      if (this._contextTargetId == null) return;

      ws.send(encodePartyInvite(this._contextTargetId));
      this.hideContextMenu();
    };

    this._onInviteAccept = () => {
      const ws = this.state.ws;
      if (!ws || ws.readyState !== WebSocket.OPEN) return;
      if (this._pendingInviteFromId == null) return;
      if (this.state.currentRoom !== ROOM_LOBBY) return;
      ws.send(encodePartyInviteResponse(this._pendingInviteFromId, true));
      this.hidePartyInvite();
    };

    this._onInviteDecline = () => {
      const ws = this.state.ws;
      if (!ws || ws.readyState !== WebSocket.OPEN) return;
      if (this._pendingInviteFromId == null) return;
      ws.send(encodePartyInviteResponse(this._pendingInviteFromId, false));
      this.hidePartyInvite();
    };

    this._onGlobalPointerDown = (e) => {
      if (!this.contextMenu) return;
      if (this.contextMenu.style.display !== 'block') return;
      if (e.target && this.contextMenu.contains(e.target)) return;
      this.hideContextMenu();
    };

    this._onGlobalKeyDown = (e) => {
      if (e.key === 'Escape') this.hideContextMenu();
    };

    this._onPointerMove = (e) => {
      if (!this.state.input.mouseActive) return;
      this.updateMouseVector(e);
    };

    this._onPlay = () => {
      this.commitUsername();
      this.state.hasPlayed = true;
      if (this.state.ws && this.state.ws.readyState === WebSocket.OPEN) {
        this.state.ws.send(encodeSetName(this.state.localUsername));
      }
      this.hidePlayOverlay();
    };

    this._onUsernameKeyDown = (e) => {
      if (e.key === 'Enter') this._onPlay();
    };
  }

  attach() {
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
    window.addEventListener('pointerdown', this._onGlobalPointerDown);
    window.addEventListener('keydown', this._onGlobalKeyDown);

    const canvas = this.renderer?.app?.canvas;
    if (canvas) {
      canvas.addEventListener('pointerdown', this._onPointerDown);
      canvas.addEventListener('pointermove', this._onPointerMove);
      canvas.addEventListener('contextmenu', this._onContextMenu);
    }

    if (this.playBtn) this.playBtn.addEventListener('click', this._onPlay);
    if (this.usernameInput) this.usernameInput.addEventListener('keydown', this._onUsernameKeyDown);

    if (this.contextAddToParty) this.contextAddToParty.addEventListener('click', this._onContextAddToParty);
    if (this.partyInviteAccept) this.partyInviteAccept.addEventListener('click', this._onInviteAccept);
    if (this.partyInviteDecline) this.partyInviteDecline.addEventListener('click', this._onInviteDecline);
  }

  showContextMenu(pageX, pageY) {
    if (!this.contextMenu) return;
    this.contextMenu.style.left = `${pageX}px`;
    this.contextMenu.style.top = `${pageY}px`;
    this.contextMenu.style.display = 'block';
  }

  hideContextMenu() {
    if (!this.contextMenu) return;
    this.contextMenu.style.display = 'none';
    this._contextTargetId = null;
  }

  showPartyInvite(fromId, fromName) {
    this._pendingInviteFromId = fromId;
    this._pendingInviteFromName = fromName || '';
    if (!this.partyInvitePanel || !this.partyInviteTitle) return;
    this.partyInviteTitle.textContent = `${this._pendingInviteFromName || 'Player'} (${fromId}) invited you to a party`;
    this.partyInvitePanel.style.display = 'block';
  }

  hidePartyInvite() {
    if (this.partyInvitePanel) this.partyInvitePanel.style.display = 'none';
    this._pendingInviteFromId = null;
    this._pendingInviteFromName = '';
  }

  renderLeaderboard(entries) {
    if (!this.leaderboardList) return;
    if (!Array.isArray(entries)) {
      this.leaderboardList.textContent = '';
      return;
    }

    const safeName = (e) => {
      const raw = (e && typeof e.name === 'string') ? e.name.trim() : '';
      return raw.length > 0 ? raw : `Player${(e && typeof e.id === 'number') ? e.id : ''}`;
    };

    const roomLabel = (room, waveNumber) => {
      if (room === ROOM_WAVE) {
        const wn = (typeof waveNumber === 'number' && waveNumber >= 1) ? waveNumber : 1;
        return `Wave ${wn}`;
      }
      return 'Lobby';
    };

    const byParty = new Map();
    const solos = [];
    for (const e of entries) {
      const pid = (typeof e.partyId === 'number') ? e.partyId : 0;
      if (!pid) {
        solos.push(e);
        continue;
      }
      if (!byParty.has(pid)) byParty.set(pid, []);
      byParty.get(pid).push(e);
    }

    const lines = [];

    solos.sort((a, b) => safeName(a).localeCompare(safeName(b)));
    for (const e of solos) {
      lines.push(`${roomLabel(e.room, e.waveNumber)} ❙ ${safeName(e)} ❙ No Party`);
    }

    const partyIds = Array.from(byParty.keys()).sort((a, b) => a - b);
    for (const pid of partyIds) {
      const members = byParty.get(pid) || [];
      members.sort((a, b) => safeName(a).localeCompare(safeName(b)));

      let labelRoom = 'Lobby';
      let waveNum = 1;
      for (const m of members) {
        if (m.room === ROOM_WAVE) {
          labelRoom = 'Wave';
          waveNum = (typeof m.waveNumber === 'number' && m.waveNumber >= 1) ? m.waveNumber : 1;
          break;
        }
      }
      const left = (labelRoom === 'Wave') ? `Wave ${waveNum}` : 'Lobby';
      const names = members.map((m) => safeName(m)).join(' & ');
      lines.push(`${left} ❙ ${names} ❙ Party`);
    }

    this.leaderboardList.textContent = lines.join('\n');
  }

  startTickLoop() {
    if (this._intervalId) return;
    this._intervalId = setInterval(() => {
      this.sendInput();
      this.tryEnterPortals();
    }, 1000 / 144);
  }

  connect() {
    this.state.ws = new WebSocket('wss://64.176.65.212:4443');
    this.state.ws.binaryType = 'arraybuffer';

    this.state.ws.onopen = () => {
      // hello? fuck you hello
      if (this.state.hasPlayed && this.state.localUsername) {
        this.state.ws.send(encodeSetName(this.state.localUsername));
      }
    };

    this.state.ws.onmessage = async (ev) => {
      try {
        const msg = decodeServerMessage(ev.data);

        if (msg.type === 'welcome') {
          this.state.yourId = msg.yourId;
          return;
        }

        if (msg.type === 'waveDef') {
          if (typeof msg.waveNumber === 'number') {
            this.state.currentWaveDef = msg;
            const vm = this.state.waveVirtualMap();
            if (vm) {
              this.state.currentMap = vm;
              this.renderer.setMap(this.state.currentMap, ROOM_WAVE);
            }
          }
          return;
        }

        if (msg.type === 'leaderboard') {
          this.renderLeaderboard(msg.entries);
          return;
        }

        if (msg.type === 'partyInvite') {
          if (this.state.currentRoom === ROOM_LOBBY) {
            this.showPartyInvite(msg.fromId, msg.fromName);
          }
          return;
        }

        if (msg.type === 'partyUpdate') {
          this._partyId = msg.partyId >>> 0;
          this._partyLeaderId = msg.leaderId >>> 0;
          this._partyMembers = Array.isArray(msg.members) ? msg.members.slice() : [];
          return;
        }

        if (msg.type !== 'snapshot') {
          return;
        }

        const prevEntIds = new Set(
          (this.state.lastSnapshot && Array.isArray(this.state.lastSnapshot.entities))
            ? this.state.lastSnapshot.entities.map((e) => e.id)
            : [],
        );

        this.state.currentRoom = msg.room;
        this.state.lastSnapshot = msg;
        if (this.state.hasPlayed && this.state.yourId != null) {
          const me = msg.players.find((pp) => pp.id === this.state.yourId);
          if (me && this.state.pred && this.state.pred.ackSeq === 0) {
            this.state.setPredFromServerPlayer(me);
          }
          this.state.reconcileWithSnapshot(msg);
        }
        this.renderer.setRoom(this.state.currentRoom);

        if (this.state.currentRoom === ROOM_LOBBY && !this.state.hasPlayed) {
          this.showPlayOverlay();
        } else {
          this.hidePlayOverlay();
        }

        if (this.state.currentRoom === ROOM_WAVE && typeof msg.waveNumber === 'number' && msg.waveNumber >= 1) {
          this.state.currentWaveNumber = msg.waveNumber;
        } else {
          this.state.currentWaveNumber = 1;
        }

        this.renderer.renderWaveHud(
          this.state.currentWaveNumber,
          (typeof msg.waveSubphase === 'number') ? msg.waveSubphase : 2,
          (typeof msg.waveTimeRemaining === 'number') ? msg.waveTimeRemaining : 0,
          (typeof msg.waveTimeTotal === 'number') ? msg.waveTimeTotal : 0,
        );

        this.renderer.renderCountdown(
          this.state.currentRoom,
          (typeof msg.countdownRemaining === 'number') ? msg.countdownRemaining : 0,
        );

        const desiredMapId = this.state.currentRoom === ROOM_WAVE ? `wave${this.state.currentWaveNumber}` : 'lobby';
        if (this.state.currentRoom === ROOM_WAVE) {
          if (this.state.currentWaveDef) {
            const vm = this.state.waveVirtualMap();
            if (vm && (!this.state.currentMap || this.state.currentMap.id !== desiredMapId)) {
              this.state.currentMap = vm;
              this.renderer.setMap(this.state.currentMap, ROOM_WAVE);
            }
          }
        } else {
          if (!this.state.currentMap || this.state.currentMap.id !== desiredMapId) {
            this.state.currentMap = await this.state.loadMapByRoom(this.state.currentRoom, this.state.currentWaveNumber);
            this.renderer.setMap(this.state.currentMap, this.state.currentRoom);
          }
        }

        if (this.state.currentRoom === ROOM_WAVE && Array.isArray(msg.entities)) {
          for (const e of msg.entities) {
            if (!prevEntIds.has(e.id) && e.kind !== 3 && e.kind !== 9) {
              this.renderer.triggerTurretShootAnim();
              break;
            }
          }
        }

        this.renderer.renderSnapshot(msg, this.state);
        this.renderer.renderArenaDecor(this.state);
      } catch (e) {
        console.error('ws onmessage error', e);
      }
    };

    this.state.ws.onclose = () => {
      this.state.yourId = null;
      this.state.lastSnapshot = null;
    };
  }

  sendInput() {
    const ws = this.state.ws;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    if (!this.state.hasPlayed) return;

    const seq = this.state.inputSeq++;
    const wasd = this.state.wasdBits();
    const mouseActive = this.state.input.mouseActive;
    const mdx = (this.state.input.mouseDx | 0);
    const mdy = (this.state.input.mouseDy | 0);

    const predInput = {
      up: (wasd & 0b0001) !== 0,
      down: (wasd & 0b0010) !== 0,
      left: (wasd & 0b0100) !== 0,
      right: (wasd & 0b1000) !== 0,
      mouseActive,
      mouseDx: mdx,
      mouseDy: mdy,
    };

    this.state.pendingInputs.push({ seq, input: predInput, slowMul: this.state.pred.slowMul });
    this.state.applyInputToPred(predInput);

    const buf = encodeInput(
      seq,
      wasd,
      mouseActive,
      mdx,
      mdy,
    );
    ws.send(buf);
  }

  tryEnterPortals() {
    const ws = this.state.ws;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    if (!this.state.hasPlayed) return;
    if (this.state.currentRoom !== ROOM_LOBBY) return;
    if (!this.state.lastSnapshot || this.state.yourId == null) return;

    const me = this.state.lastSnapshot.players.find((pp) => pp.id === this.state.yourId);
    if (!me) return;

    for (const portal of this.renderer.portalsFromMap(this.state)) {
      if (this.renderer.circleRectOverlap(me.x, me.y, this.renderer.PLAYER_RADIUS, portal)) {
        ws.send(encodeEnterPortal(portal.id));
        return;
      }
    }
  }

  updateMouseVector(e) {
    const rect = this.renderer.app.canvas.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;

    const worldX = (screenX - this.renderer.world.x) / this.renderer.CAMERA_ZOOM;
    const worldY = (screenY - this.renderer.world.y) / this.renderer.CAMERA_ZOOM;

    const me = this.state.localPlayerPos();
    this.state.input.mouseDx = worldX - me.x;
    this.state.input.mouseDy = worldY - me.y;
  }

  showPlayOverlay() {
    if (!this.playOverlay) return;
    if (this.state.playOverlayVisible) return;
    this.state.playOverlayVisible = true;
    this.playOverlay.style.display = 'block';
    if (this.usernameInput) {
      this.usernameInput.value = this.state.localUsername || '';
      this.usernameInput.focus();
      this.usernameInput.select();
    }
  }

  hidePlayOverlay() {
    if (!this.playOverlay) return;
    this.state.playOverlayVisible = false;
    this.playOverlay.style.display = 'none';
  }

  commitUsername() {
    const raw = (this.usernameInput ? this.usernameInput.value : '').trim();
    this.state.localUsername = raw.slice(0, 18);
  }
}
