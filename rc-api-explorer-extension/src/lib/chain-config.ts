export type EngineMode = 'playbook' | 'dynamic' | 'composite';
export type ExecMode   = 'step' | 'auto' | 'hybrid';

export interface ChainConfig {
  defaultMode:      EngineMode;
  defaultExecution: ExecMode;
}

export const CHAIN_CONFIG: ChainConfig = {
  defaultMode:      'playbook',
  defaultExecution: 'hybrid',
};
