<script lang="ts">
  import HeightDisplay from './components/HeightDisplay.svelte';
  import DeskControl from './components/DeskControl.svelte';
  import { isConnected, connectionState } from './lib/stores';
</script>

<main>
  <header>
    <h1>Desk Control</h1>
    <div class="status" class:connected={$isConnected}>
      <span class="status-dot"></span>
      <span class="status-text">{$connectionState}</span>
    </div>
  </header>

  <section class="display-section">
    <HeightDisplay />
  </section>

  <section class="control-section">
    <DeskControl />
  </section>

  <footer>
    <p>Linak Desk Controller PWA</p>
  </footer>
</main>

<style>
  main {
    min-height: 100vh;
    min-height: 100dvh;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 1rem;
    padding-bottom: env(safe-area-inset-bottom, 1rem);
  }

  header {
    width: 100%;
    max-width: 400px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1rem 0;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  }

  h1 {
    font-size: 1.5rem;
    font-weight: 700;
    margin: 0;
    background: linear-gradient(135deg, #f8f9fa 0%, #adb5bd 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  .status {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.75rem;
    color: #6c757d;
    text-transform: capitalize;
  }

  .status-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #495057;
    transition: all 0.3s ease;
  }

  .status.connected .status-dot {
    background: #10b981;
    box-shadow: 0 0 10px rgba(16, 185, 129, 0.5);
  }

  .display-section {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
  }

  .control-section {
    width: 100%;
    display: flex;
    justify-content: center;
  }

  footer {
    padding: 1rem;
    color: #495057;
    font-size: 0.75rem;
  }

  footer p {
    margin: 0;
  }
</style>
