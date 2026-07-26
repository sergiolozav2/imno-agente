import * as migration_20260725_165831_initial from './20260725_165831_initial';
import * as migration_20260726_073114_system_whatsapp from './20260726_073114_system_whatsapp';
import * as migration_20260726_080703_operator_inbound from './20260726_080703_operator_inbound';

export const migrations = [
  {
    up: migration_20260725_165831_initial.up,
    down: migration_20260725_165831_initial.down,
    name: '20260725_165831_initial',
  },
  {
    up: migration_20260726_073114_system_whatsapp.up,
    down: migration_20260726_073114_system_whatsapp.down,
    name: '20260726_073114_system_whatsapp',
  },
  {
    up: migration_20260726_080703_operator_inbound.up,
    down: migration_20260726_080703_operator_inbound.down,
    name: '20260726_080703_operator_inbound'
  },
];
