import { ProviderSettingsManager } from '@cline/sdk';
import type { ClineSdkRuntimeConfig } from '../entity/clineSdkConfig.js';

const normalizeOptionalString = (value: unknown): string | undefined => {
  if (typeof value !== 'string') {
    return undefined;
  }

  const normalized = value.trim();
  return normalized ? normalized : undefined;
};

type ProviderConfig = {
  providerId?: unknown;
  modelId?: unknown;
};

type ProviderSettingsManagerPort = {
  getLastUsedProviderConfig(): ProviderConfig | undefined;
};

export class ClineSdkConfigService {
  constructor(
    _userDataPath: string,
    private readonly providerSettingsManager: ProviderSettingsManagerPort = new ProviderSettingsManager(),
  ) {}

  async createCoreSessionConfig(cwd: string): Promise<ClineSdkRuntimeConfig> {
    const config = this.providerSettingsManager.getLastUsedProviderConfig();
    const providerId = normalizeOptionalString(config?.providerId);
    const modelId = normalizeOptionalString(config?.modelId);
    if (!providerId || !modelId) {
      throw new Error(
        'Cline CLI model config is not configured. Configure provider/model with the Cline CLI first.',
      );
    }

    return {
      providerId,
      modelId,
      cwd,
      enableTools: true,
    };
  }
}
