import { writable, derived } from 'svelte/store';
import { desk, type ConnectionState } from './linak';

// Connection state store
export const connectionState = writable<ConnectionState>('disconnected');
export const connectionError = writable<string | null>(null);

// Height stores
export const currentHeight = writable<number>(0);
export const currentSpeed = writable<number>(0);
export const targetHeight = writable<number>(0);

// Preset heights (persisted to localStorage)
const SITTING_KEY = 'desk-sitting-height';
const STANDING_KEY = 'desk-standing-height';

function loadPreset(key: string, defaultValue: number): number {
  if (typeof localStorage === 'undefined') return defaultValue;
  const stored = localStorage.getItem(key);
  return stored ? parseInt(stored, 10) : defaultValue;
}

function savePreset(key: string, value: number) {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(key, value.toString());
}

export const sittingHeight = writable<number>(loadPreset(SITTING_KEY, 797));
export const standingHeight = writable<number>(loadPreset(STANDING_KEY, 1040));

// Auto-save presets when changed
sittingHeight.subscribe((value) => savePreset(SITTING_KEY, value));
standingHeight.subscribe((value) => savePreset(STANDING_KEY, value));

// Derived stores
export const isConnected = derived(connectionState, ($state) => $state === 'connected');
export const isConnecting = derived(connectionState, ($state) => $state === 'connecting');
export const isMoving = derived(currentSpeed, ($speed) => Math.abs($speed) > 0);

// Height in cm for display
export const heightCm = derived(currentHeight, ($height) => ($height / 10).toFixed(1));

// Position as percentage of range (for visualization)
const MIN_HEIGHT = 680;
const MAX_HEIGHT = 1330;
export const heightPercent = derived(currentHeight, ($height) => {
  return Math.round((($height - MIN_HEIGHT) / (MAX_HEIGHT - MIN_HEIGHT)) * 100);
});

// Wire up desk callbacks to stores
desk.setStateCallback((state, error) => {
  connectionState.set(state);
  connectionError.set(error ?? null);
});

desk.setHeightCallback((height, speed) => {
  currentHeight.set(height);
  currentSpeed.set(speed);
});

// Actions
export async function connect() {
  connectionError.set(null);
  await desk.connect();
}

export async function disconnect() {
  await desk.disconnect();
}

export async function moveTo(height: number) {
  targetHeight.set(height);
  await desk.moveTo(height);
}

export async function moveToStanding() {
  const height = loadPreset(STANDING_KEY, 1040);
  await desk.moveTo(height);
}

export async function moveToSitting() {
  const height = loadPreset(SITTING_KEY, 797);
  await desk.moveTo(height);
}

export async function stop() {
  await desk.stop();
}

export function saveCurrentAsSitting() {
  let current = 0;
  currentHeight.subscribe((v) => (current = v))();
  if (current > 0) {
    sittingHeight.set(current);
  }
}

export function saveCurrentAsStanding() {
  let current = 0;
  currentHeight.subscribe((v) => (current = v))();
  if (current > 0) {
    standingHeight.set(current);
  }
}
