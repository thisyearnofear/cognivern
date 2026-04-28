/**
 * Adaptive Polling Utilities
 * Optimizes polling intervals based on network conditions and battery status
 * for better mobile performance and battery life
 */

export interface PollingOptions {
  /** Default polling interval in milliseconds */
  defaultInterval: number;
  /** Minimum polling interval (fastest) */
  minInterval?: number;
  /** Maximum polling interval (slowest) */
  maxInterval?: number;
  /** Whether to adapt based on network conditions */
  adaptToNetwork?: boolean;
  /** Whether to adapt based on battery level */
  adaptToBattery?: boolean;
}

export interface PollingState {
  interval: number;
  reason: string;
  lastUpdate: number;
}

/**
 * Get current network effective type
 */
const getEffectiveConnectionType = (): string => {
  if (typeof window === 'undefined' || !('connection' in navigator)) {
    return '4g';
  }

  const connection = navigator.connection as any;
  return connection.effectiveType || '4g';
};

/**
 * Check if save-data mode is enabled
 */
const isSaveDataEnabled = (): boolean => {
  if (typeof window === 'undefined' || !('connection' in navigator)) {
    return false;
  }

  const connection = navigator.connection as any;
  return connection.saveData || false;
};

/**
 * Get current battery level and charging status
 */
const getBatteryInfo = async (): Promise<{
  level: number;
  charging: boolean;
}> => {
  if (typeof window === 'undefined' || !('getBattery' in navigator)) {
    return { level: 1, charging: true };
  }

  try {
    const battery = await (navigator as any).getBattery();
    return {
      level: battery.level,
      charging: battery.charging,
    };
  } catch {
    return { level: 1, charging: true };
  }
};

/**
 * Calculate optimal polling interval based on conditions
 */
export const calculateOptimalInterval = async (
  options: PollingOptions
): Promise<PollingState> => {
  const {
    defaultInterval,
    minInterval = defaultInterval / 4,
    maxInterval = defaultInterval * 4,
    adaptToNetwork = true,
    adaptToBattery = true,
  } = options;

  let interval = defaultInterval;
  let reason = 'default';

  // Network-based adaptation
  if (adaptToNetwork) {
    const effectiveType = getEffectiveConnectionType();
    const saveData = isSaveDataEnabled();

    if (saveData) {
      interval = Math.min(maxInterval, defaultInterval * 4);
      reason = 'save-data mode enabled';
    } else {
      switch (effectiveType) {
        case '2g':
          interval = Math.min(maxInterval, defaultInterval * 3);
          reason = '2G network (slow connection)';
          break;
        case 'slow-2g':
          interval = Math.min(maxInterval, defaultInterval * 4);
          reason = 'slow-2G network (very slow connection)';
          break;
        case '3g':
          interval = Math.min(maxInterval, defaultInterval * 2);
          reason = '3G network (moderate connection)';
          break;
        case '4g':
        case '5g':
        default:
          // Use default or faster for good connections
          interval = defaultInterval;
          reason = `${effectiveType} network (good connection)`;
          break;
      }
    }
  }

  // Battery-based adaptation
  if (adaptToBattery) {
    const battery = await getBatteryInfo();

    if (!battery.charging && battery.level < 0.2) {
      // Low battery, not charging - reduce polling frequency
      const lowBatteryInterval = Math.min(maxInterval, interval * 2);
      if (lowBatteryInterval > interval) {
        interval = lowBatteryInterval;
        reason = `low battery (${Math.round(battery.level * 100)}%)`;
      }
    } else if (battery.charging) {
      // Device is charging - can poll more frequently if needed
      const chargingInterval = Math.max(minInterval, interval / 2);
      if (chargingInterval < interval && defaultInterval === interval) {
        interval = chargingInterval;
        reason = 'device charging';
      }
    }
  }

  // Ensure interval is within bounds
  interval = Math.max(minInterval, Math.min(maxInterval, interval));

  return {
    interval,
    reason,
    lastUpdate: Date.now(),
  };
};

/**
 * Create an adaptive polling hook
 */
export const createAdaptivePoller = (
  callback: () => Promise<void> | void,
  options: PollingOptions
) => {
  let timeoutId: NodeJS.Timeout | null = null;
  let isPolling = false;
  let currentInterval = options.defaultInterval;

  const poll = async () => {
    if (isPolling) return;

    isPolling = true;
    try {
      await callback();
    } catch (error) {
      console.warn('Polling error:', error);
    } finally {
      isPolling = false;
    }

    // Calculate next interval
    const state = await calculateOptimalInterval(options);
    currentInterval = state.interval;

    // Schedule next poll
    timeoutId = setTimeout(poll, currentInterval);
  };

  const start = async () => {
    // Calculate initial interval
    const state = await calculateOptimalInterval(options);
    currentInterval = state.interval;

    // Start polling
    timeoutId = setTimeout(poll, currentInterval);
  };

  const stop = () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
    isPolling = false;
  };

  const getState = () => ({
    isPolling,
    currentInterval,
    options,
  });

  return {
    start,
    stop,
    poll,
    getState,
  };
};

/**
 * React hook for adaptive polling
 */
export const useAdaptivePolling = (
  callback: () => Promise<void> | void,
  options: PollingOptions,
  dependencies: any[] = []
) => {
  const [pollingState, setPollingState] = useState<PollingState | null>(null);
  const callbackRef = useRef(callback);
  const pollerRef = useRef<ReturnType<typeof createAdaptivePoller> | null>(null);

  // Update callback ref
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    // Create poller
    pollerRef.current = createAdaptivePoller(
      () => callbackRef.current(),
      options
    );

    // Start polling
    pollerRef.current.start();

    // Update state periodically
    const stateInterval = setInterval(async () => {
      if (pollerRef.current) {
        const state = await calculateOptimalInterval(options);
        setPollingState(state);
      }
    }, 30000); // Update every 30 seconds

    return () => {
      if (pollerRef.current) {
        pollerRef.current.stop();
      }
      clearInterval(stateInterval);
    };
  }, [options.defaultInterval, options.adaptToNetwork, options.adaptToBattery, ...dependencies]);

  return pollingState;
};

// Default polling configurations
export const pollingConfigs = {
  dashboard: {
    defaultInterval: 30000, // 30 seconds
    minInterval: 10000, // 10 seconds
    maxInterval: 120000, // 2 minutes
    adaptToNetwork: true,
    adaptToBattery: true,
  },
  activity: {
    defaultInterval: 15000, // 15 seconds
    minInterval: 5000, // 5 seconds
    maxInterval: 60000, // 1 minute
    adaptToNetwork: true,
    adaptToBattery: true,
  },
  agent: {
    defaultInterval: 10000, // 10 seconds
    minInterval: 3000, // 3 seconds
    maxInterval: 30000, // 30 seconds
    adaptToNetwork: true,
    adaptToBattery: false, // More critical for agent monitoring
  },
} as const;

export type PollingConfig = keyof typeof pollingConfigs;
