import { BlocklistTerm } from './BlocklistTerm';

export enum BlockActionType {
  Add = 'add',
  Remove = 'remove',
}

export enum BlockActionBy {
  Terms = 'terms',
  Product = 'product',
  AutoReview = 'autoReview',
}

export enum BlockActionState {
  Applied = 'applied',
  Processing = 'processing',
  Pending = 'pending',
  Failed = 'failed',
}

export enum ManuallyBlockedReason {
  Explicit = 'explicit',
  AgencyRequested = 'agencyRequested',
  InappropriateArtist = 'inappropriateArtist',
  Nonstandard = 'nonstandard',
}

export interface BlockAction {
  blockActionId: number;
  type: BlockActionBy;
  blocklistTermIds?: number[];
  productId?: number;
  manuallyBlockedReason?: ManuallyBlockedReason;
  state: BlockActionState;
  action: BlockActionType;
  errorDescription?: string;
  cdate?: string;
  udate?: string;
}

// incorrectly named, this is a ManualBlockAction
export interface ManualBlockListRequestBody {
  manuallyBlockedReason?: ManuallyBlockedReason;
}

export interface LegacyAdditionalData {
  blocklistTerms?: BlocklistTerm[];
  productTypeId?: string;
  vendorProductId?: string;
}
export interface BlockActionLegacyMessage
  extends BlockAction,
    LegacyAdditionalData {}
