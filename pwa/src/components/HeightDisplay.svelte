<script lang="ts">
  import { currentHeight, heightCm, heightPercent, isMoving, currentSpeed } from '../lib/stores';
</script>

<div class="height-display">
  <div class="desk-visual">
    <div class="desk-column left">
      <div class="column-fill" style="height: {$heightPercent}%"></div>
    </div>

    <div class="desk-surface" style="bottom: {$heightPercent}%">
      <div class="surface-glow" class:active={$isMoving}></div>
      <div class="surface-top"></div>
    </div>

    <div class="desk-column right">
      <div class="column-fill" style="height: {$heightPercent}%"></div>
    </div>
  </div>

  <div class="height-info">
    <span class="height-value">{$heightCm}</span>
    <span class="height-unit">cm</span>
    {#if $isMoving}
      <span class="speed-indicator">
        {$currentSpeed > 0 ? '↑' : '↓'}
        {Math.abs($currentSpeed)} mm/s
      </span>
    {/if}
  </div>

  <div class="height-raw">
    {$currentHeight} mm
  </div>
</div>

<style>
  .height-display {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1.5rem;
    padding: 2rem;
  }

  .desk-visual {
    position: relative;
    width: 200px;
    height: 200px;
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
  }

  .desk-column {
    width: 12px;
    height: 100%;
    background: linear-gradient(to top, #1a1a2e, #16213e);
    border-radius: 6px;
    position: relative;
    overflow: hidden;
    box-shadow: inset 0 0 10px rgba(0, 0, 0, 0.5);
  }

  .column-fill {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    background: linear-gradient(to top, #4361ee, #7209b7);
    border-radius: 6px;
    transition: height 0.15s ease-out;
  }

  .desk-surface {
    position: absolute;
    left: 10px;
    right: 10px;
    height: 8px;
    transition: bottom 0.15s ease-out;
  }

  .surface-top {
    width: 100%;
    height: 100%;
    background: linear-gradient(90deg, #3a0ca3, #7209b7, #3a0ca3);
    border-radius: 4px;
    box-shadow:
      0 4px 20px rgba(114, 9, 183, 0.3),
      0 0 40px rgba(67, 97, 238, 0.2);
  }

  .surface-glow {
    position: absolute;
    inset: -4px;
    background: linear-gradient(90deg, #4361ee, #f72585, #4361ee);
    border-radius: 8px;
    opacity: 0;
    filter: blur(8px);
    transition: opacity 0.3s ease;
  }

  .surface-glow.active {
    opacity: 0.6;
    animation: pulse 0.5s ease-in-out infinite alternate;
  }

  @keyframes pulse {
    from {
      opacity: 0.4;
      transform: scale(1);
    }
    to {
      opacity: 0.8;
      transform: scale(1.02);
    }
  }

  .height-info {
    display: flex;
    align-items: baseline;
    gap: 0.25rem;
  }

  .height-value {
    font-family: 'JetBrains Mono', 'Fira Code', monospace;
    font-size: 4rem;
    font-weight: 700;
    background: linear-gradient(135deg, #f8f9fa 0%, #adb5bd 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    line-height: 1;
  }

  .height-unit {
    font-size: 1.5rem;
    color: #6c757d;
    font-weight: 500;
  }

  .speed-indicator {
    margin-left: 1rem;
    font-size: 0.875rem;
    color: #f72585;
    font-family: 'JetBrains Mono', 'Fira Code', monospace;
    animation: fade-in 0.2s ease;
  }

  @keyframes fade-in {
    from {
      opacity: 0;
      transform: translateY(-5px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .height-raw {
    font-size: 0.75rem;
    color: #495057;
    font-family: 'JetBrains Mono', 'Fira Code', monospace;
  }
</style>
