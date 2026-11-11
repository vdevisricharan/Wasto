import {
  DashboardSummary,
  HealthResponse,
  MaterialClass,
  RoutingCategory,
} from '../types';

export const DESIGN_TOKENS = {
  canvas: '#F7F8F4',
  surface: '#FFFFFF',
  subtleSurface: '#EEF2EB',
  mainText: '#18251D',
  secondaryText: '#526158',
  border: '#DCE3DA',
  primary: '#245C3B',
  primaryHover: '#19452B',
  softGreen: '#E5EFE4',
  limeAccent: '#D9E8AA',
  warning: '#8A570B',
  error: '#B33D35',
  information: '#315E8B',
} as const;

export const MATERIAL_CLASSES: MaterialClass[] = [
  'Aluminium',
  'Carton',
  'Glass',
  'Organic Waste',
  'Other Plastics',
  'Paper and Cardboard',
  'Plastic',
  'Textiles',
  'Wood',
];

export interface CategoryMeta {
  key: RoutingCategory;
  label: string;
  shortLabel: string;
  chuteLabel: string;
  servoAngle: string;
  description: string;
  barColor: string;
  badgeClasses: string;
  dotColor: string;
}

export const ROUTING_CATEGORY_META: Record<RoutingCategory, CategoryMeta> = {
  Organic: {
    key: 'Organic',
    label: 'Organic',
    shortLabel: 'Organic',
    chuteLabel: 'Chute 1 (45°)',
    servoAngle: '45°',
    description: 'Food scraps and compostable organic waste',
    barColor: '#245C3B',
    badgeClasses: 'bg-[#E5EFE4] text-[#19452B] border-[#C5DBC2]',
    dotColor: '#245C3B',
  },
  Recyclable: {
    key: 'Recyclable',
    label: 'Recyclable',
    shortLabel: 'Recyclable',
    chuteLabel: 'Chute 2 (90°)',
    servoAngle: '90°',
    description: 'Glass, metal, paper, cardboard, and clean plastic',
    barColor: '#315E8B',
    badgeClasses: 'bg-[#EFF5FA] text-[#23476B] border-[#C7D8EA]',
    dotColor: '#315E8B',
  },
  Residual: {
    key: 'Residual',
    label: 'Residual',
    shortLabel: 'Residual',
    chuteLabel: 'Chute 3 (135°)',
    servoAngle: '135°',
    description: 'Textiles, wood, and multi-layer plastics',
    barColor: '#8A570B',
    badgeClasses: 'bg-[#FDF7EC] text-[#754909] border-[#EAD4AA]',
    dotColor: '#8A570B',
  },
  'Unknown / Manual Review': {
    key: 'Unknown / Manual Review',
    label: 'Needs review',
    shortLabel: 'Needs review',
    chuteLabel: 'Hold (90° neutral)',
    servoAngle: '90° (Hold)',
    description: 'Held for manual inspection due to low confidence or ambiguity',
    barColor: '#B33D35',
    badgeClasses: 'bg-[#FDF2F1] text-[#962E27] border-[#EBC5C2]',
    dotColor: '#B33D35',
  },
};

export interface LifecycleStageMeta {
  key: string;
  label: string;
  shortLabel: string;
  nextHint: string;
  badgeClasses: string;
}

export const LIFECYCLE_STAGES_META: LifecycleStageMeta[] = [
  {
    key: 'CREATED',
    label: 'Registered',
    shortLabel: 'Registered',
    nextHint: 'Schedule pickup',
    badgeClasses: 'bg-[#EEF2EB] text-[#18251D] border-[#DCE3DA]',
  },
  {
    key: 'PICKUP_SCHEDULED',
    label: 'Pickup scheduled',
    shortLabel: 'Scheduled',
    nextHint: 'Confirm collection',
    badgeClasses: 'bg-[#EFF5FA] text-[#23476B] border-[#C7D8EA]',
  },
  {
    key: 'COLLECTED',
    label: 'Collected',
    shortLabel: 'Collected',
    nextHint: 'Confirm facility arrival',
    badgeClasses: 'bg-[#EFF5FA] text-[#23476B] border-[#C7D8EA]',
  },
  {
    key: 'AT_FACILITY',
    label: 'At facility',
    shortLabel: 'At facility',
    nextHint: 'Mark sorted',
    badgeClasses: 'bg-[#FDF7EC] text-[#754909] border-[#EAD4AA]',
  },
  {
    key: 'SORTED',
    label: 'Sorted',
    shortLabel: 'Sorted',
    nextHint: 'Record final processing',
    badgeClasses: 'bg-[#E5EFE4] text-[#19452B] border-[#C5DBC2]',
  },
  {
    key: 'PROCESSED',
    label: 'Processed',
    shortLabel: 'Processed',
    nextHint: 'Lifecycle complete',
    badgeClasses: 'bg-[#E5EFE4] text-[#19452B] border-[#C5DBC2]',
  },
];

export function getStageMeta(stage: string): LifecycleStageMeta {
  const found = LIFECYCLE_STAGES_META.find((s) => s.key === stage);
  if (found) return found;
  if (stage === 'IN_TRANSIT') {
    return {
      key: 'IN_TRANSIT',
      label: 'In transit',
      shortLabel: 'In transit',
      nextHint: 'Confirm facility arrival',
      badgeClasses: 'bg-[#EFF5FA] text-[#23476B] border-[#C7D8EA]',
    };
  }
  return {
    key: stage,
    label: stage.replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase()),
    shortLabel: stage,
    nextHint: 'Update stage',
    badgeClasses: 'bg-[#EEF2EB] text-[#18251D] border-[#DCE3DA]',
  };
}

