export enum LargeImpactEventState {
  Pending = 'pending',
  Processing = 'processing',
  Complete = 'complete',
}

export interface LargeImpactEvent {
  largeImpactEventId?: number;
  routingKey: string;
  payload: any;
  state: LargeImpactEventState;
  cdate?: string;
  udate?: string;
  version?: number;
}
