import React, { useEffect, useState } from 'react';
import {
  Bell,
  BellRing,
  CheckCircle2,
  ExternalLink,
  Pause,
  Play,
  RefreshCw,
  Trash2,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { ALL_AIRLINES, DESTINATIONS } from '../data/destinations.ts';
import type {
  PriceAlert,
  PushNotificationLog,
  TripType,
} from '../types/travel.ts';
import { formatArs } from '../utils/travelCalculations.ts';

interface AlertsPushPanelProps {
  alerts: PriceAlert[];
  pushLogs: PushNotificationLog[];
  pushPermission: NotificationPermission | 'unsupported';
  isEmbeddedIframe: boolean;
  soundEnabled: boolean;
  onToggleSound: () => void;
  pushStatusMessage: string | null;
  checkFeedback: { type: 'info' | 'success' | 'error'; text: string } | null;
  onRequestPushPermission: () => void;
  onCreateAlert: (alert: Omit<PriceAlert, 'id' | 'createdAtIso' | 'status'>) => void;
  onToggleAlertStatus: (id: string) => void;
  onDeleteAlert: (id: string) => void;
  onCheckAlertsLive: () => void;
  onTestPushAlert: (alert: PriceAlert) => void;
  isCheckingAlerts: boolean;
  defaultDestinationId: string;
  defaultTripType: TripType;
  defaultTargetDate: string;
  defaultReturnDate: string;
  defaultMaxPrice: number;
  defaultAirlines: string[];
  defaultMaxStops: number;
  onMarkLogsRead: () => void;
}

export const AlertsPushPanel: React.FC<AlertsPushPanelProps> = ({
  alerts,
  pushLogs,
  pushPermission,
  isEmbeddedIframe,
  soundEnabled,
  onToggleSound,
  pushStatusMessage,
  checkFeedback,
  onRequestPushPermission,
  onCreateAlert,
  onToggleAlertStatus,
  onDeleteAlert,
  onCheckAlertsLive,
  onTestPushAlert,
  isCheckingAlerts,
  defaultDestinationId,
  defaultTripType,
  defaultTargetDate,
  defaultReturnDate,
  defaultMaxPrice,
  defaultAirlines,
  defaultMaxStops,
  onMarkLogsRead,
}) => {
  const [destinationId, setDestinationId] = useState(defaultDestinationId);
  const [tripType, setTripType] = useState<TripType>(defaultTripType);
  const [targetDate, setTargetDate] = useState(defaultTargetDate);
  const [returnDate, setReturnDate] = useState(defaultReturnDate);
  const [horizonDays, setHorizonDays] = useState<30 | 60>(30);
  const [maxPriceArs, setMaxPriceArs] = useState(defaultMaxPrice);
  const [preferredAirlines, setPreferredAirlines] = useState<string[]>(defaultAirlines);
  const [maxStops, setMaxStops] = useState(defaultMaxStops);
  const [notifyOnDropPercent, setNotifyOnDropPercent] = useState(12);
  const [pushEnabled, setPushEnabled] = useState(true);

  useEffect(() => {
    setDestinationId(defaultDestinationId);
    setTripType(defaultTripType);
    setTargetDate(defaultTargetDate);
    setReturnDate(defaultReturnDate);
    setMaxPriceArs(defaultMaxPrice);
    setPreferredAirlines(defaultAirlines);
    setMaxStops(defaultMaxStops);
  }, [
    defaultDestinationId,
    defaultTripType,
    defaultTargetDate,
    defaultReturnDate,
    defaultMaxPrice,
    defaultAirlines,
    defaultMaxStops,
  ]);

  const selectedDest =
    DESTINATIONS.find((d) => d.id === destinationId) || DESTINATIONS[0];

  const handleToggleFormAirline = (airline: string) => {
    setPreferredAirlines((prev) =>
      prev.includes(airline)
        ? prev.filter((a) => a !== airline)
        : [...prev, airline]
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onCreateAlert({
      destinationId: selectedDest.id,
      destinationCity: selectedDest.city,
      iata: selectedDest.iata,
      tripType,
      targetDate,
      returnDate: tripType === 'round_trip' ? returnDate : undefined,
      horizonDays,
      maxPriceArs: Math.max(10000, Math.round(maxPriceArs)),
      preferredAirlines,
      maxStops,
      pushEnabled,
      notifyOnDropPercent,
    });
  };

  const unreadCount = pushLogs.filter((l) => !l.read).length;

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl shadow-sm p-5 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2.5">
              <span className="w-8 h-8 rounded-lg bg-sky-100 text-blue-600 dark:bg-sky-500/20 dark:text-sky-300 flex items-center justify-center shrink-0">
                <BellRing className="w-4 h-4" aria-hidden="true" />
              </span>
              <span>Sistema de Alertas y Notificaciones Push Personalizadas</span>
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">
              Monitoreo automático cada 3 minutos y verificación manual en vivo para tus rutas, fechas y ventana de 30/60 días.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={onToggleSound}
              className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl border transition-all duration-150 cursor-pointer ${
                soundEnabled
                  ? 'border-indigo-300 dark:border-indigo-700 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300'
                  : 'border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
              }`}
            >
              {soundEnabled ? (
                <Volume2 className="w-3.5 h-3.5" aria-hidden="true" />
              ) : (
                <VolumeX className="w-3.5 h-3.5" aria-hidden="true" />
              )}
              <span>{soundEnabled ? 'Sonido activo' : 'Silenciado'}</span>
            </button>

            <button
              type="button"
              onClick={onRequestPushPermission}
              className={`inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl border transition-all duration-150 cursor-pointer ${
                pushPermission === 'granted'
                  ? 'border-transparent bg-emerald-500 text-white shadow-sm shadow-emerald-600/20 dark:text-slate-950'
                  : 'border-transparent bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-700 hover:to-cyan-600 dark:from-sky-500 dark:to-cyan-400 text-white dark:text-slate-950 shadow-sm shadow-blue-600/20'
              }`}
            >
              <Bell className="w-4 h-4" aria-hidden="true" />
              <span>
                {pushPermission === 'granted'
                  ? 'Push del Navegador Activo'
                  : pushPermission === 'denied'
                  ? 'Reintentar Push Navegador'
                  : 'Activar Push del Navegador'}
              </span>
            </button>

            <button
              type="button"
              onClick={onCheckAlertsLive}
              disabled={isCheckingAlerts || alerts.length === 0}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-sky-950/50 disabled:opacity-50 transition-all duration-150 cursor-pointer"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${isCheckingAlerts ? 'animate-spin' : ''}`}
                aria-hidden="true"
              />
              <span>{isCheckingAlerts ? 'Verificando...' : 'Verificar alertas en vivo'}</span>
            </button>
          </div>
        </div>

        {(isEmbeddedIframe || pushPermission === 'denied' || pushStatusMessage) && (
          <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-600 dark:text-slate-300">
            <p>
              {pushStatusMessage ||
                (isEmbeddedIframe
                  ? 'Las alertas push dentro de la app (banner visual + sonido + historial) están activas. Si el navegador restringe notificaciones nativas dentro de la vista previa, podés abrir la app en una pestaña independiente.'
                  : 'Las alertas dentro de la app funcionan en vivo; si bloqueaste el permiso del navegador, habilitalo desde el candado de la barra de direcciones.')}
            </p>
            {isEmbeddedIframe && typeof window !== 'undefined' && (
              <a
                href={window.location.href}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 font-semibold text-sky-700 dark:text-sky-400 hover:underline whitespace-nowrap shrink-0"
              >
                <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Abrir en pestaña nueva</span>
              </a>
            )}
          </div>
        )}

        {checkFeedback && (
          <div
            role="status"
            className={`p-3 rounded-lg border text-xs ${
              checkFeedback.type === 'success'
                ? 'border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-300'
                : checkFeedback.type === 'error'
                ? 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300'
                : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 text-slate-700 dark:text-slate-300'
            }`}
          >
            {checkFeedback.text}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <form
          onSubmit={handleSubmit}
          className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl shadow-sm p-5 space-y-4"
        >
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              Crear nueva alerta de pasaje
            </h3>
            <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800/90 rounded-xl border border-slate-200/80 dark:border-slate-700/70">
              <button
                type="button"
                onClick={() => setTripType('one_way')}
                className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-all duration-150 cursor-pointer ${
                  tripType === 'one_way'
                    ? 'bg-gradient-to-r from-blue-600 to-cyan-500 text-white shadow-xs dark:from-sky-500 dark:to-cyan-400 dark:text-slate-950'
                    : 'text-slate-600 dark:text-slate-300'
                }`}
              >
                Solo ida
              </button>
              <button
                type="button"
                onClick={() => setTripType('round_trip')}
                className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-all duration-150 cursor-pointer ${
                  tripType === 'round_trip'
                    ? 'bg-gradient-to-r from-blue-600 to-cyan-500 text-white shadow-xs dark:from-sky-500 dark:to-cyan-400 dark:text-slate-950'
                    : 'text-slate-600 dark:text-slate-300'
                }`}
              >
                Ida y vuelta
              </button>
            </div>
          </div>

          <div className="space-y-3.5">
            <div>
              <label
                htmlFor="alert-dest"
                className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
              >
                Ruta desde Córdoba Capital (COR)
              </label>
              <select
                id="alert-dest"
                value={destinationId}
                onChange={(e) => setDestinationId(e.target.value)}
                className="w-full h-10 px-3 text-sm font-medium rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 hover:border-blue-400 dark:hover:border-sky-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-colors cursor-pointer"
              >
                {DESTINATIONS.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.city} ({d.iata}) · {d.country}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="alert-date"
                  className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
                >
                  Fecha de salida
                </label>
                <input
                  id="alert-date"
                  type="date"
                  required
                  value={targetDate}
                  onChange={(e) => {
                    const nextDate = e.target.value;
                    setTargetDate(nextDate);
                    if (returnDate < nextDate) {
                      setReturnDate(nextDate);
                    }
                  }}
                  className="w-full h-10 px-3 text-sm font-mono tabular-nums rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 hover:border-blue-400 dark:hover:border-sky-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-colors"
                />
              </div>

              {tripType === 'round_trip' ? (
                <div>
                  <label
                    htmlFor="alert-return-date"
                    className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
                  >
                    Fecha de regreso
                  </label>
                  <input
                    id="alert-return-date"
                    type="date"
                    required
                    min={targetDate}
                    value={returnDate}
                    onChange={(e) => setReturnDate(e.target.value)}
                    className="w-full h-10 px-3 text-sm font-mono tabular-nums rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 hover:border-blue-400 dark:hover:border-sky-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-colors"
                  />
                </div>
              ) : (
                <div>
                  <label
                    htmlFor="alert-horizon"
                    className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
                  >
                    Ventana de ofertas
                  </label>
                  <select
                    id="alert-horizon"
                    value={horizonDays}
                    onChange={(e) => setHorizonDays(Number(e.target.value) as 30 | 60)}
                    className="w-full h-10 px-3 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 hover:border-blue-400 dark:hover:border-sky-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-colors cursor-pointer"
                  >
                    <option value={30}>Monitoreo 30 días</option>
                    <option value={60}>Monitoreo 60 días</option>
                  </select>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="alert-max-price"
                  className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
                >
                  Precio final objetivo (ARS)
                </label>
                <input
                  id="alert-max-price"
                  type="number"
                  min={15000}
                  step={1000}
                  required
                  value={maxPriceArs}
                  onChange={(e) => setMaxPriceArs(Number(e.target.value))}
                  className="w-full h-10 px-3 text-sm font-mono tabular-nums rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 hover:border-blue-400 dark:hover:border-sky-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-colors"
                />
              </div>

              <div>
                <label
                  htmlFor="alert-stops"
                  className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
                >
                  Escalas máximas
                </label>
                <select
                  id="alert-stops"
                  value={maxStops}
                  onChange={(e) => setMaxStops(Number(e.target.value))}
                  className="w-full h-10 px-3 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 hover:border-blue-400 dark:hover:border-sky-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-colors cursor-pointer"
                >
                  <option value={0}>Solo directos (0)</option>
                  <option value={1}>Hasta 1 escala</option>
                  <option value={2}>Hasta 2 escalas</option>
                </select>
              </div>
            </div>

            <div>
              <span className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
                Aerolíneas específicas (vacío = cualquiera)
              </span>
              <div className="flex flex-wrap gap-1.5">
                {ALL_AIRLINES.map((airline) => {
                  const active = preferredAirlines.includes(airline);
                  return (
                    <button
                      key={airline}
                      type="button"
                      onClick={() => handleToggleFormAirline(airline)}
                      className={`px-2.5 py-1.5 text-xs font-semibold rounded-lg border transition-all duration-150 cursor-pointer ${
                        active
                          ? 'border-transparent bg-gradient-to-r from-blue-600 to-cyan-500 text-white shadow-xs dark:from-sky-500 dark:to-cyan-400 dark:text-slate-950'
                          : 'border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 hover:border-blue-400'
                      }`}
                    >
                      {airline}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div>
                <label
                  htmlFor="alert-drop-pct"
                  className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1"
                >
                  Notificar si cae al menos (%)
                </label>
                <input
                  id="alert-drop-pct"
                  type="number"
                  min={5}
                  max={60}
                  value={notifyOnDropPercent}
                  onChange={(e) => setNotifyOnDropPercent(Number(e.target.value) || 10)}
                  className="w-full h-10 px-3 text-sm font-mono tabular-nums rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex items-end pb-2">
                <label className="flex items-center gap-2 text-xs font-medium text-slate-700 dark:text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={pushEnabled}
                    onChange={(e) => setPushEnabled(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-300 dark:border-slate-700 text-blue-600 focus:ring-blue-500"
                  />
                  <span>Enviar push personalizada por búsqueda</span>
                </label>
              </div>
            </div>
          </div>

          <button
            type="submit"
            className="w-full py-2.5 px-4 text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-700 hover:to-cyan-600 dark:from-sky-500 dark:to-cyan-400 dark:text-slate-950 rounded-xl shadow-sm shadow-blue-600/20 transition-all duration-150 cursor-pointer"
          >
            Guardar alerta personalizada
          </button>
        </form>

        <div className="lg:col-span-7 space-y-6">
          <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                Alertas configuradas ({alerts.length})
              </h3>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                Guardadas en este dispositivo
              </span>
            </div>

            {alerts.length === 0 ? (
              <div className="p-8 text-center space-y-2">
                <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Todavía no tenés alertas configuradas
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Creá una alerta a la izquierda o desde el calendario de ofertas a 30/60 días.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-200 dark:divide-slate-800">
                {alerts.map((alert) => (
                  <div
                    key={alert.id}
                    className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="space-y-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                          COR → {alert.destinationCity} ({alert.iata})
                        </span>
                        <span className="text-xs text-slate-500 dark:text-slate-400">
                          · {alert.tripType === 'round_trip' ? 'Ida y vuelta' : 'Solo ida'}
                        </span>
                        <span
                          className={`text-xs font-medium ${
                            alert.status === 'oferta_detectada'
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : alert.status === 'pausada'
                              ? 'text-slate-400 dark:text-slate-500'
                              : 'text-sky-600 dark:text-sky-400'
                          }`}
                        >
                          ·{' '}
                          {alert.status === 'oferta_detectada'
                            ? 'Oferta detectada'
                            : alert.status === 'pausada'
                            ? 'Pausada'
                            : 'Monitoreo activo'}
                        </span>
                      </div>

                      <p className="text-xs text-slate-600 dark:text-slate-400 font-mono tabular-nums">
                        Salida {alert.targetDate}
                        {alert.tripType === 'round_trip' && alert.returnDate
                          ? ` · Regreso ${alert.returnDate}`
                          : ''}{' '}
                        · Tope {formatArs(alert.maxPriceArs)} ·{' '}
                        {alert.maxStops === 0 ? 'Directo' : `≤ ${alert.maxStops} esc.`}
                      </p>

                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {alert.preferredAirlines.length > 0
                          ? `Aerolíneas: ${alert.preferredAirlines.join(', ')}`
                          : 'Todas las aerolíneas'}
                        {alert.lastFoundPriceArs
                          ? ` · Último relevamiento real: ${formatArs(alert.lastFoundPriceArs)}`
                          : ''}
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => onTestPushAlert(alert)}
                        className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-blue-300 dark:border-sky-700 bg-blue-50 dark:bg-sky-950/50 text-blue-700 dark:text-cyan-300 hover:bg-blue-600 hover:text-white dark:hover:bg-cyan-400 dark:hover:text-slate-950 transition-colors cursor-pointer"
                      >
                        Probar push
                      </button>
                      <button
                        type="button"
                        onClick={() => onToggleAlertStatus(alert.id)}
                        aria-label={alert.status === 'pausada' ? 'Reanudar alerta' : 'Pausar alerta'}
                        className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                      >
                        {alert.status === 'pausada' ? (
                          <Play className="w-3.5 h-3.5" aria-hidden="true" />
                        ) : (
                          <Pause className="w-3.5 h-3.5" aria-hidden="true" />
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteAlert(alert.id)}
                        aria-label="Eliminar alerta"
                        className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                Historial de notificaciones push ({pushLogs.length})
              </h3>
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={onMarkLogsRead}
                  className="inline-flex items-center gap-1 text-xs font-medium text-sky-600 dark:text-sky-400 hover:underline cursor-pointer"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Marcar leídas ({unreadCount})</span>
                </button>
              )}
            </div>

            {pushLogs.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-500 dark:text-slate-400">
                Las notificaciones push personalizadas disparadas por tus búsquedas y alertas aparecerán aquí.
              </div>
            ) : (
              <div className="divide-y divide-slate-200 dark:divide-slate-800 max-h-72 overflow-y-auto">
                {pushLogs.map((log) => (
                  <div
                    key={log.id}
                    className={`p-4 space-y-1 ${
                      log.read ? 'opacity-80' : 'bg-sky-50/40 dark:bg-sky-950/20'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="font-semibold text-slate-900 dark:text-slate-100">
                        {log.title}
                      </span>
                      <span className="font-mono tabular-nums text-slate-500 dark:text-slate-400">
                        {new Date(log.timestampIso).toLocaleTimeString('es-AR', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-300">
                      {log.body}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
