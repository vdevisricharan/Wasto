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
  hardware_status: {
    connected: boolean;
    armed: boolean;
    state: string;
    servo_angle?: number;
    mode: 'PHYSICAL' | 'SIMULATED';
    port: string;
  };
  timestamp: number;
}

export interface WasteBatch {
  id: string;
  source_organization: string;
  status: 'CREATED' | 'PICKUP_SCHEDULED' | 'COLLECTED' | 'AT_FACILITY' | 'SORTED' | 'PROCESSED';
  estimated_kg: number | null;
  material_category: string;
  notes: string | null;
  created_at: number;
  updated_at: number;
  event_count?: number;
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
