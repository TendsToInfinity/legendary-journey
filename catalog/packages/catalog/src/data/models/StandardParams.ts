/**
 * Created by bstoddart on 7/14/2017.
 */

export interface IPageParams {
  page: number;
  pageSize: number;
}

export interface ISortParams {
  fieldName: string;
  direction: SortDirections;
}

export enum SortDirections {
  Ascending = <any>'asc',
  Descending = <any>'desc',
}
