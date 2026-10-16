warning: in the working copy of 'packages/api-client/src/client.ts', LF will be replaced by CRLF the next time Git touches it
[1mdiff --git a/packages/api-client/src/client.ts b/packages/api-client/src/client.ts[m
[1mindex 98a5eca..8e08f13 100644[m
[1m--- a/packages/api-client/src/client.ts[m
[1m+++ b/packages/api-client/src/client.ts[m
[36m@@ -22,9 +22,21 @@[m [mimport type {[m
   CreateShippingZonePayload,[m
   CreateTaxRatePayload,[m
   CreateVariantPayload,[m
[32m+[m[32m  CreateFunnelEdgePayload,[m
[32m+[m[32m  CreateFunnelPayload,[m
[32m+[m[32m  CreateFunnelStepPayload,[m
   CreateWebsitePagePayload,[m
   CreateWebsitePayload,[m
   Customer,[m
[32m+[m[32m  Funnel,[m
[32m+[m[32m  FunnelDetail,[m
[32m+[m[32m  FunnelEdge,[m
[32m+[m[32m  FunnelRevision,[m
[32m+[m[32m  FunnelStep,[m
[32m+[m[32m  PublishFunnelResult,[m
[32m+[m[32m  UpdateFunnelEdgePayload,[m
[32m+[m[32m  UpdateFunnelPayload,[m
[32m+[m[32m  UpdateFunnelStepPayload,[m
   CustomerAddress,[m
   CustomerListParams,[m
   CustomerListResponse,[m
[36m@@ -113,6 +125,8 @@[m [mexport interface ApiClientOptions {[m
   tokenStorage?: TokenStorage;[m
   /** Called whenever refresh fails / the session becomes invalid. */[m
   onSessionExpired?: () => void;[m
[32m+[m[32m  /** Sent with every request; a call's own headers win on a clash. */[m
[32m+[m[32m  defaultHeaders?: Record<string, string>;[m
 }[m
 [m
 interface RequestOptions {[m
[36m@@ -142,12 +156,14 @@[m [mexport class ApiClient {[m
   private baseUrl: string;[m
   private tokenStorage: TokenStorage;[m
   private onSessionExpired?: () => void;[m
[32m+[m[32m  private defaultHeaders: Record<string, string>;[m
   private refreshPromise: Promise<boolean> | null = null;[m
 [m
   constructor(options: ApiClientOptions) {[m
     this.baseUrl = options.baseUrl.replace(/\/$/, "");[m
     this.tokenStorage = options.tokenStorage ?? createLocalStorageTokenStorage();[m
     this.onSessionExpired = options.onSessionExpired;[m
[32m+[m[32m    this.defaultHeaders = options.defaultHeaders ?? {};[m
   }[m
 [m
   get tokens() {[m
[36m@@ -182,6 +198,7 @@[m [mexport class ApiClient {[m
     const doFetch = async (): Promise<Response> => {[m
       const finalHeaders: Record<string, string> = {[m
         "Content-Type": "application/json",[m
[32m+[m[32m        ...this.defaultHeaders,[m
         ...headers,[m
       };[m
       if (auth) {[m
[36m@@ -512,6 +529,156 @@[m [mexport class ApiClient {[m
     return page;[m
   }[m
 [m
[32m+[m[32m  // ---------------------------------------------------------------------[m
[32m+[m[32m  // Funnels — /workspaces/:workspaceId/funnels[m
[32m+[m[32m  // Everything needs FUNNELS_MANAGE; publish, pause, resume and rollback need[m
[32m+[m[32m  // FUNNELS_PUBLISH. Creating and publishing also need an active subscription[m
[32m+[m[32m  // (402 SUBSCRIPTION_REQUIRED otherwise).[m
[32m+[m[32m  // ---------------------------------------------------------------------[m
[32m+[m
[32m+[m[32m  private funnelsBase(workspaceId: string) {[m
[32m+[m[32m    return `/workspaces/${workspaceId}/funnels`;[m
[32m+[m[32m  }[m
[32m+[m
[32m+[m[32m  async listFunnels(workspaceId: string) {[m
[32m+[m[32m    const { funnels } = await this.request<{ funnels: Funnel[] }>(this.funnelsBase(workspaceId));[m
[32m+[m[32m    return funnels;[m
[32m+[m[32m  }[m
[32m+[m
[32m+[m[32m  /** The funnel with its working steps and edges — one call opens the builder. */[m
[32m+[m[32m  async getFunnel(workspaceId: string, funnelId: string) {[m
[32m+[m[32m    return this.request<FunnelDetail>(`${this.funnelsBase(workspaceId)}/${funnelId}`);[m
[32m+[m[32m  }[m
[32m+[m
[32m+[m[32m  async createFunnel(workspaceId: string, payload: CreateFunnelPayload) {[m
[32m+[m[32m    const { funnel } = await this.request<{ funnel: Funnel }>(this.funnelsBase(workspaceId), {[m
[32m+[m[32m      method: "POST",[m
[32m+[m[32m      body: payload,[m
[32m+[m[32m    });[m
[32m+[m[32m    return funnel;[m
[32m+[m[32m  }[m
[32m+[m
[32m+[m[32m  async updateFunnel(workspaceId: string, funnelId: string, payload: UpdateFunnelPayload) {[m
[32m+[m[32m    const { funnel } = await this.request<{ funnel: Funnel }>([m
[32m+[m[32m      `${this.funnelsBase(workspaceId)}/${funnelId}`,[m
[32m+[m[32m      { method: "PATCH", body: payload }[m
[32m+[m[32m    );[m
[32m+[m[32m    return funnel;[m
[32m+[m[32m  }[m
[32m+[m
[32m+[m[32m  /** Steps, edges, revisions and visitor sessions go with it. No undo. */[m
[32m+[m[32m  async deleteFunnel(workspaceId: string, funnelId: string): Promise<void> {[m
[32m+[m[32m    await this.request<{ deleted: true }>(`${this.funnelsBase(workspaceId)}/${funnelId}`, {[m
[32m+[m[32m      method: "DELETE",[m
[32m+[m[32m    });[m
[32m+[m[32m  }[m
[32m+[m
[32m+[m[32m  /**[m
[32m+[m[32m   * A key already used in the funnel is a 409 FUNNEL_STEP_KEY_TAKEN; a malformed[m
[32m+[m[32m   * `builderData` tree is a 422 naming the node path, as for website pages.[m
[32m+[m[32m   */[m
[32m+[m[32m  async createFunnelStep(workspaceId: string, funnelId: string, payload: CreateFunnelStepPayload) {[m
[32m+[m[32m    const { step } = await this.request<{ step: FunnelStep }>([m
[32m+[m[32m      `${this.funnelsBase(workspaceId)}/${funnelId}/steps`,[m
[32m+[m[32m      { method: "POST", body: payload }[m
[32m+[m[32m    );[m
[32m+[m[32m    return step;[m
[32m+[m[32m  }[m
[32m+[m
[32m+[m[32m  async updateFunnelStep([m
[32m+[m[32m    workspaceId: string,[m
[32m+[m[32m    funnelId: string,[m
[32m+[m[32m    stepId: string,[m
[32m+[m[32m    payload: UpdateFunnelStepPayload[m
[32m+[m[32m  ) {[m
[32m+[m[32m    const { step } = await this.request<{ step: FunnelStep }>([m
[32m+[m[32m      `${this.funnelsBase(workspaceId)}/${funnelId}/steps/${stepId}`,[m
[32m+[m[32m      { method: "PATCH", body: payload }[m
[32m+[m[32m    );[m
[32m+[m[32m    return step;[m
[32m+[m[32m  }[m
[32m+[m
[32m+[m[32m  /** Also deletes every draft edge into or out of the step. */[m
[32m+[m[32m  async deleteFunnelStep(workspaceId: string, funnelId: string, stepId: string): Promise<void> {[m
[32m+[m[32m    await this.request<{ deleted: true }>([m
[32m+[m[32m      `${this.funnelsBase(workspaceId)}/${funnelId}/steps/${stepId}`,[m
[32m+[m[32m      { method: "DELETE" }[m
[32m+[m[32m    );[m
[32m+[m[32m  }[m
[32m+[m
[32m+[m[32m  async createFunnelEdge(workspaceId: string, funnelId: string, payload: CreateFunnelEdgePayload) {[m
[32m+[m[32m    const { edge } = await this.request<{ edge: FunnelEdge }>([m
[32m+[m[32m      `${this.funnelsBase(workspaceId)}/${funnelId}/edges`,[m
[32m+[m[32m      { method: "POST", body: payload }[m
[32m+[m[32m    );[m
[32m+[m[32m    return edge;[m
[32m+[m[32m  }[m
[32m+[m
[32m+[m[32m  async updateFunnelEdge([m
[32m+[m[32m    workspaceId: string,[m
[32m+[m[32m    funnelId: string,[m
[32m+[m[32m    edgeId: string,[m
[32m+[m[32m    payload: UpdateFunnelEdgePayload[m
[32m+[m[32m  ) {[m
[32m+[m[32m    const { edge } = await this.request<{ edge: FunnelEdge }>([m
[32m+[m[32m      `${this.funnelsBase(workspaceId)}/${funnelId}/edges/${edgeId}`,[m
[32m+[m[32m      { method: "PATCH", body: payload }[m
[32m+[m[32m    );[m
[32m+[m[32m    return edge;[m
[32m+[m[32m  }[m
[32m+[m
[32m+[m[32m  async deleteFunnelEdge(workspaceId: string, funnelId: string, edgeId: string): Promise<void> {[m
[32m+[m[32m    await this.request<{ deleted: true }>([m
[32m+[m[32m      `${this.funnelsBase(workspaceId)}/${funnelId}/edges/${edgeId}`,[m
[32m+[m[32m      { method: "DELETE" }[m
[32m+[m[32m    );[m
[32m+[m[32m  }[m
[32m+[m
[32m+[m[32m  /**[m
[32m+[m[32m   * Publishes the *saved* steps and edges as a new numbered revision. A graph[m
[32m+[m[32m   * that isn't publishable is a 422 whose `error.details[]` lists every problem[m
[32m+[m[32m   * as a `FunnelPublishProblem` (no entry step, unreachable steps, empty steps,[m
[32m+[m[32m   * upsell without an offer).[m
[32m+[m[32m   */[m
[32m+[m[32m  async publishFunnel(workspaceId: string, funnelId: string, note?: string) {[m
[32m+[m[32m    return this.request<PublishFunnelResult>([m
[32m+[m[32m      `${this.funnelsBase(workspaceId)}/${funnelId}/publish`,[m
[32m+[m[32m      { method: "POST", body: note ? { note } : {} }[m
[32m+[m[32m    );[m
[32m+[m[32m  }[m
[32m+[m
[32m+[m[32m  async listFunnelRevisions(workspaceId: string, funnelId: string) {[m
[32m+[m[32m    const { revisions } = await this.request<{ revisions: FunnelRevision[] }>([m
[32m+[m[32m      `${this.funnelsBase(workspaceId)}/${funnelId}/revisions`[m
[32m+[m[32m    );[m
[32m+[m[32m    return revisions;[m
[32m+[m[32m  }[m
[32m+[m
[32m+[m[32m  /** Points the live funnel back at an earlier revision. Draft steps are untouched. */[m
[32m+[m[32m  async rollbackFunnel(workspaceId: string, funnelId: string, revisionId: string) {[m
[32m+[m[32m    return this.request<{ funnel: Funnel; rolledBackTo: { id: string; revisionNumber: number } }>([m
[32m+[m[32m      `${this.funnelsBase(workspaceId)}/${funnelId}/revisions/${revisionId}/rollback`,[m
[32m+[m[32m      { method: "POST" }[m
[32m+[m[32m    );[m
[32m+[m[32m  }[m
[32m+[m
[32m+[m[32m  /** Only a funnel that has been published can be paused (409 FUNNEL_NOT_PUBLISHED). */[m
[32m+[m[32m  async pauseFunnel(workspaceId: string, funnelId: string) {[m
[32m+[m[32m    const { funnel } = await this.request<{ funnel: Funnel }>([m
[32m+[m[32m      `${this.funnelsBase(workspaceId)}/${funnelId}/pause`,[m
[32m+[m[32m      { method: "POST" }[m
[32m+[m[32m    );[m
[32m+[m[32m    return funnel;[m
[32m+[m[32m  }[m
[32m+[m
[32m+[m[32m  async resumeFunnel(workspaceId: string, funnelId: string) {[m
[32m+[m[32m    const { funnel } = await this.request<{ funnel: Funnel }>([m
[32m+[m[32m      `${this.funnelsBase(workspaceId)}/${funnelId}/resume`,[m
[32m+[m[32m      { method: "POST" }[m
[32m+[m[32m    );[m
[32m+[m[32m    return funnel;[m
[32m+[m[32m  }[m
[32m+[m
   // ---------------------------------------------------------------------[m
   // Workspace team — members, invites, roles[m
   // (auth, /workspaces/:workspaceId/members | /invites | /roles)[m
[36m@@ -662,6 +829,14 @@[m [mexport class ApiClient {[m
     return offers;[m
   }[m
 [m
[32m+[m[32m  /** One offer with its lines, whatever its status. 404 when it isn't in the workspace. */[m
[32m+[m[32m  async getOffer(workspaceId: string, offerId: string) {[m
[32m+[m[32m    const { offer } = await this.request<{ offer: Offer }>([m
[32m+[m[32m      `${this.catalogBase(workspaceId)}/offers/${offerId}`[m
[32m+[m[32m    );[m
[32m+[m[32m    return offer;[m
[32m+[m[32m  }[m
[32m+[m
   async createOffer(workspaceId: string, productId: string, payload: CreateOfferPayload) {[m
     const { offer } = await this.request<{ offer: Offer }>([m
       `${this.catalogBase(workspaceId)}/products/${productId}/offers`,[m
[36m@@ -1120,7 +1295,8 @@[m [mexport class ApiClient {[m
    */[m
   private async rawFetch(path: string, init: RequestInit): Promise<Response> {[m
     const doFetch = () => {[m
[31m-      const headers = new Headers(init.headers);[m
[32m+[m[32m      const headers = new Headers(this.defaultHeaders);[m
[32m+[m[32m      new Headers(init.headers).forEach((value, key) => headers.set(key, value));[m
       const { accessToken } = this.tokens;[m
       if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);[m
       return fetch(`${this.baseUrl}${path}`, { ...init, headers });[m
