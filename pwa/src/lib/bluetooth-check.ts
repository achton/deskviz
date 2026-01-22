// Browser and Bluetooth API detection

export type BluetoothStatus =
  | 'available'
  | 'api-disabled'
  | 'permission-blocked'
  | 'no-adapter'
  | 'unsupported-browser';

export type BrowserInfo = {
  name: 'chrome' | 'edge' | 'brave' | 'firefox' | 'safari' | 'opera' | 'unknown';
  isSupported: boolean;
};

export function detectBrowser(): BrowserInfo {
  const ua = navigator.userAgent.toLowerCase();

  // Check for Brave (has navigator.brave)
  if ((navigator as any).brave) {
    return { name: 'brave', isSupported: true };
  }

  // Check user agent strings
  if (ua.includes('edg/')) {
    return { name: 'edge', isSupported: true };
  }

  if (ua.includes('opr/') || ua.includes('opera')) {
    return { name: 'opera', isSupported: true };
  }

  if (ua.includes('firefox')) {
    return { name: 'firefox', isSupported: false };
  }

  if (ua.includes('safari') && !ua.includes('chrome')) {
    return { name: 'safari', isSupported: false };
  }

  if (ua.includes('chrome')) {
    return { name: 'chrome', isSupported: true };
  }

  return { name: 'unknown', isSupported: false };
}

export async function checkBluetoothStatus(): Promise<BluetoothStatus> {
  // Check if API exists
  if (!('bluetooth' in navigator)) {
    return 'api-disabled';
  }

  // Check if getAvailability exists and works
  try {
    if (navigator.bluetooth.getAvailability) {
      const available = await navigator.bluetooth.getAvailability();
      if (!available) {
        return 'no-adapter';
      }
    }
  } catch {
    // getAvailability not supported or failed
  }

  // Check permissions
  try {
    const permission = await navigator.permissions.query({
      name: 'bluetooth' as PermissionName,
    });
    if (permission.state === 'denied') {
      return 'permission-blocked';
    }
  } catch {
    // permissions.query for bluetooth not supported
  }

  return 'available';
}

export function getInstructions(
  status: BluetoothStatus,
  browser: BrowserInfo
): { title: string; steps: string[] } {
  if (!browser.isSupported) {
    return {
      title: `${capitalize(browser.name)} doesn't support Web Bluetooth`,
      steps: [
        'Web Bluetooth is only available in Chromium-based browsers',
        'Please use Chrome, Edge, or Brave instead',
        'On mobile, use Chrome for Android',
      ],
    };
  }

  if (status === 'api-disabled') {
    if (browser.name === 'brave') {
      return {
        title: 'Web Bluetooth is disabled in Brave',
        steps: [
          'Go to brave://flags/#brave-web-bluetooth-api',
          'Set "Web Bluetooth API" to Enabled',
          'Restart Brave',
        ],
      };
    }

    return {
      title: 'Web Bluetooth API is disabled',
      steps: [
        'Go to chrome://flags/#enable-experimental-web-platform-features',
        'Set "Experimental Web Platform features" to Enabled',
        'Restart your browser',
      ],
    };
  }

  if (status === 'permission-blocked') {
    return {
      title: 'Bluetooth permission blocked',
      steps: [
        'Click the lock/tune icon in the address bar',
        'Find "Bluetooth" in the permissions list',
        'Change it to "Allow"',
        'Refresh this page',
      ],
    };
  }

  if (status === 'no-adapter') {
    return {
      title: 'No Bluetooth adapter found',
      steps: [
        'Make sure your computer has Bluetooth hardware',
        'Check that Bluetooth is enabled in Windows Settings',
        'Ensure Bluetooth drivers are installed',
        'Try restarting the Bluetooth service',
      ],
    };
  }

  return {
    title: 'Bluetooth is ready',
    steps: [],
  };
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
