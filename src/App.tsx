import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BellRing, X } from 'lucide-react';
import { DESTINATIONS } from './data/destinations.ts';
import type {
  DailyFareOffer,
  LiveTravelData,
  PassengerGroup,
  PriceAlert,
  PushNotificationLog,
  TripType,
  VehicleConfig,
} from './types/travel.ts';
import {
  addDaysIso,
  formatArs,
  getDefaultDepartureDateIso,
} from './utils/travelCalculations.ts';
import { TopBar } from './components/TopBar.tsx';
import type { ActiveTab } from './components/TopBar.tsx';
import { SearchWorkspaceBar } from './components/SearchWorkspaceBar.tsx';
import { ComparisonView } from './components/ComparisonView.tsx';
import { FareCalendarPanel } from './components/FareCalendarPanel.tsx';
import { FuelCalculatorPanel } from './components/FuelCalculatorPanel.tsx';
import { AlertsPushPanel } from './components/AlertsPushPanel.tsx';

const STORAGE_KEYS = {
  theme: 'rutacba-theme',
  alerts: 'rutacba-alerts-v1',
  logs: 'rutacba-push-logs-v1',
  sound: 'rutacba-push-sound',
};

function readInitialTheme(): boolean {
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.theme);
    if (saved === 'dark') return true;
    if (saved === 'light') return false;
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
  } catch {
    return false;
  }
}

function readStoredAlerts(): PriceAlert[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.alerts);
    return raw ? (JSON.parse(raw) as PriceAlert[]) : [];
  } catch {
    return [];
  }
}

function readStoredLogs(): PushNotificationLog[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.logs);
    return raw ? (JSON.parse(raw) as PushNotificationLog[]) : [];
  } catch {
    return [];
  }
}

function playAlertChime() {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();
    osc1.type = 'sine';
    osc2.type = 'sine';
    osc1.frequency.setValueAtTime(660, now);
    osc2.frequency.setValueAtTime(880, now + 0.11);
    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.12);
    osc2.start(now + 0.11);
    osc2.stop(now + 0.35);
  } catch {
    // ignore audio autoplay restrictions
  }
}

