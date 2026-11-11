import {
  PredictionResult,
  BatchPredictionResult,
  DashboardSummary,
  WasteBatch,
  BatchDetails,
  HealthResponse,
  HistoryResponse,
  ModelMetadata,
  HardwareStatus,
  MaterialClass,
  RoutingCategory,
} from '../types';

export const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

export async function fetchHealth(): Promise<HealthResponse> {
  try {
    const res = await fetch(`${API_BASE}/api/health`, { signal: AbortSignal.timeout(3000) });
    if (!res.ok) throw new Error('API degraded');
    return await res.json();
  } catch {
    return {
      status: 'OFFLINE_DEMO',
      service: 'Wasto Demo (Client Fallback)',
      version: '1.0.0',
      ml_model_ready: false,
      database_connected: false,
      hardware_adapter: {
        connected: false,
        armed: false,
        state: 'OFFLINE',
        mode: 'SIMULATED',
        port: 'VIRTUAL',
      },
    };
  }
}

export async function fetchDashboardSummary(): Promise<DashboardSummary> {
  try {
    const res = await fetch(`${API_BASE}/api/dashboard/summary`, { signal: AbortSignal.timeout(3000) });
    if (!res.ok) throw new Error('Dashboard API error');
    const data = await res.json();
    return { ...data, is_demo_fixture: false };
  } catch {
    return {
      total_predictions: 142,
      total_actuated_sorts: 118,
      material_distribution: {
        Glass: 45,
        'Paper and Cardboard': 38,
        Plastic: 24,
        'Organic Waste': 19,
        Aluminium: 10,
        Wood: 6,
      },
      routing_distribution: {
        Recyclable: 109,
        Organic: 19,
        Residual: 6,
        'Unknown / Manual Review': 8,
      },
      uncertain_predictions_count: 8,
      uncertainty_rate_pct: 5.6,
      total_waste_batches: 3,
      latest_telemetry: {
        distance_cm: 42.5,
        fill_pct: 57.5,
        timestamp: Date.now() / 1000,
        source: 'SIMULATED',
      },
      hardware_status: {
        connected: true,
        armed: true,
        state: 'READY',
        servo_angle: 90,
        mode: 'SIMULATED',
        port: 'VIRTUAL_COM',
      },
      timestamp: Date.now() / 1000,
      is_demo_fixture: true,
    };
  }
}

