// Linak BLE Protocol Implementation
// Based on reverse-engineered protocol from linak-controller

// Service UUIDs
const POSITION_SERVICE_UUID = '99fa0020-338a-1024-8a49-009c0215f78a';
const CONTROL_SERVICE_UUID = '99fa0001-338a-1024-8a49-009c0215f78a';
const REFERENCE_INPUT_SERVICE_UUID = '99fa0030-338a-1024-8a49-009c0215f78a';
const DPG_SERVICE_UUID = '99fa0010-338a-1024-8a49-009c0215f78a'; // DPG service for user ID

// Characteristic UUIDs
const POSITION_CHAR_UUID = '99fa0021-338a-1024-8a49-009c0215f78a'; // Read position
const CONTROL_CHAR_UUID = '99fa0002-338a-1024-8a49-009c0215f78a'; // Write commands (up/down/wakeup/stop)
const REFERENCE_INPUT_CHAR_UUID = '99fa0031-338a-1024-8a49-009c0215f78a'; // Write target height
const DPG_CHAR_UUID = '99fa0011-338a-1024-8a49-009c0215f78a'; // DPG characteristic for commands

// DPG Commands
const DPG_CMD_USER_ID = 134; // 0x86 - Read/write user ID

// Movement commands - Linak DPG manual control
const CMD_MOVE_DOWN = 0x46; // Move down while sending
const CMD_MOVE_UP = 0x47; // Move up while sending
const CMD_WAKEUP = 0xfe; // Wake up the desk before movement
const CMD_STOP = 0xff;

// Connection settings
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;
const CONNECTION_STABILIZE_MS = 500;

// Connection state
export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error';

export type HeightCallback = (heightMm: number, speedMmPerSec: number) => void;
export type StateCallback = (state: ConnectionState, error?: string) => void;

