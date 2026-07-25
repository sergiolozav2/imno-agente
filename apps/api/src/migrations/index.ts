import * as migration_20260725_165831_initial from './20260725_165831_initial';

export const migrations = [
  {
    up: migration_20260725_165831_initial.up,
    down: migration_20260725_165831_initial.down,
    name: '20260725_165831_initial'
  },
];
