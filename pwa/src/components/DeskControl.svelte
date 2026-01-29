<script lang="ts">
  import {
    connectionState,
    connectionError,
    isConnected,
    isConnecting,
    isMoving,
    currentHeight,
    sittingHeight,
    standingHeight,
    connect,
    disconnect,
    moveToStanding,
    moveToSitting,
    moveTo,
    stop,
    saveCurrentAsSitting,
    saveCurrentAsStanding,
  } from '../lib/stores';
  import BluetoothHelp from './BluetoothHelp.svelte';

  let customHeight = 900;
  let showSaveOptions = false;

  function handleSliderChange(e: Event) {
    const target = e.target as HTMLInputElement;
    customHeight = parseInt(target.value, 10);
  }

  function moveToCustom() {
    moveTo(customHeight);
  }
</script>

<div class="desk-control">
  {#if !$isConnected}
    <div class="connect-section">
      <BluetoothHelp />

      <button class="btn btn-connect" on:click={connect} disabled={$isConnecting}>
        {#if $isConnecting}
          <span class="spinner"></span>
          Connecting...
        {:else}
          <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 2L2 7l10 5 10-5-10-5z" />
            <path d="M2 17l10 5 10-5" />
            <path d="M2 12l10 5 10-5" />
          </svg>
          Connect to Desk
        {/if}
      </button>

      {#if $connectionError}
        <div class="error-message">
          {$connectionError}
        </div>
      {/if}

      <p class="hint">Make sure your desk is on and Bluetooth is enabled</p>
    </div>
  {:else}
    <div class="controls-section">
      <div class="preset-buttons">
        <button class="btn btn-preset btn-sit" on:click={moveToSitting} disabled={$isMoving}>
          <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
          <span class="btn-label">Sit</span>
          <span class="btn-height">{$sittingHeight}mm</span>
        </button>

        <button
          class="btn btn-stop"
          on:click={stop}
          disabled={!$isMoving}
          aria-label="Stop"
          title="Stop"
        >
          <svg class="icon" viewBox="0 0 24 24" fill="currentColor">
            <rect x="6" y="6" width="12" height="12" rx="2" />
          </svg>
        </button>

        <button class="btn btn-preset btn-stand" on:click={moveToStanding} disabled={$isMoving}>
          <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 2v20" />
            <path d="M8 6l4-4 4 4" />
            <circle cx="12" cy="10" r="2" />
          </svg>
          <span class="btn-label">Stand</span>
          <span class="btn-height">{$standingHeight}mm</span>
        </button>
      </div>

      <div class="custom-height">
        <label class="slider-label" for="height-slider">
          Custom Height: <span class="slider-value">{customHeight}mm</span>
        </label>
        <div class="slider-container">
          <input
            type="range"
            id="height-slider"
            min="680"
            max="1330"
            step="1"
            bind:value={customHeight}
            on:input={handleSliderChange}
            class="slider"
          />
          <button class="btn btn-go" on:click={moveToCustom} disabled={$isMoving}> Go </button>
        </div>
      </div>

      <div class="save-section">
        <button class="btn btn-text" on:click={() => (showSaveOptions = !showSaveOptions)}>
          {showSaveOptions ? 'Cancel' : 'Save current height...'}
        </button>

        {#if showSaveOptions}
          <div class="save-options">
            <button
              class="btn btn-save"
              on:click={() => {
                saveCurrentAsSitting();
                showSaveOptions = false;
              }}
            >
              Save as Sit ({$currentHeight}mm)
            </button>
            <button
              class="btn btn-save"
              on:click={() => {
                saveCurrentAsStanding();
                showSaveOptions = false;
              }}
            >
              Save as Stand ({$currentHeight}mm)
            </button>
          </div>
        {/if}
      </div>

      <button class="btn btn-disconnect" on:click={disconnect}> Disconnect </button>
    </div>
  {/if}
</div>

<style>
  .desk-control {
    width: 100%;
    max-width: 400px;
    padding: 1.5rem;
  }

  .connect-section {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
  }

  .controls-section {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  .btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding: 0.75rem 1.5rem;
    border: none;
    border-radius: 12px;
    font-size: 1rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
    font-family: inherit;
  }

  .btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .btn-connect {
    width: 100%;
    padding: 1.25rem 2rem;
    font-size: 1.125rem;
    background: linear-gradient(135deg, #4361ee 0%, #7209b7 100%);
    color: white;
    box-shadow: 0 4px 20px rgba(67, 97, 238, 0.4);
  }

  .btn-connect:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 6px 25px rgba(67, 97, 238, 0.5);
  }

  .icon {
    width: 1.25em;
    height: 1.25em;
  }

  .spinner {
    width: 1.25em;
    height: 1.25em;
    border: 2px solid transparent;
    border-top-color: currentColor;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  .error-message {
    padding: 0.75rem 1rem;
    background: rgba(220, 53, 69, 0.15);
    border: 1px solid rgba(220, 53, 69, 0.3);
    border-radius: 8px;
    color: #f87171;
    font-size: 0.875rem;
    text-align: center;
    width: 100%;
  }

  .hint {
    color: #6c757d;
    font-size: 0.875rem;
    text-align: center;
    margin: 0;
  }

  .preset-buttons {
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    gap: 0.75rem;
  }

  .btn-preset {
    flex-direction: column;
    padding: 1.25rem 1rem;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: #e9ecef;
  }

  .btn-preset:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.1);
    border-color: rgba(255, 255, 255, 0.2);
  }

  .btn-sit:hover:not(:disabled) {
    border-color: #4361ee;
    box-shadow: 0 0 20px rgba(67, 97, 238, 0.2);
  }

  .btn-stand:hover:not(:disabled) {
    border-color: #7209b7;
    box-shadow: 0 0 20px rgba(114, 9, 183, 0.2);
  }

  .btn-label {
    font-size: 1rem;
  }

  .btn-height {
    font-size: 0.75rem;
    opacity: 0.6;
    font-family: 'JetBrains Mono', 'Fira Code', monospace;
  }

  .btn-stop {
    padding: 1rem;
    background: #dc3545;
    color: white;
    border-radius: 50%;
    width: 56px;
    height: 56px;
    align-self: center;
  }

  .btn-stop:hover:not(:disabled) {
    background: #c82333;
    box-shadow: 0 0 20px rgba(220, 53, 69, 0.4);
  }

  .btn-stop:disabled {
    background: #495057;
  }

  .custom-height {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .slider-label {
    font-size: 0.875rem;
    color: #adb5bd;
  }

  .slider-value {
    font-family: 'JetBrains Mono', 'Fira Code', monospace;
    color: #e9ecef;
  }

  .slider-container {
    display: flex;
    gap: 0.75rem;
    align-items: center;
  }

  .slider {
    flex: 1;
    height: 8px;
    -webkit-appearance: none;
    appearance: none;
    background: linear-gradient(90deg, #4361ee, #7209b7);
    border-radius: 4px;
    outline: none;
  }

  .slider::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 24px;
    height: 24px;
    background: #e9ecef;
    border-radius: 50%;
    cursor: pointer;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
    transition: transform 0.15s ease;
  }

  .slider::-webkit-slider-thumb:hover {
    transform: scale(1.1);
  }

  .slider::-moz-range-thumb {
    width: 24px;
    height: 24px;
    background: #e9ecef;
    border-radius: 50%;
    cursor: pointer;
    border: none;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
  }

  .btn-go {
    padding: 0.5rem 1.25rem;
    background: linear-gradient(135deg, #4361ee 0%, #7209b7 100%);
    color: white;
    font-size: 0.875rem;
  }

  .btn-go:hover:not(:disabled) {
    box-shadow: 0 4px 15px rgba(67, 97, 238, 0.4);
  }

  .save-section {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.75rem;
  }

  .btn-text {
    background: transparent;
    color: #6c757d;
    font-size: 0.875rem;
    padding: 0.5rem;
  }

  .btn-text:hover {
    color: #adb5bd;
  }

  .save-options {
    display: flex;
    gap: 0.5rem;
    animation: slide-down 0.2s ease;
  }

  @keyframes slide-down {
    from {
      opacity: 0;
      transform: translateY(-10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .btn-save {
    padding: 0.5rem 1rem;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: #adb5bd;
    font-size: 0.75rem;
  }

  .btn-save:hover {
    background: rgba(255, 255, 255, 0.1);
    color: #e9ecef;
  }

  .btn-disconnect {
    background: transparent;
    border: 1px solid rgba(220, 53, 69, 0.3);
    color: #f87171;
    font-size: 0.875rem;
    padding: 0.625rem 1rem;
  }

  .btn-disconnect:hover {
    background: rgba(220, 53, 69, 0.1);
    border-color: rgba(220, 53, 69, 0.5);
  }
</style>
