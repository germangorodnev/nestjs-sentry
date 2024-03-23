import { InjectSentry } from '../sentry.decorator';
import { SentryService } from '../sentry.service';
import { MonitorStatus, TrackFinishParams } from './sentry-crons.interface';

type SentryTrackFinishCallback = (status: MonitorStatus) => Promise<void>;

const noop = (() => {}) as unknown as SentryTrackFinishCallback;

export class SentryCronsService {
  constructor(@InjectSentry() private sentry: SentryService) {}

  public async trackStart(monitorSlug: string): Promise<SentryTrackFinishCallback> {
    try {
      const checkInId = this.sentry.instance().captureCheckIn({
        monitorSlug,
        status: 'in_progress',
      });
     
      return (status: MonitorStatus) => this.trackFinish({ checkInId, monitorSlug, status });
    } catch (error) {
      this.sentry.instance().captureException(error);

      return noop;
    }
  }

  private async trackFinish({
    checkInId,
    monitorSlug,
    status,
  }: TrackFinishParams): Promise<void> {
    try {
       this.sentry.instance().captureCheckIn({
        checkInId,
        monitorSlug,
        status,
      })
    } catch (error) {
      this.sentry.instance().captureException(error);
    }
  }
}
