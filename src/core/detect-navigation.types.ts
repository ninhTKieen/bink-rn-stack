import type { NavigationLibrary } from '@/modules/navigation.types.js';

export interface ExistingNavigationDetection {
  libraries: NavigationLibrary[];
  primary?: NavigationLibrary;
  evidence: Partial<Record<NavigationLibrary, string[]>>;
}