export async function fetchModelMetadata(): Promise<ModelMetadata | null> {
  try {
    const res = await fetch(`${API_BASE}/api/model/metadata`, { signal: AbortSignal.timeout(3000) });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function predictSingleImage(
  file: File,
  threshold = 0.6,
  margin = 0.15
): Promise<PredictionResult> {
  try {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch(
      `${API_BASE}/api/predict/single?threshold=${threshold}&ambiguity_margin=${margin}`,
      {
        method: 'POST',
        body: formData,
      }
    );
    if (!res.ok) {
      let detail = 'Classification failed';
      try {
        const err = await res.json();
        detail = err.detail || detail;
      } catch {
        // Keep generic message when body isn't JSON
      }
      throw new Error(detail);
    }
    const data = await res.json();
    return { ...data, is_demo_fixture: false };
  } catch (e: unknown) {
    if (e instanceof TypeError || (e instanceof Error && e.message.includes('Failed to fetch'))) {
      return getDemoPredictionFixture(file.name);
    }
    throw e;
  }
}

export async function predictBatchImages(files: File[]): Promise<BatchPredictionResult> {
  try {
    const formData = new FormData();
    files.forEach((f) => formData.append('files', f));
    const res = await fetch(`${API_BASE}/api/predict/batch`, {
      method: 'POST',
      body: formData,
    });
    if (!res.ok) {
      let detail = 'Batch classification failed';
      try {
        const err = await res.json();
        detail = err.detail || detail;
      } catch {
        // Ignore parse error
      }
      throw new Error(detail);
    }
    const data = await res.json();
    return { ...data, is_demo_fixture: false };
  } catch (e: unknown) {
    if (e instanceof TypeError || (e instanceof Error && e.message.includes('Failed to fetch'))) {
      const items = files.map((f) => ({
        ...getDemoPredictionFixture(f.name),
        status: 'SUCCESS' as const,
      }));
      const materialDist: Record<string, number> = {};
      const routingDist: Record<string, number> = {};
      items.forEach((item) => {
        materialDist[item.material_label] = (materialDist[item.material_label] || 0) + 1;
        routingDist[item.routing_category] = (routingDist[item.routing_category] || 0) + 1;
      });
      return {
        total_items: files.length,
        success_count: files.length,
        failure_count: 0,
        items,
        failures: [],
        aggregates: {
          material_distribution: materialDist,
          routing_distribution: routingDist,
        },
        total_latency_ms: items.reduce((sum, item) => sum + item.inference_latency_ms, 0),
        average_latency_ms:
          items.length > 0
            ? items.reduce((sum, item) => sum + item.inference_latency_ms, 0) / items.length
            : 0,
        is_demo_fixture: true,
      };
    }
    throw e;
  }
}

export async function fetchHistory(
  page = 1,
  pageSize = 15,
  material?: string,
  routing?: string,
  isUncertain?: boolean
): Promise<HistoryResponse> {
  try {
    let url = `${API_BASE}/api/history?page=${page}&page_size=${pageSize}`;
    if (material) url += `&material=${encodeURIComponent(material)}`;
    if (routing) url += `&routing=${encodeURIComponent(routing)}`;
    if (typeof isUncertain === 'boolean') url += `&is_uncertain=${isUncertain}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
    if (!res.ok) throw new Error('Failed to fetch history');
    const data = await res.json();
    return { ...data, unavailable: false };
  } catch {
    return {
      items: [],
      total: 0,
      page: 1,
      page_size: pageSize,
      total_pages: 1,
      unavailable: true,
    };
  }
}

export async function fetchDeviceStatus(): Promise<HardwareStatus | null> {
  try {
    const res = await fetch(`${API_BASE}/api/device/status`, { signal: AbortSignal.timeout(2500) });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function armDevice(): Promise<{ status: string; details: HardwareStatus }> {
  const res = await fetch(`${API_BASE}/api/device/arm`, { method: 'POST' });
  if (!res.ok) {
    let detail = 'Failed to arm controller';
    try {
      const err = await res.json();
      detail = err.detail || detail;
    } catch {
      // ignore
    }
    throw new Error(detail);
  }
  return await res.json();
}

export async function disarmDevice(): Promise<{ status: string; details: HardwareStatus }> {
  const res = await fetch(`${API_BASE}/api/device/disarm`, { method: 'POST' });
  if (!res.ok) {
    throw new Error('Failed to disarm controller');
  }
  return await res.json();
}

export async function actuateFlap(targetBin: string, holdMs = 1200, predictionId?: string): Promise<any> {
  const res = await fetch(`${API_BASE}/api/device/actuate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      target_bin: targetBin,
      hold_duration_ms: holdMs,
      prediction_id: predictionId,
    }),
  });
  if (!res.ok) {
    let detail = 'Actuation command failed';
    try {
      const err = await res.json();
      detail = err.detail || detail;
    } catch {
      // ignore
    }
    throw new Error(detail);
  }
  return await res.json();
}

