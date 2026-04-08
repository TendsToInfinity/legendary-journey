export interface ProductTypeAvailability {
  available: boolean;
  inherited: boolean;
  ruleId?: number;
  parent?: {
    available: boolean;
  };
}
