<script lang="ts">
  import { onMount } from 'svelte';
  import {
    detectBrowser,
    checkBluetoothStatus,
    getInstructions,
    type BluetoothStatus,
    type BrowserInfo,
  } from '../lib/bluetooth-check';

  let status: BluetoothStatus = 'available';
  let browser: BrowserInfo = { name: 'unknown', isSupported: false };
  let instructions: { title: string; steps: string[] } = { title: '', steps: [] };
  let checking = true;

  onMount(async () => {
    browser = detectBrowser();
    status = await checkBluetoothStatus();
    instructions = getInstructions(status, browser);
    checking = false;
  });

  $: showHelp = !checking && (status !== 'available' || !browser.isSupported);
</script>

{#if checking}
  <div class="checking">
    <span class="spinner"></span>
    Checking Bluetooth...
  </div>
{:else if showHelp}
  <div class="help-panel" class:error={status !== 'available'}>
    <div class="help-icon">
      {#if status === 'permission-blocked'}
        🔒
      {:else if status === 'no-adapter'}
        📡
      {:else}
        ⚠️
      {/if}
    </div>

    <h3>{instructions.title}</h3>

    <ol class="steps">
      {#each instructions.steps as step}
        <li>{step}</li>
      {/each}
    </ol>

    {#if status === 'api-disabled' && browser.name === 'brave'}
      <a href="brave://flags/#brave-web-bluetooth-api" class="flag-link" target="_blank">
        Open Brave Flags →
      </a>
    {/if}

    <p class="browser-info">
      Detected: {browser.name}
      {#if browser.isSupported}
        <span class="supported">✓ Supported</span>
      {:else}
        <span class="unsupported">✗ Not supported</span>
      {/if}
    </p>
  </div>
{/if}

<style>
  .checking {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding: 1rem;
    color: #6c757d;
    font-size: 0.875rem;
  }

  .spinner {
    width: 1rem;
    height: 1rem;
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

  .help-panel {
    background: rgba(255, 193, 7, 0.1);
    border: 1px solid rgba(255, 193, 7, 0.3);
    border-radius: 12px;
    padding: 1.25rem;
    margin-bottom: 1rem;
    text-align: left;
  }

  .help-panel.error {
    background: rgba(220, 53, 69, 0.1);
    border-color: rgba(220, 53, 69, 0.3);
  }

  .help-icon {
    font-size: 2rem;
    margin-bottom: 0.5rem;
  }

  h3 {
    margin: 0 0 0.75rem 0;
    font-size: 1rem;
    font-weight: 600;
    color: #f8f9fa;
  }

  .steps {
    margin: 0;
    padding-left: 1.25rem;
    font-size: 0.875rem;
    color: #adb5bd;
    line-height: 1.6;
  }

  .steps li {
    margin-bottom: 0.25rem;
  }

  .steps li::marker {
    color: #6c757d;
  }

  .flag-link {
    display: inline-block;
    margin-top: 0.75rem;
    padding: 0.5rem 1rem;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 6px;
    color: #ffc107;
    text-decoration: none;
    font-size: 0.875rem;
    transition: background 0.2s;
  }

  .flag-link:hover {
    background: rgba(255, 255, 255, 0.15);
  }

  .browser-info {
    margin: 0.75rem 0 0 0;
    padding-top: 0.75rem;
    border-top: 1px solid rgba(255, 255, 255, 0.1);
    font-size: 0.75rem;
    color: #6c757d;
    text-transform: capitalize;
  }

  .supported {
    color: #10b981;
  }

  .unsupported {
    color: #f87171;
  }
</style>
