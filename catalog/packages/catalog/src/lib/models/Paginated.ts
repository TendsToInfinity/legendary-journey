/**
 * @tsoaModel
 * // TODO this should probably not be a tsoaModel, not entirely sure why it's redefined from the library
 */
export interface Paginated<T> {
  // TODO where should this really live? Consider OpenSearch as a plugin
  scrollId?: string;
  data: T[];
  pageSize?: number;
  pageNumber?: number;
  total?: number;
}
