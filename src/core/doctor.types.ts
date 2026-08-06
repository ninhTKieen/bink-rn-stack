import type { ProjectDetection } from '@/core/detect-project.types.js';
import type { GenerationManifest } from '@/core/generation-manifest.types.js';

export type DoctorCheckStatus = 'pass' | 'warning' | 'error';

export interface DoctorCheck {
  id: string;
  status: DoctorCheckStatus;
  title: string;
  message: string;
  details: string[];
}

export interface DoctorSummary {
  passed: number;
  warnings: number;
  errors: number;
}

export interface DoctorReport {
  project: ProjectDetection;
  manifest?: GenerationManifest;
  checks: DoctorCheck[];
  summary: DoctorSummary;
  healthy: boolean;
}

export interface TrackedFileAudit {
  total: number;
  healthy: string[];
  missing: string[];
  modified: string[];
  unsafe: string[];
}
