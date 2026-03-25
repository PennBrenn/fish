/**
 * InputManager - Keyboard, mouse, pointer lock management.
 * Imports: Settings (for key bindings and mouse sensitivity).
 * Exports: Singleton.
 * 
 * Reads key bindings from Settings. Never hardcodes key strings outside this module.
 * Checks document.hasFocus() before processing input.
 * Clears all active input states on blur to prevent stuck keys.
 * Pointer lock only requested inside user gesture handler (click).
 */

import settings from './Settings.js';

class InputManager {
  constructor() {
    this._keys = new Map();           // code -> boolean
    this._mouseButtons = new Map();   // button index -> boolean
    this._mouseDeltaX = 0;
    this._mouseDeltaY = 0;
    this._pointerLocked = false;
    this._enabled = false;

    // Bind handlers so we can remove them
    this._onKeyDown = this._handleKeyDown.bind(this);
    this._onKeyUp = this._handleKeyUp.bind(this);
    this._onMouseDown = this._handleMouseDown.bind(this);
    this._onMouseUp = this._handleMouseUp.bind(this);
    this._onMouseMove = this._handleMouseMove.bind(this);
    this._onPointerLockChange = this._handlePointerLockChange.bind(this);
    this._onBlur = this._handleBlur.bind(this);
    this._onContextMenu = (e) => e.preventDefault();
  }

  init(canvas) {
    this._canvas = canvas;
    this._enabled = true;

    document.addEventListener('keydown', this._onKeyDown);
    document.addEventListener('keyup', this._onKeyUp);
    document.addEventListener('mousedown', this._onMouseDown);
    document.addEventListener('mouseup', this._onMouseUp);
    document.addEventListener('mousemove', this._onMouseMove);
    document.addEventListener('pointerlockchange', this._onPointerLockChange);
    window.addEventListener('blur', this._onBlur);
    canvas.addEventListener('contextmenu', this._onContextMenu);
  }

  dispose() {
    this._enabled = false;
    document.removeEventListener('keydown', this._onKeyDown);
    document.removeEventListener('keyup', this._onKeyUp);
    document.removeEventListener('mousedown', this._onMouseDown);
    document.removeEventListener('mouseup', this._onMouseUp);
    document.removeEventListener('mousemove', this._onMouseMove);
    document.removeEventListener('pointerlockchange', this._onPointerLockChange);
    window.removeEventListener('blur', this._onBlur);
    if (this._canvas) {
      this._canvas.removeEventListener('contextmenu', this._onContextMenu);
    }
  }

  requestPointerLock() {
    if (this._canvas && document.pointerLockElement !== this._canvas) {
      this._canvas.requestPointerLock();
    }
  }

  exitPointerLock() {
    if (document.pointerLockElement) {
      document.exitPointerLock();
    }
  }

  get isPointerLocked() {
    return this._pointerLocked;
  }

  // Query if a raw key code is currently pressed
  isKeyDown(code) {
    return this._keys.get(code) || false;
  }

  // Query if a game action is active, using key bindings from Settings
  isActionDown(action) {
    const binding = settings.getKeyBinding(action);
    if (!binding) return false;

    // Mouse buttons stored as "Mouse0", "Mouse1", "Mouse2"
    if (binding.startsWith('Mouse')) {
      const btn = parseInt(binding.replace('Mouse', ''), 10);
      return this._mouseButtons.get(btn) || false;
    }
    return this._keys.get(binding) || false;
  }

  // Get and consume mouse delta (call once per frame)
  getMouseDelta() {
    const dx = this._mouseDeltaX;
    const dy = this._mouseDeltaY;
    this._mouseDeltaX = 0;
    this._mouseDeltaY = 0;
    return { x: dx, y: dy };
  }

  // Call at end of frame to reset per-frame state
  resetFrameState() {
    this._mouseDeltaX = 0;
    this._mouseDeltaY = 0;
  }

  _handleKeyDown(e) {
    if (!this._enabled) return;
    // Prevent default for game keys to stop browser shortcuts
    if (e.code === 'Space' || e.code === 'Tab') {
      e.preventDefault();
    }
    this._keys.set(e.code, true);
  }

  _handleKeyUp(e) {
    if (!this._enabled) return;
    this._keys.set(e.code, false);
  }

  _handleMouseDown(e) {
    if (!this._enabled) return;
    this._mouseButtons.set(e.button, true);
  }

  _handleMouseUp(e) {
    if (!this._enabled) return;
    this._mouseButtons.set(e.button, false);
  }

  _handleMouseMove(e) {
    if (!this._enabled) return;
    // Only accumulate mouse movement when pointer is locked
    if (document.pointerLockElement !== this._canvas) return;
    if (!document.hasFocus()) return;

    this._mouseDeltaX += e.movementX;
    this._mouseDeltaY += e.movementY;
  }

  _handlePointerLockChange() {
    this._pointerLocked = document.pointerLockElement === this._canvas;
    if (!this._pointerLocked) {
      // Clear all input state when pointer lock is lost
      this._clearAll();
    }
  }

  _handleBlur() {
    this._clearAll();
  }

  _clearAll() {
    this._keys.clear();
    this._mouseButtons.clear();
    this._mouseDeltaX = 0;
    this._mouseDeltaY = 0;
  }
}

const inputManager = new InputManager();
export default inputManager;
