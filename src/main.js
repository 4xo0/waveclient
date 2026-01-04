import { GameState } from './state.js';
import { InputController } from './input.js';
import { Renderer } from './render.js';

const playOverlay = document.getElementById('playOverlay');
const usernameInput = document.getElementById('usernameInput');
const playBtn = document.getElementById('playBtn');

async function boot() {
  const state = new GameState();
  const renderer = new Renderer();
  await renderer.init();

  const input = new InputController(state, renderer, {
    playOverlay,
    usernameInput,
    playBtn,
  });
  input.attach();
  input.connect();
  input.startTickLoop();
}

boot();