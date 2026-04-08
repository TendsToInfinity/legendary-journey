import { Search } from './Search';

export interface Homepage {
  homepageId?: number;
  version?: number;
  productTypeId: string;
  displayName: string;
  rank: number;
  search: Search;
  cdate?: string;
  udate?: string;
}
