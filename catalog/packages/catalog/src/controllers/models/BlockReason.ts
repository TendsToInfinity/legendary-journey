import { BlockAction, ManuallyBlockedReason } from './BlockAction';
import { BlocklistTerm } from './BlocklistTerm';

export interface BlockReason {
  blockReasonId?: number;
  productId: number;
  blockedByProduct?: number;
  termId?: number | null;
  term?: string | null;
  blockActionId?: number | null;
  manuallyBlockedReason?: ManuallyBlockedReason | null;
  isManuallyBlocked?: boolean | null;
  isActive: boolean;
  cdate?: string;
  udate?: string;
}

export interface BlockReasonConstruct {
  productId: number;
  blockAction?: BlockAction;
  blockedByProduct?: number;
  termData?: BlocklistTerm;
  isManuallyBlocked?: boolean;
}
