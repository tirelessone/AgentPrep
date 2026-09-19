import Dexie, { type EntityTable } from 'dexie';

import type { LocalSetting } from '@agentprep/domain';

export class AgentPrepDatabase extends Dexie {
  settings!: EntityTable<LocalSetting, 'key'>;

  constructor() {
    super('agentprep');
    this.version(1).stores({
      settings: '&key, updatedAt',
    });
  }
}

export const db = new AgentPrepDatabase();
