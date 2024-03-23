import { HttpModule } from '@nestjs/axios';
import { ConfigurableModuleBuilder, Global, Module } from '@nestjs/common';

import { SentryCronsService } from './sentry-crons.service';

const { ConfigurableModuleClass } = new ConfigurableModuleBuilder({
  moduleName: 'SentryCrons',
})
  .setExtras<{ isGlobal: boolean }>({ isGlobal: true }, (definition, { isGlobal }) => {
    return {
      global: isGlobal,
      ...definition,
    }
  })
  .build();

@Module({
  imports: [HttpModule],
  providers: [SentryCronsService],
  exports: [SentryCronsService],
})
export class SentryCronsModule extends ConfigurableModuleClass { }
