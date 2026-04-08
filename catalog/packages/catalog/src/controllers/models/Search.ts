/**
 * @tsoaModel
 */
export interface Search {
  /**
   * General search term. This will be used to find relevant products according to an internal algorithm.
   */
  term?: string;
  /**
   * Find products of a particular productType that loosely match a passed in object.
   *
   * Queries may only be conducted against one productType at a time. To search against multiple productTypes,
   * consider instead using `match`.
   */
  query?: Query;
  /**
   * Find products that strictly match the passed in partial object(s).
   */
  match?: Match;
  context?: Context;
  /**
   * Default 0.
   * @minimum 0
   */
  pageNumber?: number;
  /**
   * Default 25.
   * @minimum 0
   * @maximum 1000
   */
  pageSize?: number;
  orderBy?: OrderBy | OrderBy[];
  /**
   * If set to true, return a total count of all matched products.
   */
  total?: boolean;
}

/**
 * @tsoaModel
 *
 * `clauses` are of the form {'foo.bar': 'value'}
 */
export interface Query {
  productTypeId: string;
  clauses: {
    [key: string]: Array<string | number | boolean>;
  };
}

/**
 * @tsoaModel
 *
 * Of the form {foo: {bar: 'value'}}
 */
export type Match = object | object[];

/**
 * @tsoaModel
 */
export interface Context {
  enforce?: boolean;
  customerId?: string;
  siteId?: string;
  productId?: string;
}

/**
 * Of the form {'meta.rating': 'DESC'}
 */
export interface OrderBy {
  [field: string]: 'ASC' | 'DESC' | 'EXPLICIT';
}

export interface QueryArgs {
  [key: string]: {
    idx: number;
    value: any[] | string | number | boolean;
  };
}
