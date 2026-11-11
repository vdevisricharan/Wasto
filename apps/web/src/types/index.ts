export type MaterialClass =
  | 'Aluminium'
  | 'Carton'
  | 'Glass'
  | 'Organic Waste'
  | 'Other Plastics'
  | 'Paper and Cardboard'
  | 'Plastic'
  | 'Textiles'
  | 'Wood';

export type RoutingCategory =
  | 'Organic'
  | 'Recyclable'
  | 'Residual'
  | 'Unknown / Manual Review';

export interface HardwareStatus {
  connected: boolean;
  armed: boolean;
  state: string;
  servo_angle?: number;
  mode: 'PHYSICAL' | 'SIMULATED';
  port: string;
}

export interface HealthResponse {
  status: string;
  service: string;
  version: string;
  ml_model_ready: boolean;
  database_connected: boolean;
  hardware_adapter: HardwareStatus;
  timestamp?: number;
}

export interface ModelMetadata {
  model_name: string;
  version: string;
  input_shape: number[];
  classes: string[];
  num_classes: number;
  checksum_sha256: string | null;
  status: string;
  error_detail: string | null;
  routing_policy_version: string;
  thresholds: {
    confidence_threshold: number;
    ambiguity_margin: number;
  };
}

export interface PredictionResult {
  prediction_id: string;
  filename: string;
  material_label: MaterialClass;
  confidence: number;
  scores: Record<string, number>;
  routing_category: RoutingCategory;
  is_uncertain: boolean;
  uncertainty_reason: string | null;
  disposal_guidance: string;
  routing_policy_version: string;
  inference_latency_ms: number;
  timestamp: number;
  is_demo_fixture?: boolean;
}

export interface BatchItemResult extends PredictionResult {
  status: 'SUCCESS';
}

export interface BatchFailure {
  filename: string;
  status: 'FAILED';
  error: string;
}

export interface BatchPredictionResult {
  total_items: number;
  success_count: number;
  failure_count: number;
  items: BatchItemResult[];
  failures: BatchFailure[];
  aggregates: {
    material_distribution: Record<string, number>;
    routing_distribution: Record<string, number>;
  };
  total_latency_ms: number;
  average_latency_ms: number;
  is_demo_fixture?: boolean;
}

export interface DashboardSummary {
  total_predictions: number;
  total_actuated_sorts: number;
  material_distribution: Record<string, number>;
  routing_distribution: Record<string, number>;
  uncertain_predictions_count: number;
  uncertainty_rate_pct: number;
  total_waste_batches: number;
  latest_telemetry: {
    distance_cm: number;
    fill_pct: number;
    timestamp: number;
    source: 'PHYSICAL' | 'SIMULATED';
  } | null;
  hardware_status: HardwareStatus;
  timestamp: number;
  is_demo_fixture?: boolean;
}

export interface HistoryItem {
  id: string;
  prediction_id?: string;
  timestamp: number;
  filename: string;
  material_label: MaterialClass | string;
  confidence: number;
  routing_category: RoutingCategory;
  is_uncertain: boolean;
  uncertainty_reason: string | null;
  scores: Record<string, number>;
  latency_ms: number;
  source_mode: string;
}

export interface HistoryResponse {
  items: HistoryItem[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
  unavailable?: boolean;
}

export type BatchStatus =
  | 'CREATED'
  | 'PICKUP_SCHEDULED'
  | 'COLLECTED'
  | 'AT_FACILITY'
  | 'SORTED'
  | 'PROCESSED'
  | 'IN_TRANSIT';

export interface WasteBatch {
  id: string;
  source_organization: string;
  status: BatchStatus | string;
  estimated_kg: number | null;
  material_category: string;
  notes: string | null;
  created_at: number;
  updated_at: number;
  event_count?: number;
  is_demo_fixture?: boolean;
}

export interface TrackingEvent {
  id: string;
  batch_id?: string;
  stage: string;
  timestamp: number;
  actor: string;
  location: string | null;
  notes: string | null;
  linked_prediction_id: string | null;
  linked_sorting_id: string | null;
}

export interface BatchDetails extends WasteBatch {
  timeline: TrackingEvent[];
}
