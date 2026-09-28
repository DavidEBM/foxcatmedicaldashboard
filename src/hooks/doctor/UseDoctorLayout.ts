"use client";

import {
  useCallback,
  useEffect,
  useState,
} from "react";

import type {
  QuickAccessItem,
  WidgetKey,
  WidgetSize,
} from "@/types/doctor-widgets";

import type {
  DoctorProfileLayout,
  DoctorTheme,
  UserLayout,
} from "@/types/doctor-layout";

import {
  normalizeQuickAccessItems,
  normalizeWidgetOrder,
} from "@/lib/doctor/doctor-widgets";

import {
  getUserLayout,
  saveUserLayout,
} from "@/services/firebase/user-layout.service";

interface UseDoctorLayoutOptions {
  userId?: string | null;

  defaultWidgetOrder: WidgetKey[];

  widgetCatalog: Record<
    WidgetKey,
    {
      key: WidgetKey;
      label: string;
      description: string;
      shortcutDescription: string;
    }
  >;

  defaultQuickAccess: QuickAccessItem[];

  initialTheme?: DoctorTheme;
}

export function useDoctorLayout({
  userId,
  defaultWidgetOrder,
  widgetCatalog,
  defaultQuickAccess,
  initialTheme = "light",
}: UseDoctorLayoutOptions) {
  const [layoutOrder, setLayoutOrder] =
    useState<WidgetKey[]>(
      defaultWidgetOrder
    );

  const [
    persistedLayoutOrder,
    setPersistedLayoutOrder,
  ] = useState<WidgetKey[]>(
    defaultWidgetOrder
  );

  const [widgetSizes, setWidgetSizes] =
    useState<
      Partial<
        Record<
          WidgetKey,
          WidgetSize
        >
      >
    >({});

  const [
    persistedWidgetSizes,
    setPersistedWidgetSizes,
  ] = useState<
    Partial<
      Record<
        WidgetKey,
        WidgetSize
      >
    >
  >({});

  const [
    hiddenWidgetKeys,
    setHiddenWidgetKeys,
  ] = useState<WidgetKey[]>([]);

  const [
    quickAccessItems,
    setQuickAccessItems,
  ] = useState<QuickAccessItem[]>(
    normalizeQuickAccessItems(
      defaultQuickAccess,
      widgetCatalog
    )
  );

  const [theme, setTheme] =
    useState<DoctorTheme>(
      initialTheme
    );

  const [
    doctorProfile,
    setDoctorProfile,
  ] = useState<DoctorProfileLayout>({
    displayName: "",
    photoUrl: "",
  });

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    saving,
    setSaving,
  ] = useState(false);

  /* ---------------------------------------------------------------------- */
  /* Theme                                                                  */
  /* ---------------------------------------------------------------------- */

  const applyTheme = useCallback(
    (nextTheme: DoctorTheme) => {
      setTheme(nextTheme);

      if (
        typeof window !==
        "undefined"
      ) {
        localStorage.setItem(
          "foxcat-theme",
          nextTheme
        );
      }
    },
    []
  );

  /* ---------------------------------------------------------------------- */
  /* Load                                                                    */
  /* ---------------------------------------------------------------------- */

  const loadLayout =
    useCallback(async () => {
      if (!userId) {
        const localTheme =
          typeof window !==
          "undefined"
            ? (localStorage.getItem(
                "foxcat-theme"
              ) as DoctorTheme | null)
            : null;

        setTheme(
          localTheme === "dark"
            ? "dark"
            : "light"
        );

        setLoading(false);
        return;
      }

      try {
        setLoading(true);

        const data =
          await getUserLayout(
            userId
          );

        if (!data) {
          const localTheme =
            typeof window !==
            "undefined"
              ? (localStorage.getItem(
                  "foxcat-theme"
                ) as DoctorTheme | null)
              : null;

          const fallbackTheme =
            localTheme === "dark"
              ? "dark"
              : "light";

          setLayoutOrder(
            defaultWidgetOrder
          );

          setPersistedLayoutOrder(
            defaultWidgetOrder
          );

          setWidgetSizes({});
          setPersistedWidgetSizes(
            {}
          );

          setHiddenWidgetKeys([]);

          setQuickAccessItems(
            normalizeQuickAccessItems(
              defaultQuickAccess,
              widgetCatalog
            )
          );

          setDoctorProfile({
            displayName: "",
            photoUrl: "",
          });

          applyTheme(
            fallbackTheme
          );

          return;
        }

        const normalizedOrder =
          normalizeWidgetOrder(
            data.widgetOrder ?? [],
            defaultWidgetOrder
          );

        const sizes =
          data.widgetSizes || {};

        const hidden =
          Array.isArray(
            data.hiddenWidgetKeys
          )
            ? data.hiddenWidgetKeys
            : [];

        const quickAccess =
          Array.isArray(
            data.quickAccessItems
          ) &&
          data.quickAccessItems.length
            ? normalizeQuickAccessItems(
                data.quickAccessItems,
                widgetCatalog
              )
            : normalizeQuickAccessItems(
                defaultQuickAccess,
                widgetCatalog
              );

        const savedTheme =
          data.theme === "dark"
            ? "dark"
            : data.theme === "light"
              ? "light"
              : (
                  typeof window !==
                  "undefined"
                    ? localStorage.getItem(
                        "foxcat-theme"
                      )
                    : null
                ) === "dark"
                ? "dark"
                : "light";

        setLayoutOrder(
          normalizedOrder
        );

        setPersistedLayoutOrder(
          normalizedOrder
        );

        setWidgetSizes(
          sizes
        );

        setPersistedWidgetSizes(
          sizes
        );

        setHiddenWidgetKeys(
          hidden
        );

        setQuickAccessItems(
          quickAccess
        );

        setDoctorProfile({
          displayName:
            String(
              data.doctorProfile
                ?.displayName || ""
            ).trim(),

          photoUrl:
            String(
              data.doctorProfile
                ?.photoUrl || ""
            ).trim(),
        });

        applyTheme(
          savedTheme
        );
      } catch (error) {
        console.error(
          "Error cargando layout del usuario:",
          error
        );

        setLayoutOrder(
          defaultWidgetOrder
        );

        setPersistedLayoutOrder(
          defaultWidgetOrder
        );

        setWidgetSizes({});
        setPersistedWidgetSizes(
          {}
        );
        setHiddenWidgetKeys([]);

        setQuickAccessItems(
          normalizeQuickAccessItems(
            defaultQuickAccess,
            widgetCatalog
          )
        );

        setDoctorProfile({
          displayName: "",
          photoUrl: "",
        });
      } finally {
        setLoading(false);
      }
    }, [
      userId,
      defaultWidgetOrder,
      widgetCatalog,
      defaultQuickAccess,
      applyTheme,
    ]);

  useEffect(() => {
    void loadLayout();
  }, [loadLayout]);

  /* ---------------------------------------------------------------------- */
  /* Save                                                                    */
  /* ---------------------------------------------------------------------- */

  const saveLayout =
    useCallback(async () => {
      if (!userId) {
        return;
      }

      try {
        setSaving(true);

        const layout: Partial<UserLayout> =
          {
            widgetOrder:
              layoutOrder,

            widgetSizes:
              widgetSizes,

            hiddenWidgetKeys:
              hiddenWidgetKeys,

            quickAccessItems:
              quickAccessItems,

            theme,

            doctorProfile,
          };

        await saveUserLayout(
          userId,
          layout
        );

        setPersistedLayoutOrder(
          layoutOrder
        );

        setPersistedWidgetSizes(
          widgetSizes
        );
      } finally {
        setSaving(false);
      }
    }, [
      userId,
      layoutOrder,
      widgetSizes,
      hiddenWidgetKeys,
      quickAccessItems,
      theme,
      doctorProfile,
    ]);

  /* ---------------------------------------------------------------------- */
  /* Cancel                                                                  */
  /* ---------------------------------------------------------------------- */

  const cancelLayoutChanges =
    useCallback(() => {
      setLayoutOrder(
        persistedLayoutOrder
      );

      setWidgetSizes(
        persistedWidgetSizes
      );
    }, [
      persistedLayoutOrder,
      persistedWidgetSizes,
    ]);

  return {
    layoutOrder,
    setLayoutOrder,

    persistedLayoutOrder,

    widgetSizes,
    setWidgetSizes,

    persistedWidgetSizes,

    hiddenWidgetKeys,
    setHiddenWidgetKeys,

    quickAccessItems,
    setQuickAccessItems,

    theme,
    applyTheme,

    doctorProfile,
    setDoctorProfile,

    loading,
    saving,

    loadLayout,
    saveLayout,
    cancelLayoutChanges,
  };
}

