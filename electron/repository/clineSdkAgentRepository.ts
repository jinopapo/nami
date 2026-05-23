import { ClineCore } from '@cline/sdk';
import type {
  SessionEvent,
  ToolPermissionRequest,
  ToolPermissionResponse,
} from '../entity/clineSession.js';
import type { ClineSdkRuntimeConfig } from '../entity/clineSdkConfig.js';
import {
  extractClineSdkSessionId,
  mapCoreSessionEvent,
  mapFinishReasonToStopReason,
  mapToolApprovalRequestToPermissionRequest,
} from '../mapper/ClineSdkSessionEventMapper.js';
import type {
  ClineSdkCoreSessionEventResource,
  ClineSdkToolApprovalRequestResource,
} from '../resource/clineSdkSession.js';

type CoreLike = {
  start(
    input: unknown,
  ): Promise<{
    sessionId: string;
    result?: { status?: string; finishReason?: string };
  }>;
  send(input: {
    sessionId: string;
    prompt: string;
    mode?: 'plan' | 'act';
  }): Promise<{ status?: string; finishReason?: string } | undefined>;
  abort(sessionId: string, reason?: unknown): Promise<void>;
  dispose(reason?: string): Promise<void>;
  subscribe(
    listener: (event: ClineSdkCoreSessionEventResource) => void,
    options?: { sessionId?: string },
  ): () => void;
};

type CreateCore = (options: unknown) => Promise<CoreLike>;

type ClineSdkRepositoryEvent = SessionEvent & { sessionId: string };

type ClineSdkRepositoryEventListener = (event: ClineSdkRepositoryEvent) => void;

type ClineSdkStartInput = {
  prompt: string;
  interactive?: boolean;
  config: ClineSdkRuntimeConfig & {
    sessionId: string;
    mode: 'plan' | 'act';
    systemPrompt: string;
    enableSpawnAgent: false;
    enableAgentTeams: false;
    workspaceRoot: string;
  };
  requestToolApproval: (
    request: ToolPermissionRequest,
  ) => Promise<ToolPermissionResponse>;
};

const createDefaultToolPolicies = () => ({
  read_files: { enabled: true, autoApprove: true },
  search: { enabled: true, autoApprove: true },
  fetch_web: { enabled: true, autoApprove: true },
  bash: { enabled: true, autoApprove: false },
  editor: { enabled: true, autoApprove: false },
  apply_patch: { enabled: true, autoApprove: false },
});

export class ClineSdkAgentRepository {
  private core: CoreLike | undefined;
  private unsubscribeCore: (() => void) | undefined;
  private readonly listeners = new Set<ClineSdkRepositoryEventListener>();

  constructor(
    private readonly createCore: CreateCore = (options) =>
      ClineCore.create(options),
  ) {}

  async initialize(input: {
    requestToolApproval: (
      request: ToolPermissionRequest,
    ) => Promise<ToolPermissionResponse>;
  }): Promise<void> {
    if (this.core) {
      return;
    }

    this.core = await this.createCore({
      clientName: 'nami',
      backendMode: 'local',
      capabilities: {
        requestToolApproval: (request: ClineSdkToolApprovalRequestResource) =>
          input.requestToolApproval(
            mapToolApprovalRequestToPermissionRequest(request),
          ),
      },
      toolPolicies: createDefaultToolPolicies(),
    });
    this.unsubscribeCore = this.core.subscribe((event) => {
      this.handleCoreEvent(event);
    });
  }

  async start(
    input: ClineSdkStartInput,
  ): Promise<{ sessionId: string; stopReason?: string }> {
    const result = await this.requireCore().start({
      prompt: input.prompt,
      interactive: input.interactive,
      config: input.config,
      capabilities: {
        requestToolApproval: (request: ClineSdkToolApprovalRequestResource) =>
          input.requestToolApproval(
            mapToolApprovalRequestToPermissionRequest(request),
          ),
      },
      toolPolicies: createDefaultToolPolicies(),
    });

    return {
      sessionId: result.sessionId,
      stopReason: mapFinishReasonToStopReason(
        result.result?.status ?? result.result?.finishReason,
      ),
    };
  }

  async send(input: {
    sessionId: string;
    prompt: string;
    mode: 'plan' | 'act';
  }): Promise<{ stopReason?: string }> {
    const result = await this.requireCore().send(input);
    return {
      stopReason: mapFinishReasonToStopReason(
        result?.status ?? result?.finishReason,
      ),
    };
  }

  async abort(input: { sessionId: string; reason: string }): Promise<void> {
    await this.requireCore().abort(input.sessionId, input.reason);
  }

  subscribe(listener: ClineSdkRepositoryEventListener): () => void {
    this.listeners.add(listener);

    return () => {
      this.listeners.delete(listener);
    };
  }

  async dispose(): Promise<void> {
    this.unsubscribeCore?.();
    this.unsubscribeCore = undefined;
    await this.core?.dispose('nami shutdown');
    this.core = undefined;
    this.listeners.clear();
  }

  private requireCore(): CoreLike {
    if (!this.core) {
      throw new Error('Cline SDK core is not initialized.');
    }

    return this.core;
  }

  private handleCoreEvent(event: ClineSdkCoreSessionEventResource): void {
    const sessionId = extractClineSdkSessionId(event);
    if (!sessionId) {
      return;
    }

    const mapped = mapCoreSessionEvent(event);
    if (!mapped) {
      return;
    }

    for (const listener of this.listeners) {
      listener({ ...mapped, sessionId });
    }
  }
}