// Helper to delay execution
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export class LinakDesk {
  private device: BluetoothDevice | null = null;
  private server: BluetoothRemoteGATTServer | null = null;
  private positionChar: BluetoothRemoteGATTCharacteristic | null = null;
  private controlChar: BluetoothRemoteGATTCharacteristic | null = null;
  private refInputChar: BluetoothRemoteGATTCharacteristic | null = null;
  private dpgChar: BluetoothRemoteGATTCharacteristic | null = null;

  private onHeightChange: HeightCallback | null = null;
  private onStateChange: StateCallback | null = null;

  private baseHeight = 680; // Base height in mm (from desk config)
  private isMoving = false;
  private hasStartedMoving = false;
  private targetHeight = 0;
  private currentSpeedRaw = 0; // Speed in raw units (0.1mm/s)

  constructor() {
    // Check Web Bluetooth support
    if (!navigator.bluetooth) {
      console.error('Web Bluetooth API not supported');
    }
  }

  setHeightCallback(callback: HeightCallback) {
    this.onHeightChange = callback;
  }

  setStateCallback(callback: StateCallback) {
    this.onStateChange = callback;
  }

  private updateState(state: ConnectionState, error?: string) {
    this.onStateChange?.(state, error);
  }

  async connect(): Promise<boolean> {
    if (!navigator.bluetooth) {
      this.updateState('error', 'Web Bluetooth not supported. Use Chrome or Edge.');
      return false;
    }

    try {
      this.updateState('connecting');

      // Request Bluetooth device with Linak services
      this.device = await navigator.bluetooth.requestDevice({
        filters: [{ namePrefix: 'Desk' }, { services: [CONTROL_SERVICE_UUID] }],
        optionalServices: [
          POSITION_SERVICE_UUID,
          CONTROL_SERVICE_UUID,
          REFERENCE_INPUT_SERVICE_UUID,
          DPG_SERVICE_UUID,
        ],
      });

      if (!this.device) {
        this.updateState('error', 'No device selected');
        return false;
      }

      // Listen for disconnection
      this.device.addEventListener('gattserverdisconnected', () => {
        this.handleDisconnect();
      });

      // Connect to GATT server with retry logic
      const connected = await this.connectToGattServer();
      if (!connected) {
        return false;
      }

      this.updateState('connected');
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';

      // Provide more helpful error messages
      if (message.includes('User cancelled')) {
        this.updateState('disconnected');
      } else {
        this.updateState('error', message);
      }
      return false;
    }
  }

  private async connectToGattServer(): Promise<boolean> {
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        console.log(`Connection attempt ${attempt}/${MAX_RETRIES}...`);

        // Connect to GATT server
        this.server = (await this.device?.gatt?.connect()) ?? null;
        if (!this.server) {
          throw new Error('Failed to connect to GATT server');
        }

        // Wait for connection to stabilize
        await delay(CONNECTION_STABILIZE_MS);

        // Check if still connected after delay
        if (!this.server.connected) {
          throw new Error('Connection dropped during stabilization');
        }

        // Get services and characteristics
        await this.discoverServices();

        console.log('Connected successfully!');
        return true;
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        console.warn(`Attempt ${attempt} failed: ${message}`);

        // Clean up failed connection
        if (this.server?.connected) {
          try {
            this.device?.gatt?.disconnect();
          } catch {
            // Ignore disconnect errors
          }
        }
        this.server = null;
        this.positionChar = null;
        this.controlChar = null;
        this.refInputChar = null;
        this.dpgChar = null;

        // If not the last attempt, wait before retrying
        if (attempt < MAX_RETRIES) {
          this.updateState('connecting', `Retry ${attempt}/${MAX_RETRIES - 1}...`);
          await delay(RETRY_DELAY_MS);
        } else {
          this.updateState('error', `Connection failed after ${MAX_RETRIES} attempts: ${message}`);
          return false;
        }
      }
    }

    return false;
  }

  private async discoverServices(): Promise<void> {
    if (!this.server?.connected) {
      throw new Error('GATT Server is disconnected');
    }

    // Log all available services and characteristics for debugging
    console.log('Discovering services...');
    try {
      const services = await this.server.getPrimaryServices();
      for (const service of services) {
        console.log(`Service: ${service.uuid}`);
        const chars = await service.getCharacteristics();
        for (const char of chars) {
          const props = char.properties;
          const propList = [
            props.read && 'read',
            props.write && 'write',
            props.writeWithoutResponse && 'writeNoResp',
            props.notify && 'notify',
            props.indicate && 'indicate',
          ].filter(Boolean);
          console.log(`  Char: ${char.uuid} [${propList.join(', ')}]`);
        }
      }
    } catch (e) {
      console.log('Could not enumerate all services:', e);
    }

    // Get position service and characteristic
    const positionService = await this.server.getPrimaryService(POSITION_SERVICE_UUID);
    this.positionChar = await positionService.getCharacteristic(POSITION_CHAR_UUID);

    // Get control service and characteristic
    const controlService = await this.server.getPrimaryService(CONTROL_SERVICE_UUID);
    this.controlChar = await controlService.getCharacteristic(CONTROL_CHAR_UUID);

    console.log('Control characteristic properties:', this.controlChar.properties);

    // Get reference input service and characteristic for absolute positioning
    try {
      const refInputService = await this.server.getPrimaryService(REFERENCE_INPUT_SERVICE_UUID);
      this.refInputChar = await refInputService.getCharacteristic(REFERENCE_INPUT_CHAR_UUID);
      console.log('Reference Input characteristic found');
    } catch (e) {
      console.warn('Could not access Reference Input service:', e);
    }

    // Get DPG service and characteristic for user ID activation
    try {
      const dpgService = await this.server.getPrimaryService(DPG_SERVICE_UUID);
      this.dpgChar = await dpgService.getCharacteristic(DPG_CHAR_UUID);
      console.log('DPG characteristic found, activating user ID...');
      await this.activateUserId();
    } catch (e) {
      console.warn('Could not access DPG service (may not be required):', e);
    }

    // Start position notifications
    await this.startPositionNotifications();

    // Read initial position
    await this.readPosition();
  }

  /**
   * Activate the user ID - required before desk accepts movement commands.
   * The first byte of the user ID must be set to 1.
   */
  private async activateUserId(): Promise<void> {
    if (!this.dpgChar) return;

    try {
      // Subscribe to notifications to receive the response
      let userIdData: DataView | null = null;

      await this.dpgChar.startNotifications();
      const notifyPromise = new Promise<DataView>((resolve) => {
        const handler = (event: Event) => {
          const target = event.target as BluetoothRemoteGATTCharacteristic;
          if (target.value) {
            this.dpgChar?.removeEventListener('characteristicvaluechanged', handler);
            resolve(target.value);
          }
        };
        this.dpgChar?.addEventListener('characteristicvaluechanged', handler);
      });

      // Send read user ID command: [0x7F, 134, 0x00]
      const readCmd = new Uint8Array([0x7f, DPG_CMD_USER_ID, 0x00]);
      await this.dpgChar.writeValueWithoutResponse(readCmd);

      // Wait for notification with timeout
      const timeoutPromise = new Promise<DataView>((_, reject) =>
        setTimeout(() => reject(new Error('User ID read timeout')), 2000)
      );

      try {
        userIdData = await Promise.race([notifyPromise, timeoutPromise]);
      } catch (e) {
        console.warn('User ID notification timeout, trying direct read...');
        // Fallback: try direct read
        userIdData = await this.dpgChar.readValue();
      }

      await this.dpgChar.stopNotifications();

      if (!userIdData || userIdData.byteLength < 3) {
        console.warn('Invalid user ID response');
        return;
      }

      // Check response - byte 0 should be 1 (success), data starts at byte 2
      const responseOk = userIdData.getUint8(0) === 1;
      if (!responseOk) {
        console.warn('User ID read failed, response:', userIdData);
        return;
      }

      // Get user ID data (skip first 2 bytes which are response header)
      const userId = new Uint8Array(userIdData.buffer, userIdData.byteOffset + 2);
      console.log(
        'User ID:',
        Array.from(userId)
          .map((b) => b.toString(16).padStart(2, '0'))
          .join(' ')
      );

      // Check if first byte is already 1
      if (userId[0] === 1) {
        console.log('User ID already activated');
        return;
      }

      // Set first byte to 1 and write back
      userId[0] = 1;
      console.log('Activating user ID...');

      // Write command: [0x7F, 134, 0x80, ...userId]
      const writeCmd = new Uint8Array(3 + userId.length);
      writeCmd[0] = 0x7f;
      writeCmd[1] = DPG_CMD_USER_ID;
      writeCmd[2] = 0x80;
      writeCmd.set(userId, 3);

      await this.dpgChar.writeValueWithoutResponse(writeCmd);
      console.log('User ID activated!');
    } catch (error) {
      console.error('Failed to activate user ID:', error);
    }
  }

  private handleDisconnect() {
    this.server = null;
    this.positionChar = null;
    this.controlChar = null;
    this.refInputChar = null;
    this.dpgChar = null;
    this.isMoving = false;
    this.hasStartedMoving = false;
    this.updateState('disconnected');
  }

  async disconnect() {
    if (this.device?.gatt?.connected) {
      this.device.gatt.disconnect();
    }
    this.handleDisconnect();
  }

  private async startPositionNotifications() {
    if (!this.positionChar) return;

    try {
      await this.positionChar.startNotifications();
      this.positionChar.addEventListener('characteristicvaluechanged', (event) => {
        const target = event.target as BluetoothRemoteGATTCharacteristic;
        if (target.value) {
          this.parsePositionData(target.value);
        }
      });
    } catch (error) {
      console.error('Failed to start notifications:', error);
    }
  }

  private parsePositionData(data: DataView) {
    // Position data format: [position_low, position_high, speed_low, speed_high]
    // Position is in 0.1mm units from base height
    const positionRaw = data.getUint16(0, true); // Little-endian
    const speedRaw = data.getInt16(2, true); // Little-endian, signed

    const heightMm = this.baseHeight + Math.round(positionRaw / 10);
    const speedMmPerSec = Math.round(speedRaw / 10);

    // Track current height and speed for moveTo
    this.currentHeightMm = heightMm;
    this.currentSpeedRaw = speedRaw;

    this.onHeightChange?.(heightMm, speedMmPerSec);

    // Track if desk has started moving
    if (this.isMoving && Math.abs(speedRaw) > 0) {
      this.hasStartedMoving = true;
    }
  }

  async readPosition(): Promise<number | null> {
    if (!this.positionChar) return null;

    try {
      const value = await this.positionChar.readValue();
      this.parsePositionData(value);
      const positionRaw = value.getUint16(0, true);
      return this.baseHeight + Math.round(positionRaw / 10);
    } catch (error) {
      console.error('Failed to read position:', error);
      return null;
    }
  }

  private currentHeightMm = 0;

  /**
   * Move the desk to the specified height using the Reference Input method.
   * This replicates the linak-controller Python implementation:
   * 1. Wake up the desk
   * 2. Send stop command
   * 3. Loop: send target height to Reference Input until speed becomes 0
   * 4. Send final stop command
   */
  async moveTo(heightMm: number): Promise<boolean> {
    if (!this.controlChar || !this.refInputChar || !this.server?.connected) {
      console.error('Not connected or Reference Input not available');
      // Fallback to up/down commands if Reference Input not available
      if (this.controlChar && this.server?.connected) {
        return this.moveToFallback(heightMm);
      }
      return false;
    }

    // Read current height if we don't have it
    if (this.currentHeightMm === 0) {
      await this.readPosition();
    }

    const tolerance = 2; // mm tolerance (linak-controller uses 1mm)

    // Already at target?
    if (Math.abs(this.currentHeightMm - heightMm) <= tolerance) {
      console.log('Already at target height');
      return true;
    }

    console.log(`Moving from ${this.currentHeightMm}mm to ${heightMm}mm`);

    try {
      // 1. Wake up the desk
      await this.controlChar.writeValueWithoutResponse(new Uint8Array([0x01, 0x00]));
      console.log('Wakeup sent');

      // 2. Send stop command (clear any previous state)
      await this.controlChar.writeValueWithoutResponse(new Uint8Array([CMD_STOP, 0x00]));
      await delay(100);

      // Calculate raw target value for Reference Input
      // Reference Input expects raw position value (without base height) in 0.1mm units
      const targetRaw = (heightMm - this.baseHeight) * 10;
      const targetData = new Uint8Array(2);
      targetData[0] = targetRaw & 0xff; // Low byte
      targetData[1] = (targetRaw >> 8) & 0xff; // High byte

      console.log(
        `Target: ${heightMm}mm (raw: ${targetRaw}) = [0x${targetData[0].toString(16)}, 0x${targetData[1].toString(16)}]`
      );

      this.isMoving = true;
      this.hasStartedMoving = false;
      this.targetHeight = heightMm;

      // 3. Loop: send target height to Reference Input until speed becomes 0
      const moveCommandPeriod = 400; // ms (linak-controller default)
      const maxIterations = 150; // Safety limit (~60 seconds)

      for (let i = 0; i < maxIterations; i++) {
        // Check if cancelled
        if (!this.isMoving || !this.server?.connected) {
          console.log(`Movement cancelled after ${i} iterations`);
          break;
        }

        // Send target height to Reference Input
        await this.refInputChar.writeValueWithoutResponse(targetData);

        // Wait for the command period
        await delay(moveCommandPeriod);

        // Log progress
        const speedMm = Math.round(this.currentSpeedRaw / 10);
        if (i < 3 || i % 5 === 0 || this.currentSpeedRaw === 0) {
          console.log(`Height: ${this.currentHeightMm}mm Speed: ${speedMm}mm/s`);
        }

        // Track if desk has started moving
        if (Math.abs(this.currentSpeedRaw) > 0) {
          this.hasStartedMoving = true;
        }

        // Check if movement is complete (speed is 0 after desk started moving)
        if (this.hasStartedMoving && this.currentSpeedRaw === 0) {
          console.log('Movement complete - desk stopped');
          break;
        }
      }

      // 4. Send final stop command
      await this.controlChar.writeValueWithoutResponse(new Uint8Array([CMD_STOP, 0x00]));

      this.isMoving = false;
      this.hasStartedMoving = false;
      console.log(`Final height: ${this.currentHeightMm}mm (Target: ${heightMm}mm)`);
      return true;
    } catch (error) {
      console.error('Move failed:', error);
      this.isMoving = false;
      this.hasStartedMoving = false;
      // Try to send stop on error
      try {
        await this.controlChar.writeValueWithoutResponse(new Uint8Array([CMD_STOP, 0x00]));
      } catch {
        // Ignore
      }
      return false;
    }
  }

  /**
   * Fallback movement using up/down commands (if Reference Input not available)
   */
  private async moveToFallback(heightMm: number): Promise<boolean> {
    if (!this.controlChar || !this.server?.connected) {
      return false;
    }

    const tolerance = 5;
    if (Math.abs(this.currentHeightMm - heightMm) <= tolerance) {
      return true;
    }

    const direction = heightMm > this.currentHeightMm ? 'up' : 'down';
    const commandByte = direction === 'up' ? CMD_MOVE_UP : CMD_MOVE_DOWN;
    const command = new Uint8Array([commandByte, 0x00]);

    console.log(`Moving ${direction} (fallback) from ${this.currentHeightMm}mm to ${heightMm}mm`);

    // Wakeup
    await this.controlChar.writeValueWithoutResponse(new Uint8Array([CMD_WAKEUP, 0x00]));
    await delay(200);

    this.isMoving = true;

    for (let i = 0; i < 500; i++) {
      if (!this.isMoving || !this.server?.connected) break;

      const reached =
        direction === 'up'
          ? this.currentHeightMm >= heightMm - tolerance
          : this.currentHeightMm <= heightMm + tolerance;

      if (reached) break;

      await this.controlChar.writeValueWithoutResponse(command);
      await delay(100);
    }

    this.isMoving = false;
    console.log(`Final height: ${this.currentHeightMm}mm`);
    return true;
  }

  async stop(): Promise<boolean> {
    if (!this.controlChar || !this.server?.connected) {
      return false;
    }

    this.isMoving = false;

    // Stop command
    const command = new Uint8Array([CMD_STOP, 0x00, 0x00, 0x00, 0x00]);

    try {
      await this.controlChar.writeValueWithoutResponse(command);
      return true;
    } catch (error) {
      console.error('Failed to stop:', error);
      return false;
    }
  }

  get connected(): boolean {
    return this.server?.connected ?? false;
  }

  get moving(): boolean {
    return this.isMoving;
  }

  get deviceName(): string {
    return this.device?.name ?? 'Unknown';
  }
}

