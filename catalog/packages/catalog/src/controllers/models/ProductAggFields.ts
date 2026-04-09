export interface ProductAggFields {
  fields: ProductAggField[];
}

export interface ProductAggField {
  name: string;
  path: string;
  values: any[];
}
