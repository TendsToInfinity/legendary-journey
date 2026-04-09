import {
  Paginated,
  SearchParameters,
} from '@securustablets/libraries.postgres';
import { DeepPartial } from '@securustablets/libraries.utils';
import * as request from 'supertest';
import { BlockReason } from '../../src/controllers/models/BlockReason';
import { BlocklistTerm } from '../../src/controllers/models/BlocklistTerm';
import { DistinctProductValue } from '../../src/controllers/models/DistinctProductValue';
import { Product } from '../../src/controllers/models/Product';
import { app } from '../../src/main';

export interface ApiErrors {
  errors: any[];
}

export interface Options {
  unwrap?: boolean;
  statusCode?: number;
}

export interface NoUnwrap {
  unwrap: false;
  statusCode?: number;
}

export interface ExpectErrors {
  statusCode: 400 | 401 | 403 | 404 | 405 | 409 | 422 | 429 | 500 | 501 | 502;
}

export const urls = {
  bulk: () => '/test/bulk',
  clearCache: () => '/test/cache/clear',
  createProduct: () => '/products',
  updateProduct: (productId) => `/products/${productId}`,
  getProduct: (productId) => `/products/${productId}`,
  createBlockTerm: () => '/blocklistTerms',
  fbqsBlockTerms: () => '/blocklistTerms',
  fbqsBlockReasons: () => '/blockReasons',
  fbqsDpv: () => '/distinctProductValues',
  updateDpv: (id) => `/distinctProductValues/${id}`,
};

export function clearCache(): request.Test;
export function clearCache(): Promise<ApiErrors>;
export function clearCache(): Promise<any>;
export function clearCache(): Promise<any | ApiErrors> | request.Test {
  return unwrap<any>(
    { statusCode: 204 },
    request(app).get(urls.clearCache()).set('X-API-KEY', 'API_KEY_DEV'),
  );
}

export function bulk(data: Product[], options: NoUnwrap): request.Test;
export function bulk(
  data: Product[],
  options: ExpectErrors,
): Promise<ApiErrors>;
export function bulk(data: Product[], options?: Options): Promise<any>;
export function bulk(
  data: Product[],
  options?: Options,
): Promise<any | ApiErrors> | request.Test {
  return unwrap<any>(
    { statusCode: 204, ...options },
    request(app).post(urls.bulk()).send(data),
  );
}

export function createProduct(data: Product, options: NoUnwrap): request.Test;
export function createProduct(
  data: Product,
  options: ExpectErrors,
): Promise<ApiErrors>;
export function createProduct(
  data: Product,
  options?: Options,
): Promise<{ productId: number }>;
export function createProduct(
  data: Product,
  options?: Options,
): Promise<{ productId: number } | ApiErrors> | request.Test {
  return unwrap<any>(
    { statusCode: 200, ...options },
    request(app)
      .post(urls.createProduct())
      .set('X-API-KEY', 'API_KEY_DEV')
      .send(data),
  );
}

export function updateProduct(
  data: Product,
  options?: Options,
): Promise<{ productId: number } | ApiErrors> | request.Test {
  return unwrap<any>(
    { statusCode: 204, ...options },
    request(app)
      .put(urls.updateProduct(data.productId))
      .set('X-API-KEY', 'API_KEY_DEV')
      .send(data),
  );
}

export function getProduct(productId: number, options: NoUnwrap): request.Test;
export function getProduct(
  productId: number,
  options: ExpectErrors,
): Promise<ApiErrors>;
export function getProduct(
  productId: number,
  options?: Options,
): Promise<Product>;
export function getProduct(
  productId: number,
  options?: Options,
): Promise<Product | ApiErrors> | request.Test {
  return unwrap<any>(
    { statusCode: 200, ...options },
    request(app)
      .get(urls.getProduct(productId))
      .set('X-API-KEY', 'API_KEY_DEV'),
  );
}

export function createBlockTerm(
  terms: string[],
  productTypeGroupId: string,
  options: NoUnwrap,
): request.Test;
export function createBlockTerm(
  terms: string[],
  productTypeGroupId: string,
  options: ExpectErrors,
): Promise<ApiErrors>;
export function createBlockTerm(
  terms: string[],
  productTypeGroupId: string,
  options?: Options,
): Promise<Paginated<BlocklistTerm>>;
export function createBlockTerm(
  terms: string[],
  productTypeGroupId: string,
  options?: Options,
): Promise<Paginated<BlocklistTerm> | ApiErrors> | request.Test {
  return unwrap<any>(
    { statusCode: 200, ...options },
    request(app)
      .post(urls.createBlockTerm())
      .set('X-API-KEY', 'API_KEY_DEV')
      .send({ terms, productTypeGroupId }),
  );
}

