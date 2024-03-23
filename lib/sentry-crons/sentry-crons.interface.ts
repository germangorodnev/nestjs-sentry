export type MonitorStatus = 'ok' | 'error';

export interface TrackFinishParams {
  checkInId: string;
  monitorSlug: string;
  status: MonitorStatus
}