const DEMO_BATCHES: BatchDetails[] = [
  {
    id: 'BATCH-DELHI-001',
    source_organization: 'IIIT Delhi — Academic Campus Block A',
    status: 'SORTED',
    estimated_kg: 145.5,
    material_category: 'Mixed Recyclables',
    notes: 'Clean collection from cafeteria and academic center bins',
    created_at: Date.now() / 1000 - 86400 * 2,
    updated_at: Date.now() / 1000 - 3600 * 4,
    event_count: 5,
    is_demo_fixture: true,
    timeline: [
      {
        id: 'EVT-001',
        stage: 'CREATED',
        timestamp: Date.now() / 1000 - 86400 * 2,
        actor: 'Campus Admin (R. Sharma)',
        location: 'IIIT Delhi Okhla Phase III',
        notes: 'Batch registered at central source bin #13',
        linked_prediction_id: null,
        linked_sorting_id: null,
      },
      {
        id: 'EVT-002',
        stage: 'PICKUP_SCHEDULED',
        timestamp: Date.now() / 1000 - 86400 * 1.8,
        actor: 'Wasto Logistics Hub',
        location: 'Okhla Dispatch Center',
        notes: 'Driver K. Singh assigned van DL-1Z-9821',
        linked_prediction_id: null,
        linked_sorting_id: null,
      },
      {
        id: 'EVT-003',
        stage: 'COLLECTED',
        timestamp: Date.now() / 1000 - 86400 * 1.5,
        actor: 'Driver (K. Singh)',
        location: 'IIIT Delhi Okhla Phase III',
        notes: 'Van loaded with certified tare weight 145.5 kg',
        linked_prediction_id: null,
        linked_sorting_id: null,
      },
      {
        id: 'EVT-004',
        stage: 'AT_FACILITY',
        timestamp: Date.now() / 1000 - 86400,
        actor: 'Facility In-charge (M. Verma)',
        location: 'Okhla MRF Sorting Unit 4',
        notes: 'Material received, weighed, and staged on conveyor #1',
        linked_prediction_id: null,
        linked_sorting_id: null,
      },
      {
        id: 'EVT-005',
        stage: 'SORTED',
        timestamp: Date.now() / 1000 - 3600 * 4,
        actor: 'Wasto Edge Optical Sorter',
        location: 'Conveyor Cell A',
        notes: 'Segregation completed via MobileNetV3 and chute routing',
        linked_prediction_id: null,
        linked_sorting_id: null,
      },
    ],
  },
  {
    id: 'BATCH-DELHI-002',
    source_organization: 'AIIMS Delhi — Administrative Complex',
    status: 'COLLECTED',
    estimated_kg: 88.0,
    material_category: 'Paper & Cardboard',
    notes: 'Office paper batches and dry packaging',
    created_at: Date.now() / 1000 - 86400,
    updated_at: Date.now() / 1000 - 3600 * 2,
    event_count: 3,
    is_demo_fixture: true,
    timeline: [
      {
        id: 'EVT-006',
        stage: 'CREATED',
        timestamp: Date.now() / 1000 - 86400,
        actor: 'Facility Officer (AIIMS)',
        location: 'AIIMS Ansari Nagar',
        notes: 'Administrative paper batch tagged',
        linked_prediction_id: null,
        linked_sorting_id: null,
      },
      {
        id: 'EVT-007',
        stage: 'PICKUP_SCHEDULED',
        timestamp: Date.now() / 1000 - 86400 * 0.8,
        actor: 'Wasto Logistics Hub',
        location: 'South Delhi Center',
        notes: 'Pickup scheduled for afternoon run',
        linked_prediction_id: null,
        linked_sorting_id: null,
      },
      {
        id: 'EVT-008',
        stage: 'COLLECTED',
        timestamp: Date.now() / 1000 - 3600 * 2,
        actor: 'Driver (A. Kumar)',
        location: 'AIIMS Ansari Nagar',
        notes: 'Picked up and en route to recycling center',
        linked_prediction_id: null,
        linked_sorting_id: null,
      },
    ],
  },
];

export async function fetchWasteBatches(): Promise<WasteBatch[]> {
  try {
    const res = await fetch(`${API_BASE}/api/tracking/batches`, { signal: AbortSignal.timeout(3000) });
    if (!res.ok) throw new Error('Failed to fetch batches');
    const data = await res.json();
    return (data.batches || []).map((b: WasteBatch) => ({ ...b, is_demo_fixture: false }));
  } catch {
    return DEMO_BATCHES.map(({ timeline: _t, ...batch }) => batch);
  }
}

