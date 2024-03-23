import { Inject, Injectable, ConsoleLogger } from '@nestjs/common';
import { OnApplicationShutdown } from '@nestjs/common';
import { ClientOptions, Client } from '@sentry/types';
import * as Sentry from '@sentry/node';
import { SENTRY_MODULE_OPTIONS } from './sentry.constants';
import { CreateSpanOptions, SentryModuleOptions } from './sentry.interfaces';

@Injectable()
export class SentryService extends ConsoleLogger implements OnApplicationShutdown {
  app = '@ntegral/nestjs-sentry: ';

  private static serviceInstance: SentryService;

  constructor(
    @Inject(SENTRY_MODULE_OPTIONS)
    readonly opts?: SentryModuleOptions,
  ) {
    super();
    if (!(opts && opts.dsn)) {
      // console.log('options not found. Did you use SentryModule.forRoot?');
      return;
    }
    const { debug, integrations = [], ...sentryOptions } = opts;

    Sentry.init({
      ...sentryOptions,
      integrations: [
        new Sentry.Integrations.OnUncaughtException({
          onFatalError: async (err) => {
            if (err.name === 'SentryError') {
              console.log(err);
            } else {
              (
                Sentry.getCurrentHub().getClient<
                  Client<ClientOptions>
                >() as Client<ClientOptions>
              ).captureException(err);
              process.exit(1);
            }
          },
        }),
        new Sentry.Integrations.OnUnhandledRejection({ mode: 'warn' }),
        ...integrations,
      ],
    });
  }

  /**
   * Create new child span in current transaction.
   * Returns undefined if there's no current transaction. 
   */
  public async createChildSpan(
    options: Parameters<Sentry.Span['startChild']>[0],
  ): Promise<Sentry.Span | undefined> {
    return Sentry
      .getCurrentHub()
      .getScope()
      ?.getSpan()
      ?.startChild(options);
  };

  /**
   * Runs funciton as a child span of `parent` OR inside current transaction.
   * If there's no transaction - function is executed anyway.
   */
  public async runSpanInParentOrCurrent<T extends (span: Sentry.Span | undefined) => any>(
    parent: Sentry.Span | Sentry.Transaction | null | undefined,
    spanOption: CreateSpanOptions,
    func: T,
  ): Promise<Awaited<ReturnType<T>>> {
    const tx = parent ?? Sentry.getActiveTransaction();
    const span = tx ? tx.startChild(spanOption) : undefined

    return this.runFunctionInSpan(span, func);
  }

  /**
   * Runs funciton as a child span of current transaction.
   * If there's no transaction function is executed anyway.
   */
  public async runSpanInCurrent<T extends (span: Sentry.Span | undefined) => any>(
    spanOption: CreateSpanOptions,
    func: T,
  ): Promise<Awaited<ReturnType<T>>> {
    const tx = Sentry.getActiveTransaction();
    const span = tx?.startChild(spanOption);

    return this.runFunctionInSpan(span, func);
  }

  private async runFunctionInSpan<T extends (...args: any[]) => any>(
    span: Sentry.Span | undefined,
    func: T,
  ): Promise<Awaited<ReturnType<T>>> {
    try {
      const result = await func();

      return result;
    } catch (error) {
      span?.setStatus('unknown_error');

      throw error;
    } finally {
      if (span) {
        if (!span.status) {
          span.setStatus('ok');
        }

        span.finish();
      }
    }
  }

  public static SentryServiceInstance(): SentryService {
    if (!SentryService.serviceInstance) {
      SentryService.serviceInstance = new SentryService();
    }
    return SentryService.serviceInstance;
  }

  log(message: string, context?: string, asBreadcrumb?: boolean) {
    message = `${this.app} ${message}`;
    try {
      super.log(message, context);
      asBreadcrumb ?
        Sentry.addBreadcrumb({
          message,
          level: 'log',
          data: {
            context
          }
        })
        : Sentry.captureMessage(message, 'log');
    } catch (err) { }
  }

  error(message: string, trace?: string, context?: string) {
    message = `${this.app} ${message}`;
    try {
      super.error(message, trace, context);
      Sentry.captureMessage(message, 'error');
    } catch (err) { }
  }

  warn(message: string, context?: string, asBreadcrumb?: boolean) {
    message = `${this.app} ${message}`;
    try {
      super.warn(message, context);
      asBreadcrumb ?
        Sentry.addBreadcrumb({
          message,
          level: 'warning',
          data: {
            context
          }
        }) :
        Sentry.captureMessage(message, 'warning');
    } catch (err) { }
  }

  debug(message: string, context?: string, asBreadcrumb?: boolean) {
    message = `${this.app} ${message}`;
    try {
      super.debug(message, context);
      asBreadcrumb ?
        Sentry.addBreadcrumb({
          message,
          level: 'debug',
          data: {
            context
          }
        }) :
        Sentry.captureMessage(message, 'debug');
    } catch (err) { }
  }

  verbose(message: string, context?: string, asBreadcrumb?: boolean) {
    message = `${this.app} ${message}`;
    try {
      super.verbose(message, context);
      asBreadcrumb ?
        Sentry.addBreadcrumb({
          message,
          level: 'info',
          data: {
            context
          }
        }) :
        Sentry.captureMessage(message, 'info');
    } catch (err) { }
  }

  instance() {
    return Sentry;
  }

  async onApplicationShutdown(signal?: string) {
    if (this.opts?.close?.enabled === true) {
      await Sentry.close(this.opts?.close.timeout);
    }
  }
}
