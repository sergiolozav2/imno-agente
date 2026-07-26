import * as migration_20260725_165831_initial from './20260725_165831_initial';
import * as migration_20260726_073114_system_whatsapp from './20260726_073114_system_whatsapp';
import * as migration_20260726_080703_operator_inbound from './20260726_080703_operator_inbound';
import * as migration_20260726_094500_tenant_agent_persona from './20260726_094500_tenant_agent_persona';
import * as migration_20260726_120000_property_video from './20260726_120000_property_video';

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
  {
    up: migration_20260726_094500_tenant_agent_persona.up,
    down: migration_20260726_094500_tenant_agent_persona.down,
    name: '20260726_094500_tenant_agent_persona'
  },
  {
    up: migration_20260726_120000_property_video.up,
    down: migration_20260726_120000_property_video.down,
    name: '20260726_120000_property_video'
  },
];
