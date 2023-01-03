import webpack from 'webpack';
import { logger } from '@storybook/node-logger';
import { BuilderContext, Target, targetFromTargetString } from '@angular-devkit/architect';
import { sync as findUpSync } from 'find-up';
import semver from 'semver';

import { JsonObject, logging } from '@angular-devkit/core';
import { getWebpackConfig as getCustomWebpackConfig } from './angular-cli-webpack';
import { moduleIsAvailable } from './utils/module-is-available';
import { PresetOptions } from './preset-options';

export async function webpackFinal(baseConfig: webpack.Configuration, options: PresetOptions) {
  if (!moduleIsAvailable('@angular-devkit/build-angular')) {
    logger.info('=> Using base config because "@angular-devkit/build-angular" is not installed');
    return baseConfig;
  }

  const angularCliVersion = await import('@angular/cli').then((m) => semver.coerce(m.VERSION.full));

  /**
   * Ordered array to use the specific  getWebpackConfig according to some condition like angular-cli version
   */
  const webpackGetterByVersions: {
    info: string;
    condition: boolean;
    getWebpackConfig(
      baseConfig: webpack.Configuration,
      options: PresetOptions
    ): Promise<webpack.Configuration> | webpack.Configuration;
  }[] = [
    {
      info: '=> Loading angular-cli config for angular >= 13.0.0',
      condition: semver.satisfies(angularCliVersion, '>=13.0.0'),
      getWebpackConfig: async (_baseConfig, _options) => {
        const builderContext = getBuilderContext(_options);
        const builderOptions = await getBuilderOptions(_options, builderContext);

        return getCustomWebpackConfig(_baseConfig, {
          builderOptions: {
            watch: options.configType === 'DEVELOPMENT',
            ...builderOptions,
          },
          builderContext,
        });
      },
    },
  ];

  const webpackGetter = webpackGetterByVersions.find((wg) => wg.condition);

  logger.info(webpackGetter.info);
  return Promise.resolve(webpackGetter.getWebpackConfig(baseConfig, options));
}

/**
 * Get Builder Context
 * If storybook is not start by angular builder create dumb BuilderContext
 */
function getBuilderContext(options: PresetOptions): BuilderContext {
  return (
    options.angularBuilderContext ??
    ({
      target: { project: 'noop-project', builder: '', options: {} },
      workspaceRoot: process.cwd(),
      getProjectMetadata: () => ({}),
      getTargetOptions: () => ({}),
      logger: new logging.Logger('Storybook'),
    } as unknown as BuilderContext)
  );
}

/**
 * Get builder options
 * Merge target options from browser target and from storybook options
 */
async function getBuilderOptions(
  options: PresetOptions,
  builderContext: BuilderContext
): Promise<JsonObject> {
  /**
   * Get Browser Target options
   */
  let browserTargetOptions: JsonObject = {};
  if (options.angularBrowserTarget) {
    const browserTarget = targetFromTargetString(options.angularBrowserTarget);

    logger.info(
      `=> Using angular browser target options from "${browserTarget.project}:${
        browserTarget.target
      }${browserTarget.configuration ? `:${browserTarget.configuration}` : ''}"`
    );
    browserTargetOptions = await builderContext.getTargetOptions(browserTarget);
  }

  /**
   * Merge target options from browser target options and from storybook options
   */
  const builderOptions = {
    ...browserTargetOptions,
    ...(options.angularBuilderOptions as JsonObject),
    tsConfig:
      options.tsConfig ??
      findUpSync('tsconfig.json', { cwd: options.configDir }) ??
      browserTargetOptions.tsConfig,
  };
  logger.info(`=> Using angular project with "tsConfig:${builderOptions.tsConfig}"`);

  return builderOptions;
}
