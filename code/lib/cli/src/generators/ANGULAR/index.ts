import semver from 'semver';
import { baseGenerator } from '../baseGenerator';
import type { Generator } from '../types';
import { CoreBuilder } from '../../project_types';

const generator: Generator = async (packageManager, npmOptions, options) => {
  const angularVersion = semver.coerce(
    packageManager.retrievePackageJson().dependencies['@angular/core']
  )?.version;
  const isWebpack5 = semver.gte(angularVersion, '12.0.0');
  const updatedOptions = isWebpack5 ? { ...options, builder: CoreBuilder.Webpack5 } : options;

  await baseGenerator(
    packageManager,
    npmOptions,
    updatedOptions,
    'angular',
    {
      addScripts: false,
    },
    'angular'
  );
};

export default generator;