export async function fetchBatchDetails(batchId: string): Promise<BatchDetails> {
  try {
    const res = await fetch(`${API_BASE}/api/tracking/batches/${encodeURIComponent(batchId)}`, {
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) throw new Error('Batch not found');
    const data = await res.json();
    return { ...data, is_demo_fixture: false };
  } catch (e: unknown) {
    const demo = DEMO_BATCHES.find((b) => b.id === batchId);
    if (demo && (e instanceof TypeError || (e instanceof Error && e.message.includes('Failed to fetch')) || (e instanceof Error && e.name === 'TimeoutError'))) {
      return demo;
    }
    throw e instanceof Error ? e : new Error('Unable to load batch details');
  }
}

export async function createWasteBatch(batch: {
  source_organization: string;
  material_category: string;
  estimated_kg?: number;
  notes?: string;
}): Promise<any> {
  try {
    const res = await fetch(`${API_BASE}/api/tracking/batches`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(batch),
    });
    if (!res.ok) {
      let detail = 'Failed to create batch';
      try {
        const err = await res.json();
        detail = err.detail || detail;
      } catch {
        // ignore
      }
      throw new Error(detail);
    }
    return await res.json();
  } catch (e: unknown) {
    if (e instanceof TypeError || (e instanceof Error && e.message.includes('Failed to fetch'))) {
      throw new Error('Backend API unreachable — batches cannot be created while offline.');
    }
    throw e instanceof Error ? e : new Error('Failed to create batch');
  }
}

export async function addTrackingEvent(
  batchId: string,
  event: {
    stage: string;
    actor: string;
    location?: string;
    notes?: string;
  }
): Promise<any> {
  try {
    const res = await fetch(`${API_BASE}/api/tracking/batches/${encodeURIComponent(batchId)}/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(event),
    });
    if (!res.ok) {
      let detail = 'Failed to add tracking event';
      try {
        const err = await res.json();
        detail = err.detail || detail;
      } catch {
        // ignore
      }
      throw new Error(detail);
    }
    return await res.json();
  } catch (e: unknown) {
    if (e instanceof TypeError || (e instanceof Error && e.message.includes('Failed to fetch'))) {
      throw new Error('Backend API unreachable — stage updates cannot be saved while offline.');
    }
    throw e instanceof Error ? e : new Error('Failed to add tracking event');
  }
}

// Deterministic fixture used strictly when the API server is unreachable
function getDemoPredictionFixture(filename: string): PredictionResult {
  const lower = filename.toLowerCase();
  let material: MaterialClass = 'Glass';
  let routing: RoutingCategory = 'Recyclable';
  let guidance = 'Rinse lightly and place in dry recyclables bin.';

  if (lower.includes('plastic')) {
    material = 'Plastic';
    routing = 'Recyclable';
    guidance = 'Empty container and place in clean plastics recycling.';
  } else if (lower.includes('organic') || lower.includes('leaf') || lower.includes('food') || lower.includes('scrap')) {
    material = 'Organic Waste';
    routing = 'Organic';
    guidance = 'Place in the compost bin for biological decomposition.';
  } else if (lower.includes('paper') || lower.includes('cardboard')) {
    material = 'Paper and Cardboard';
    routing = 'Recyclable';
    guidance = 'Flatten and keep dry; place with clean paper recycling.';
  } else if (lower.includes('metal') || lower.includes('alum')) {
    material = 'Aluminium';
    routing = 'Recyclable';
    guidance = 'Rinse can and place in metals recycling bin.';
  }

  return {
    prediction_id: `demo_${Math.random().toString(36).substring(2, 9)}`,
    filename,
    material_label: material,
    confidence: 0.942,
    scores: {
      Aluminium: material === 'Aluminium' ? 0.942 : 0.01,
      Carton: 0.005,
      Glass: material === 'Glass' ? 0.942 : 0.01,
      'Organic Waste': material === 'Organic Waste' ? 0.942 : 0.005,
      'Other Plastics': 0.008,
      'Paper and Cardboard': material === 'Paper and Cardboard' ? 0.942 : 0.005,
      Plastic: material === 'Plastic' ? 0.942 : 0.01,
      Textiles: 0.003,
      Wood: 0.005,
    },
    routing_category: routing,
    is_uncertain: false,
    uncertainty_reason: null,
    disposal_guidance: guidance,
    routing_policy_version: 'v1.0 (Demo fixture)',
    inference_latency_ms: 198.4,
    timestamp: Date.now() / 1000,
    is_demo_fixture: true,
  };
}
