
export interface StorageAdapter {
    pushEvent(event: any): Promise<void>;
    upsertRun(runData: any): Promise<void>;
    getRun(runId: string): Promise<any>;
}
