export interface DistinctProductValue {
  distinctProductValueId: number;
  fieldPath: string;
  productTypeGroupId: string;
  sourceValueName: string;
  displayName: string;
  cdate?: string;
  udate?: string;
}

export interface EditableDistinctProductValueFields {
  displayName: string;
}

export interface DistinctProductValueUpdateResult {
  new: DistinctProductValue;
  old: DistinctProductValue;
}

export interface BulkDvt {
  data: EditableDistinctProductValueFields;
  ids: number[];
}
