import type {
  QuickAccessItem,
  WidgetKey,
  WidgetSize,
} from "@/types/doctor-widgets";

export type DoctorTheme = "light" | "dark";

export interface DoctorProfileLayout {
  displayName: string;
  photoUrl: string;
}

export interface UserLayout {
  widgetOrder: WidgetKey[];
  widgetSizes: Partial<
    Record<WidgetKey, WidgetSize>
  >;
  hiddenWidgetKeys: WidgetKey[];
  quickAccessItems: QuickAccessItem[];
  theme: DoctorTheme;
  doctorProfile: DoctorProfileLayout;
}

export interface WidgetMinimumSize {
  width: number;
  height: number;
}

export type WidgetShape =
  | "default"
  | "wide"
  | "stacked";