async function parseSafeJson(res: Response): Promise<unknown> {
  const rawText = await res.text();
  try {
    return JSON.parse(rawText);
  } catch {
    throw new Error(
      'El servidor devolvió una respuesta HTML inesperada (posible reinicio en curso). Tocá "Reintentar consulta en vivo".'
    );
  }
}

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('comparador');
  const [isDark, setIsDark] = useState<boolean>(readInitialTheme);

  const [selectedDestinationId, setSelectedDestinationId] = useState<string>('BUE');
  const [tripType, setTripType] = useState<TripType>('one_way');
  const [departureDate, setDepartureDate] = useState<string>(getDefaultDepartureDateIso);
  const [returnDate, setReturnDate] = useState<string>(() =>
    addDaysIso(getDefaultDepartureDateIso(), 5)
  );
  const [passengerGroup, setPassengerGroup] = useState<PassengerGroup>({
    adults: 1,
    childAges: [],
  });
  const [selectedAirlines, setSelectedAirlines] = useState<string[]>([]);
  const [maxStops, setMaxStops] = useState<number>(2);

  const [vehicleConfig, setVehicleConfig] = useState<VehicleConfig>({
    fuelType: 'nafta_super',
    consumptionPer100Km: 7.8,
    tankOrCylinderCapacity: 50,
    splitAcrossPassengers: true,
  });
  const [departureTimeCar, setDepartureTimeCar] = useState<string>('07:00');

  const [liveData, setLiveData] = useState<LiveTravelData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const [alerts, setAlerts] = useState<PriceAlert[]>(readStoredAlerts);
  const [pushLogs, setPushLogs] = useState<PushNotificationLog[]>(readStoredLogs);
  const [isCheckingAlerts, setIsCheckingAlerts] = useState<boolean>(false);
  const [activeToast, setActiveToast] = useState<PushNotificationLog | null>(null);
  const [draftAlertPrice, setDraftAlertPrice] = useState<number | null>(null);
  const [pushStatusMessage, setPushStatusMessage] = useState<string | null>(null);
  const [checkFeedback, setCheckFeedback] = useState<{
    type: 'info' | 'success' | 'error';
    text: string;
  } | null>(null);

  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => {
    try {
      return localStorage.getItem(STORAGE_KEYS.sound) !== 'false';
    } catch {
      return true;
    }
  });

  const swRegRef = useRef<ServiceWorkerRegistration | null>(null);

  const isEmbeddedIframe = useMemo(() => {
    try {
      return window.self !== window.top;
    } catch {
      return true;
    }
  }, []);

  const [pushPermission, setPushPermission] = useState<
    NotificationPermission | 'unsupported'
  >(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return 'unsupported';
    }
    return Notification.permission;
  });

  const currentDestination = useMemo(
    () =>
      DESTINATIONS.find((d) => d.id === selectedDestinationId) || DESTINATIONS[0],
    [selectedDestinationId]
  );

  // Register Service Worker for reliable Push Notifications
  useEffect(() => {
    if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js')
        .then((reg) => {
          swRegRef.current = reg;
        })
        .catch(() => {
          // Fallback to window.Notification + in-app push
        });
    }
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark);
    try {
      localStorage.setItem(STORAGE_KEYS.theme, isDark ? 'dark' : 'light');
    } catch {
      // ignore
    }
  }, [isDark]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.alerts, JSON.stringify(alerts));
    } catch {
      // ignore
    }
  }, [alerts]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.logs, JSON.stringify(pushLogs));
    } catch {
      // ignore
    }
  }, [pushLogs]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.sound, soundEnabled ? 'true' : 'false');
    } catch {
      // ignore
    }
  }, [soundEnabled]);

  const dispatchPushNotification = useCallback(
    (payload: {
      alertId: string;
      routeLabel: string;
      title: string;
      body: string;
      priceArs: number;
    }) => {
      const logEntry: PushNotificationLog = {
        id: `push-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        alertId: payload.alertId,
        routeLabel: payload.routeLabel,
        title: payload.title,
        body: payload.body,
        priceArs: payload.priceArs,
        timestampIso: new Date().toISOString(),
        read: false,
      };

      setPushLogs((prev) => [logEntry, ...prev].slice(0, 30));
      setActiveToast(logEntry);

      if (soundEnabled) {
        playAlertChime();
      }

      if (
        typeof window !== 'undefined' &&
        'Notification' in window &&
        Notification.permission === 'granted'
      ) {
        if (swRegRef.current && typeof swRegRef.current.showNotification === 'function') {
          swRegRef.current
            .showNotification(payload.title, {
              body: payload.body,
              tag: payload.alertId,
              renotify: true,
            } as NotificationOptions)
            .catch(() => {
              try {
                new Notification(payload.title, {
                  body: payload.body,
                  tag: payload.alertId,
                });
              } catch {
                // In-app toast already visible
              }
            });
        } else {
          try {
            new Notification(payload.title, {
              body: payload.body,
              tag: payload.alertId,
            });
          } catch {
            // In-app toast already visible
          }
        }
      }
    },
    [soundEnabled]
  );

  useEffect(() => {
    if (!activeToast) return;
    const timer = window.setTimeout(() => setActiveToast(null), 7000);
    return () => window.clearTimeout(timer);
  }, [activeToast]);

  const requestPushPermission = useCallback(async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      setPushPermission('unsupported');
      setPushStatusMessage(
        'Este navegador no soporta la API nativa de notificaciones; las alertas push en vivo de RutaCba se mostrarán dentro de la app.'
      );
      dispatchPushNotification({
        alertId: 'system-inapp',
        routeLabel: 'Córdoba (COR)',
        title: 'Alertas push activas dentro de RutaCba',
        body: 'Recibirás avisos visuales y sonoros al instante cuando detectemos bajas de precios.',
        priceArs: 0,
      });
      return;
    }

    try {
      const result = await Notification.requestPermission();
      setPushPermission(result);
      if (result === 'granted') {
        setPushStatusMessage(
          'Permiso concedido: recibirás notificaciones push del navegador y alertas en vivo dentro de la app.'
        );
        dispatchPushNotification({
          alertId: 'system-ready',
          routeLabel: 'Córdoba (COR)',
          title: 'Notificaciones push activadas en RutaCba',
          body: 'Te avisaremos al instante cuando detectemos ofertas en tus rutas y fechas guardadas.',
          priceArs: 0,
        });
      } else {
        setPushStatusMessage(
          isEmbeddedIframe
            ? 'El entorno embebido bloqueó las notificaciones nativas del sistema. Las alertas push dentro de la app (aviso visual, sonido e historial) ya están funcionando; abrí en una pestaña nueva para habilitar notificaciones del sistema.'
            : 'El permiso del navegador fue denegado. Habilitalo desde la configuración del sitio o usá las alertas en vivo dentro de la app.'
        );
        dispatchPushNotification({
          alertId: 'system-inapp-fallback',
          routeLabel: 'Córdoba (COR)',
          title: 'Alertas push en vivo activadas en la app',
          body: isEmbeddedIframe
            ? 'Modo vista previa: las alertas se muestran en la app con sonido. Abrí en pestaña nueva para notificaciones del sistema.'
            : 'Permiso del navegador bloqueado; recibirás los avisos directamente en RutaCba.',
          priceArs: 0,
        });
      }
    } catch {
      setPushStatusMessage(
        'No se pudo solicitar permiso nativo; las notificaciones push dentro de RutaCba siguen activas.'
      );
    }
  }, [dispatchPushNotification, isEmbeddedIframe]);

  const fetchComparison = useCallback(
    async (
      destId: string,
      mode: TripType,
      date: string,
      retDate: string,
      forceRefresh = false
    ) => {
      setIsLoading(true);
      setError(null);
      try {
        const res = await fetch('/api/compare-travel', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            destinationId: destId,
            tripType: mode,
            departureDate: date,
            returnDate: mode === 'round_trip' ? retDate : undefined,
            forceRefresh,
          }),
        });
        const payload = await parseSafeJson(res);
        if (!res.ok) {
          const errObj = payload as { error?: string };
          throw new Error(
            errObj?.error || 'Error al consultar el comparador en tiempo real.'
          );
        }
        const travelData = payload as LiveTravelData;
        setLiveData(travelData);

        setAlerts((prevAlerts) =>
          prevAlerts.map((alert) => {
            if (
              alert.status === 'pausada' ||
              alert.destinationId !== destId ||
              (alert.tripType || 'one_way') !== mode
            ) {
              return alert;
            }
            const matching = travelData.flights.filter((f) => {
              const airlineOk =
                alert.preferredAirlines.length === 0 ||
                alert.preferredAirlines.some(
                  (a) => a.toLowerCase() === f.airline.toLowerCase()
                );
              return airlineOk && f.stops <= alert.maxStops;
            });
            const best = matching[0] || travelData.flights[0];
            if (!best) return alert;

            if (best.priceArs <= alert.maxPriceArs && alert.pushEnabled) {
              if (alert.lastFoundPriceArs !== best.priceArs) {
                dispatchPushNotification({
                  alertId: alert.id,
                  routeLabel: `COR → ${alert.iata}`,
                  title: `Oferta COR → ${alert.destinationCity}: ${formatArs(best.priceArs)}`,
                  body: `${best.airline} (${best.stops === 0 ? 'Directo' : `${best.stops} escala`}) · ${mode === 'round_trip' ? 'Ida y vuelta' : 'Solo ida'} para el ${travelData.departureDate}.`,
                  priceArs: best.priceArs,
                });
              }
              return {
                ...alert,
                lastCheckedIso: new Date().toISOString(),
                lastFoundPriceArs: best.priceArs,
                status: 'oferta_detectada',
              };
            }

            return {
              ...alert,
              lastCheckedIso: new Date().toISOString(),
              lastFoundPriceArs: best.priceArs,
            };
          })
        );
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : 'No se pudo conectar con el servicio de precios.';
        setError(message);
      } finally {
        setIsLoading(false);
      }
    },
    [dispatchPushNotification]
  );

  useEffect(() => {
    fetchComparison(
      selectedDestinationId,
      tripType,
      departureDate,
      returnDate,
      false
    );
  }, [
    selectedDestinationId,
    tripType,
    departureDate,
    returnDate,
    fetchComparison,
  ]);

  const handleSelectDestination = (id: string) => {
    setSelectedDestinationId(id);
    setSelectedAirlines([]);
  };

  const handleChangeDepartureDate = (nextDate: string) => {
    setDepartureDate(nextDate);
    if (returnDate < nextDate) {
      setReturnDate(addDaysIso(nextDate, 5));
    }
  };

  const handleToggleAirline = (airline: string) => {
    setSelectedAirlines((prev) =>
      prev.includes(airline)
        ? prev.filter((a) => a !== airline)
        : [...prev, airline]
    );
  };

  const handleCreateAlert = (
    draft: Omit<PriceAlert, 'id' | 'createdAtIso' | 'status'>
  ) => {
    const newAlert: PriceAlert = {
      ...draft,
      id: `alert-${Date.now()}`,
      createdAtIso: new Date().toISOString(),
      status: 'activa',
    };
    setAlerts((prev) => [newAlert, ...prev]);
    dispatchPushNotification({
      alertId: newAlert.id,
      routeLabel: `COR → ${newAlert.iata}`,
      title: `Alerta activada: COR → ${newAlert.destinationCity}`,
      body: `Monitoreando tarifa final (${newAlert.tripType === 'round_trip' ? 'Ida y vuelta' : 'Solo ida'}) hasta ${formatArs(newAlert.maxPriceArs)} para el ${newAlert.targetDate}.`,
      priceArs: newAlert.maxPriceArs,
    });
  };

  const handleQuickCreateAlert = (suggestedMaxPrice: number) => {
    setDraftAlertPrice(suggestedMaxPrice);
    setActiveTab('alertas');
  };

  const handleCreateAlertFromCalendar = (
    day: DailyFareOffer,
    horizon: 30 | 60
  ) => {
    const newAlert: PriceAlert = {
      id: `alert-${Date.now()}`,
      destinationId: currentDestination.id,
      destinationCity: currentDestination.city,
      iata: currentDestination.iata,
      tripType,
      targetDate: day.date,
      returnDate: tripType === 'round_trip' ? addDaysIso(day.date, 5) : undefined,
      horizonDays: horizon,
      maxPriceArs: Math.round(day.cheapestFlightArs * 0.95),
      preferredAirlines: selectedAirlines,
      maxStops,
      pushEnabled: true,
      notifyOnDropPercent: 10,
      createdAtIso: new Date().toISOString(),
      lastFoundPriceArs: day.cheapestFlightArs,
      status: 'activa',
    };
    setAlerts((prev) => [newAlert, ...prev]);
    dispatchPushNotification({
      alertId: newAlert.id,
      routeLabel: `COR → ${newAlert.iata}`,
      title: `Alerta creada para el ${day.dayOfWeek} ${day.dayNumber} ${day.monthLabel}`,
      body: `Objetivo ${formatArs(newAlert.maxPriceArs)} (${tripType === 'round_trip' ? 'Ida y vuelta' : 'Solo ida'}) hacia ${currentDestination.city}.`,
      priceArs: newAlert.maxPriceArs,
    });
    setActiveTab('alertas');
  };

  const handleCheckAlertsLive = useCallback(async () => {
    const activeOnes = alerts.filter((a) => a.status !== 'pausada');
    if (activeOnes.length === 0) {
      setCheckFeedback({
        type: 'info',
        text: 'No hay alertas activas para verificar.',
      });
      return;
    }

    setIsCheckingAlerts(true);
    setCheckFeedback(null);
    try {
      const res = await fetch('/api/check-alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alerts: activeOnes }),
      });
      const payload = await parseSafeJson(res);
      if (!res.ok) {
        const errObj = payload as { error?: string };
        throw new Error(errObj?.error || 'Error al verificar alertas.');
      }

      const results = ((payload as { results?: unknown[] }).results || []) as Array<{
        alertId: string;
        foundPriceArs: number;
        airline: string;
        stops: number;
        targetDate: string;
        meetsThreshold: boolean;
        checkedAtIso: string;
      }>;

      let matchedCount = 0;

      setAlerts((prev) =>
        prev.map((a) => {
          const match = results.find((r) => r.alertId === a.id);
          if (!match) return a;
          if (match.meetsThreshold) {
            matchedCount += 1;
            if (a.pushEnabled) {
              dispatchPushNotification({
                alertId: a.id,
                routeLabel: `COR → ${a.iata}`,
                title: `¡Oferta encontrada hacia ${a.destinationCity}! ${formatArs(match.foundPriceArs)}`,
                body: `${match.airline} (${match.stops === 0 ? 'Directo' : `${match.stops} escala`}) para el ${match.targetDate}. Tu objetivo era ${formatArs(a.maxPriceArs)}.`,
                priceArs: match.foundPriceArs,
              });
            }
          }
          return {
            ...a,
            lastCheckedIso: match.checkedAtIso,
            lastFoundPriceArs: match.foundPriceArs,
            status: match.meetsThreshold ? 'oferta_detectada' : 'activa',
          };
        })
      );

      if (matchedCount > 0) {
        setCheckFeedback({
          type: 'success',
          text: `Verificación completada: se detectaron ${matchedCount} ${matchedCount === 1 ? 'alerta con oferta' : 'alertas con ofertas'} por debajo de tu precio objetivo.`,
        });
      } else if (results.length > 0) {
        const sample = results[0];
        setCheckFeedback({
          type: 'info',
          text: `Relevamiento en vivo completado (${results.length} ${results.length === 1 ? 'alerta' : 'alertas'}): mejor tarifa actual encontrada ${formatArs(sample.foundPriceArs)} (${sample.airline}, ${sample.targetDate}), todavía por encima del precio objetivo.`,
        });
      } else {
        setCheckFeedback({
          type: 'info',
          text: 'Verificación completada sin resultados nuevos.',
        });
      }
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'No se pudieron verificar las alertas.';
      setCheckFeedback({
        type: 'error',
        text: msg,
      });
    } finally {
      setIsCheckingAlerts(false);
    }
  }, [alerts, dispatchPushNotification]);

  // Automatic background alert polling every 3 minutes while active alerts exist
  useEffect(() => {
    const hasActive = alerts.some((a) => a.status !== 'pausada');
    if (!hasActive) return;
    const intervalId = window.setInterval(() => {
      handleCheckAlertsLive();
    }, 3 * 60 * 1000);
    return () => window.clearInterval(intervalId);
  }, [alerts, handleCheckAlertsLive]);

  const handleTestPushAlert = (alert: PriceAlert) => {
    const referencePrice = alert.lastFoundPriceArs || alert.maxPriceArs;
    dispatchPushNotification({
      alertId: alert.id,
      routeLabel: `COR → ${alert.iata}`,
      title: `Aviso Push · COR → ${alert.destinationCity}`,
      body: `Notificación activa para ${alert.tripType === 'round_trip' ? 'Ida y vuelta' : 'Solo ida'} (${alert.targetDate}). Objetivo: ${formatArs(alert.maxPriceArs)}${alert.lastFoundPriceArs ? ` · Último precio real: ${formatArs(alert.lastFoundPriceArs)}` : ''}.`,
      priceArs: referencePrice,
    });
  };

  const unreadPushCount = pushLogs.filter((l) => !l.read).length;

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-sky-50/90 via-slate-100/70 to-slate-100 dark:from-slate-950 dark:via-slate-950 dark:to-slate-900 text-slate-900 dark:text-slate-100">
      <TopBar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        onOpenNewAlert={() => {
          setDraftAlertPrice(
            liveData?.flights[0]
              ? Math.round(liveData.flights[0].priceArs * 0.9)
              : 95000
          );
          setActiveTab('alertas');
        }}
        unreadPushCount={unreadPushCount}
      />

      <main className="flex-1 w-full max-w-[1360px] mx-auto px-4 sm:px-6 py-6 sm:py-7 space-y-6">
        <div className="space-y-1.5">
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-slate-50 text-balance">
            Comparador real de viajes desde{' '}
            <span className="bg-gradient-to-r from-blue-600 via-sky-500 to-teal-500 dark:from-sky-400 dark:via-cyan-300 dark:to-emerald-400 bg-clip-text text-transparent">
              Córdoba Capital
            </span>
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 max-w-3xl">
            Precios finales vigentes en tiempo real desde la fecha y hora actual de vuelos, micros y combustible en ruta (solo ida o ida y vuelta) hacia Argentina y países limítrofes.
          </p>
        </div>

        <SearchWorkspaceBar
          selectedDestinationId={selectedDestinationId}
          onSelectDestination={handleSelectDestination}
          tripType={tripType}
          onChangeTripType={setTripType}
          departureDate={departureDate}
          onChangeDate={handleChangeDepartureDate}
          returnDate={returnDate}
          onChangeReturnDate={setReturnDate}
          passengerGroup={passengerGroup}
          onChangePassengerGroup={setPassengerGroup}
          selectedAirlines={selectedAirlines}
          onToggleAirline={handleToggleAirline}
          onClearAirlines={() => setSelectedAirlines([])}
          maxStops={maxStops}
          onChangeMaxStops={setMaxStops}
          isDark={isDark}
          onToggleDark={() => setIsDark((prev) => !prev)}
          pushPermission={pushPermission}
          onRequestPush={requestPushPermission}
          isLoading={isLoading}
          onForceRefresh={() =>
            fetchComparison(
              selectedDestinationId,
              tripType,
              departureDate,
              returnDate,
              true
            )
          }
          currentDestination={currentDestination}
        />

        {activeTab === 'comparador' && (
          <ComparisonView
            destination={currentDestination}
            tripType={tripType}
            liveData={liveData}
            isLoading={isLoading}
            error={error}
            onRetry={() =>
              fetchComparison(
                selectedDestinationId,
                tripType,
                departureDate,
                returnDate,
                true
              )
            }
            passengerGroup={passengerGroup}
            selectedAirlines={selectedAirlines}
            maxStops={maxStops}
            vehicleConfig={vehicleConfig}
            departureTimeCar={departureTimeCar}
            onGoToCalendar={() => setActiveTab('calendario')}
            onGoToFuel={() => setActiveTab('combustible')}
            onQuickCreateAlert={handleQuickCreateAlert}
          />
        )}

        {activeTab === 'calendario' && (
          <FareCalendarPanel
            destination={currentDestination}
            tripType={tripType}
            liveData={liveData}
            selectedDate={departureDate}
            onSelectDate={(newDate) => {
              handleChangeDepartureDate(newDate);
              setActiveTab('comparador');
            }}
            selectedAirlines={selectedAirlines}
            maxStops={maxStops}
            onCreateAlertForDay={handleCreateAlertFromCalendar}
          />
        )}

        {activeTab === 'combustible' && (
          <FuelCalculatorPanel
            destination={currentDestination}
            tripType={tripType}
            liveData={liveData}
            vehicleConfig={vehicleConfig}
            onChangeVehicle={setVehicleConfig}
            departureTimeCar={departureTimeCar}
            onChangeDepartureTimeCar={setDepartureTimeCar}
            passengerGroup={passengerGroup}
          />
        )}

        {activeTab === 'alertas' && (
          <AlertsPushPanel
            alerts={alerts}
            pushLogs={pushLogs}
            pushPermission={pushPermission}
            isEmbeddedIframe={isEmbeddedIframe}
            soundEnabled={soundEnabled}
            onToggleSound={() => setSoundEnabled((prev) => !prev)}
            pushStatusMessage={pushStatusMessage}
            checkFeedback={checkFeedback}
            onRequestPushPermission={requestPushPermission}
            onCreateAlert={handleCreateAlert}
            onToggleAlertStatus={(id) =>
              setAlerts((prev) =>
                prev.map((a) =>
                  a.id === id
                    ? {
                        ...a,
                        status: a.status === 'pausada' ? 'activa' : 'pausada',
                      }
                    : a
                )
              )
            }
            onDeleteAlert={(id) =>
              setAlerts((prev) => prev.filter((a) => a.id !== id))
            }
            onCheckAlertsLive={handleCheckAlertsLive}
            onTestPushAlert={handleTestPushAlert}
            isCheckingAlerts={isCheckingAlerts}
            defaultDestinationId={selectedDestinationId}
            defaultTripType={tripType}
            defaultTargetDate={departureDate}
            defaultReturnDate={returnDate}
            defaultMaxPrice={
              draftAlertPrice ??
              (liveData?.flights[0]
                ? Math.round(liveData.flights[0].priceArs * 0.9)
                : 95000)
            }
            defaultAirlines={selectedAirlines}
            defaultMaxStops={maxStops}
            onMarkLogsRead={() =>
              setPushLogs((prev) => prev.map((l) => ({ ...l, read: true })))
            }
          />
        )}
      </main>

      <footer className="border-t border-slate-200/80 dark:border-slate-800/80 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm mt-10">
        <div className="max-w-[1360px] mx-auto px-4 sm:px-6 py-4 flex flex-wrap items-center justify-between gap-4 text-xs text-slate-500 dark:text-slate-400">
          <span>
            RutaCba · Comparador multimodal desde Córdoba Capital (COR), Argentina
          </span>
          <span>
            Precios finales consultados en tiempo real en ARS · Verificá condiciones finales antes de emitir
          </span>
        </div>
      </footer>

      {activeToast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-4 right-4 z-50 max-w-sm w-[calc(100%-2rem)] bg-white dark:bg-slate-900 border border-blue-400 dark:border-cyan-500 shadow-lg shadow-blue-600/15 rounded-xl p-4 flex items-start gap-3"
        >
          <span className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-600 to-cyan-500 text-white flex items-center justify-center shrink-0">
            <BellRing className="w-4 h-4" aria-hidden="true" />
          </span>
          <div className="flex-1 min-w-0 space-y-1">
            <p className="text-xs font-semibold text-slate-900 dark:text-slate-100">
              {activeToast.title}
            </p>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-snug">
              {activeToast.body}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setActiveToast(null)}
            aria-label="Cerrar notificación"
            className="p-1 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
      )}
    </div>
  );
}