export interface OperationalModeInfo {
  modeLabel: string;
  tone: 'primary' | 'info' | 'warning' | 'error' | 'neutral';
  apiReachable: boolean;
  mlReady: boolean;
  isDemoData: boolean;
  isSimulatedHw: boolean;
  hwConnected: boolean;
  hwArmed: boolean;
  hwState: string;
  hwPort: string;
  inferenceSummary: string;
  hardwareSummary: string;
  apiSummary: string;
  explanation: string;
}

export function deriveOperationalMode(
  apiHealth: HealthResponse | null,
  summary: DashboardSummary | null
): OperationalModeInfo {
  if (!apiHealth) {
    return {
      modeLabel: 'Checking connection…',
      tone: 'neutral',
      apiReachable: false,
      mlReady: false,
      isDemoData: false,
      isSimulatedHw: true,
      hwConnected: false,
      hwArmed: false,
      hwState: 'CHECKING',
      hwPort: '—',
      inferenceSummary: 'Checking model status',
      hardwareSummary: 'Checking controller status',
      apiSummary: 'Connecting to backend service…',
      explanation: 'Verifying connection to the Wasto API, model service, and hardware adapter.',
    };
  }

  const apiReachable = apiHealth.status !== 'OFFLINE_DEMO';
  const mlReady = Boolean(apiHealth.ml_model_ready);
  const hw = summary?.hardware_status ?? apiHealth.hardware_adapter;
  const hwMode = hw?.mode ?? 'SIMULATED';
  const hwConnected = Boolean(hw?.connected);
  const hwArmed = Boolean(hw?.armed);
  const hwState = hw?.state ?? 'DISCONNECTED';
  const hwPort = hw?.port ?? '—';
  const isSimulatedHw = hwMode === 'SIMULATED';

  if (!apiReachable) {
    return {
      modeLabel: 'Demo data · Simulated hardware',
      tone: 'warning',
      apiReachable: false,
      mlReady: false,
      isDemoData: true,
      isSimulatedHw: true,
      hwConnected: false,
      hwArmed: false,
      hwState: 'OFFLINE',
      hwPort: 'VIRTUAL',
      inferenceSummary: 'Deterministic demo fixtures (API offline)',
      hardwareSummary: 'Simulated controller (no backend connection)',
      apiSummary: 'Backend API unreachable',
      explanation:
        'The FastAPI backend is currently unreachable. Dashboard metrics and sample classification results use deterministic demo fixtures; physical actuation and saved history require a running backend.',
    };
  }

  if (mlReady && !isSimulatedHw && hwConnected) {
    return {
      modeLabel: 'Live model · Connected hardware',
      tone: 'primary',
      apiReachable: true,
      mlReady: true,
      isDemoData: false,
      isSimulatedHw: false,
      hwConnected: true,
      hwArmed,
      hwState,
      hwPort,
      inferenceSummary: 'MobileNetV3Large active (9 classes)',
      hardwareSummary: `Arduino Uno R3 connected on ${hwPort} (${hwArmed ? 'Armed' : 'Disarmed'})`,
      apiSummary: apiHealth.database_connected ? 'API & SQLite connected' : 'API connected (DB degraded)',
      explanation:
        'Running live MobileNetV3 image classification with a physical Arduino controller attached over serial UART.',
    };
  }

  if (mlReady && !isSimulatedHw && !hwConnected) {
    return {
      modeLabel: 'Live model · Hardware disconnected',
      tone: 'warning',
      apiReachable: true,
      mlReady: true,
      isDemoData: false,
      isSimulatedHw: false,
      hwConnected: false,
      hwArmed: false,
      hwState: 'DISCONNECTED',
      hwPort,
      inferenceSummary: 'MobileNetV3Large active (9 classes)',
      hardwareSummary: `Physical controller disconnected (${hwPort})`,
      apiSummary: apiHealth.database_connected ? 'API & SQLite connected' : 'API connected (DB degraded)',
      explanation:
        'Image classification runs on the live MobileNetV3 model, while the physical Arduino controller is not currently reachable on its serial port.',
    };
  }

  if (mlReady && isSimulatedHw) {
    return {
      modeLabel: 'Live model · Simulated hardware',
      tone: 'info',
      apiReachable: true,
      mlReady: true,
      isDemoData: false,
      isSimulatedHw: true,
      hwConnected,
      hwArmed,
      hwState,
      hwPort,
      inferenceSummary: 'MobileNetV3Large active (real inference)',
      hardwareSummary: `Simulated controller (${hwArmed ? 'Armed' : 'Disarmed'})`,
      apiSummary: apiHealth.database_connected ? 'API & SQLite connected' : 'API connected (DB degraded)',
      explanation:
        'Classifications are computed by the real MobileNetV3Large model and saved to SQLite. Servo actuation and bin fill telemetry use the software simulator because no physical Arduino is attached.',
    };
  }

  return {
    modeLabel: isSimulatedHw ? 'Model offline · Simulated hardware' : 'Model offline · Physical hardware',
    tone: 'error',
    apiReachable: true,
    mlReady: false,
    isDemoData: false,
    isSimulatedHw,
    hwConnected,
    hwArmed,
    hwState,
    hwPort,
    inferenceSummary: 'ML model not loaded on backend',
    hardwareSummary: isSimulatedHw
      ? `Simulated controller (${hwArmed ? 'Armed' : 'Disarmed'})`
      : `Arduino controller (${hwConnected ? 'Connected' : 'Disconnected'})`,
    apiSummary: apiHealth.database_connected ? 'API & SQLite connected' : 'API & DB degraded',
    explanation:
      'The backend API responded, but the MobileNetV3 model is not loaded. Image classification requests will return an error until the model is ready.',
  };
}