export function fbqsBlockTerms(
  searchQuery: SearchParameters,
  options: NoUnwrap,
): request.Test;
export function fbqsBlockTerms(
  searchQuery: SearchParameters,
  options: ExpectErrors,
): Promise<ApiErrors>;
export function fbqsBlockTerms(
  searchQuery: SearchParameters,
  options?: Options,
): Promise<Paginated<BlocklistTerm>>;
export function fbqsBlockTerms(
  searchQuery: SearchParameters,
  options?: Options,
): Promise<Paginated<BlocklistTerm> | ApiErrors> | request.Test {
  return unwrap<any>(
    { statusCode: 200, ...options },
    request(app)
      .get(urls.fbqsBlockTerms())
      .query(searchQuery)
      .set('X-API-KEY', 'API_KEY_DEV'),
  );
}

export function fbqsBlockReasons(
  searchQuery: SearchParameters,
  options: NoUnwrap,
): request.Test;
export function fbqsBlockReasons(
  searchQuery: SearchParameters,
  options: ExpectErrors,
): Promise<ApiErrors>;
export function fbqsBlockReasons(
  searchQuery: SearchParameters,
  options?: Options,
): Promise<Paginated<BlockReason>>;
export function fbqsBlockReasons(
  searchQuery: SearchParameters,
  options?: Options,
): Promise<Paginated<BlockReason> | ApiErrors> | request.Test {
  return unwrap<any>(
    { statusCode: 200, ...options },
    request(app)
      .get(urls.fbqsBlockReasons())
      .query(searchQuery)
      .set('X-API-KEY', 'API_KEY_DEV'),
  );
}

export function fbqsDistinctProductValue(
  searchQuery: SearchParameters,
  options: NoUnwrap,
): request.Test;
export function fbqsDistinctProductValue(
  searchQuery: SearchParameters,
  options: ExpectErrors,
): Promise<ApiErrors>;
export function fbqsDistinctProductValue(
  searchQuery: SearchParameters,
  options?: Options,
): Promise<Paginated<DistinctProductValue>>;
export function fbqsDistinctProductValue(
  searchQuery: SearchParameters,
  options?: Options,
): Promise<Paginated<DistinctProductValue> | ApiErrors> | request.Test {
  return unwrap<any>(
    { statusCode: 200, ...options },
    request(app)
      .get(urls.fbqsDpv())
      .query(searchQuery)
      .set('X-API-KEY', 'API_KEY_DEV'),
  );
}

export function updateDistinctProductValue(
  dpvId: number,
  dpv: DeepPartial<DistinctProductValue>,
  options: NoUnwrap,
): request.Test;
export function updateDistinctProductValue(
  dpvId: number,
  dpv: DeepPartial<DistinctProductValue>,
  options: ExpectErrors,
): Promise<ApiErrors>;
export function updateDistinctProductValue(
  dpvId: number,
  dpv: DeepPartial<DistinctProductValue>,
  options?: Options,
): Promise<DistinctProductValue>;
export function updateDistinctProductValue(
  dpvId: number,
  dpv: DeepPartial<DistinctProductValue>,
  options?: Options,
): Promise<DistinctProductValue | ApiErrors> | request.Test {
  return unwrap<any>(
    { statusCode: 200, ...options },
    request(app)
      .put(urls.updateDpv(dpvId))
      .send(dpv)
      .set('X-API-KEY', 'API_KEY_DEV'),
  );
}

export function unwrap(options: NoUnwrap, req: request.Test): request.Test;
export function unwrap(
  options: ExpectErrors,
  req: request.Test,
): Promise<ApiErrors>;
export function unwrap<T>(options: Options, req: request.Test): Promise<T>;
export function unwrap<T>(
  options: Options,
  req: request.Test,
): request.Test | Promise<T | ApiErrors> {
  let result: request.Test | Promise<T | ApiErrors> = req;
  if (options.unwrap !== false) {
    if (options.statusCode) {
      result = req.expect(options.statusCode);
    }
    result = req.then((res) => res.body);
  }
  return result;
}
