export interface Service {
  name: string;
  url: string;
}

export interface ServiceStatus {
  responseTime: number;
  statusCode: number;
  statusQuality: 'HEALTHY' | 'DEGRADED' | 'DOWN' | 'NO DATA';
  timestamp: string;
  aiDiagnosis?: string;
  trendPrediction?: string;
}

export interface ApiLog {
  id: number;
  service_name: string;
  response_time: number;
  status_code: number;
  status_quality: 'HEALTHY' | 'DEGRADED' | 'DOWN';
  payload: any;
  error_message?: string;
  created_at: Date;
}

export interface DashboardData {
  latest: Record<string, ServiceStatus>;
  history: Record<string, { time: string; value: number; status: string }[]>;
  uptime: Record<string, number>;
  allHealthy: boolean;
  lastUpdated: string;
}

export interface HealthResponse {
  status: 'HEALTHY' | 'DEGRADED' | 'DOWN' | 'ERROR';
  timestamp: string;
  services: Record<string, {
    status: string;
    response_time: number;
    last_checked: string | null;
  }>;
  endpoints: {
    dashboard: string;
    health: string;
    ping: string;
  };
}

export interface PingResponse {
  success: boolean;
  results: {
    service: string;
    status: string;
    responseTime: number;
    trendPrediction?: string;
  }[];
  timestamp: string;
}