// Singleton instance
export const desk = new LinakDesk();

// Debug mode - expose to window for console testing
declare global {
  interface Window {
    desk: LinakDesk;
    sendRaw: (bytes: number[]) => Promise<void>;
    sendMove: (heightMm: number) => Promise<void>;
    getHeight: () => Promise<number | null>;
  }
}

window.desk = desk;

// Helper to send raw bytes to control characteristic
window.sendRaw = async (bytes: number[]) => {
  const char = (desk as any).controlChar as BluetoothRemoteGATTCharacteristic | null;
  if (!char) {
    console.error('Not connected - controlChar is null');
    return;
  }
  const cmd = new Uint8Array(bytes);
  console.log(`Sending raw: [${bytes.join(', ')}]`);
  try {
    await char.writeValueWithoutResponse(cmd);
    console.log('Sent successfully (no response)');
  } catch (e) {
    console.log('writeWithoutResponse failed, trying writeValue...');
    try {
      await char.writeValue(cmd);
      console.log('Sent successfully (with response)');
    } catch (e2) {
      console.error('Both write methods failed:', e2);
    }
  }
};

// Helper to send move command with different formats
window.sendMove = async (heightMm: number) => {
  const baseHeight = 680;
  const posRaw = (heightMm - baseHeight) * 10;

  console.log(`\n=== Testing move to ${heightMm}mm (raw: ${posRaw}) ===\n`);

  // Format 1: 2 bytes [pos_lo, pos_hi]
  console.log('Format 1: [pos_lo, pos_hi]');
  await window.sendRaw([posRaw & 0xff, (posRaw >> 8) & 0xff]);
  await new Promise((r) => setTimeout(r, 500));

  // Format 2: 5 bytes [0x01, pos_lo, pos_hi, pos_lo, pos_hi]
  console.log('Format 2: [0x01, pos_lo, pos_hi, pos_lo, pos_hi]');
  await window.sendRaw([
    0x01,
    posRaw & 0xff,
    (posRaw >> 8) & 0xff,
    posRaw & 0xff,
    (posRaw >> 8) & 0xff,
  ]);
  await new Promise((r) => setTimeout(r, 500));

  // Format 3: 4 bytes [0xFE, 0x00, pos_lo, pos_hi]
  console.log('Format 3: [0xFE, 0x00, pos_lo, pos_hi]');
  await window.sendRaw([0xfe, 0x00, posRaw & 0xff, (posRaw >> 8) & 0xff]);
  await new Promise((r) => setTimeout(r, 500));

  // Format 4: 4 bytes [pos_lo, pos_hi, pos_lo, pos_hi]
  console.log('Format 4: [pos_lo, pos_hi, pos_lo, pos_hi]');
  await window.sendRaw([posRaw & 0xff, (posRaw >> 8) & 0xff, posRaw & 0xff, (posRaw >> 8) & 0xff]);

  console.log('\n=== Done testing formats ===');
};

window.getHeight = async () => {
  return await desk.readPosition();
};

console.log(`
🔧 DESK DEBUG MODE ENABLED 🔧
Available commands in console:
  desk              - The LinakDesk instance
  sendRaw([1,2,3])  - Send raw bytes to control characteristic  
  sendMove(1040)    - Test different command formats for height 1040mm
  getHeight()       - Read current height
`);
