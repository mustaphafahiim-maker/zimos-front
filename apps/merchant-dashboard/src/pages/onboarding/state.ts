import type { ProductMedia } from "@store-builder/api-client";
import type { Category, Currency, StepId } from "./data";

export interface WizardState {
  step: StepId;
  skipped: StepId[];
  /** Workspace created (or adopted via deep link) by this run. */
  workspaceId?: string;
  basics?: { name: string; slug: string; currency: Currency; locale: "ar" | "en"; categories: Category[] };
  website?: {
    id: string;
    /** null = started blank */
    templateVersionId: string | null;
    label: string;
    /** false while a blank site still needs its home page */
    ready: boolean;
  };
  product?: {
    id: string;
    name: string;
    variantId?: string;
    priceMinor?: number;
    media?: ProductMedia | null;
  };
  delivery?: { zoneId: string; rateId?: string; regionCodes: string[]; feeMinor: number };
  published?: { at: string };
}

export const initialState = (): WizardState => ({ step: "basics", skipped: [] });

export function storageKey(userId: string) {
  return `zimos.onboarding.${userId}`;
}

export function loadState(userId: string): WizardState | null {
  try {
    const raw = sessionStorage.getItem(storageKey(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as WizardState;
    return parsed && typeof parsed === "object" && parsed.step ? parsed : null;
  } catch {
    return null;
  }
}

export function saveState(userId: string, state: WizardState) {
  try {
    sessionStorage.setItem(storageKey(userId), JSON.stringify(state));
  } catch {
    /* storage unavailable — state still lives in React */
  }
}

export function clearState(userId: string) {
  try {
    sessionStorage.removeItem(storageKey(userId));
  } catch {
    /* ignore */
  }
}

export interface StepProps {
  state: WizardState;
  update: (patch: Partial<WizardState>) => void;
  /** Mark the current step complete and move on. */
  next: (patch?: Partial<WizardState>) => void;
  goTo: (step: StepId) => void;
  setSaving: (saving: boolean) => void;
  saving: boolean;
  formId: string;
}
