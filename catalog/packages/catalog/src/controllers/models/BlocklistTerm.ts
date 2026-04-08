export interface BlocklistTerm {
  blocklistTermId: number;
  term: string;
  enabled: boolean;
  productTypeGroupId: string;
  cdate?: string;
  udate?: string;
}

export interface CreateBlocklistTermsRequestBody {
  terms: string[];
  productTypeGroupId: string;
}

export interface DisableBlocklistTermsRequestBody {
  ids: number[];
}
