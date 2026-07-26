import * as migration_20260725_165831_initial from './20260725_165831_initial';
import * as migration_20260726_073114_system_whatsapp from './20260726_073114_system_whatsapp';

export const migrations = [
  {
    up: migration_20260725_165831_initial.up,
    down: migration_20260725_165831_initial.down,
    name: '20260725_165831_initial',
  },
  {
    up: migration_20260726_073114_system_whatsapp.up,
    down: migration_20260726_073114_system_whatsapp.down,
    name: '20260726_073114_system_whatsapp'
  },
];
