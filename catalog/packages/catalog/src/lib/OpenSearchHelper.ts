export class OpenSearchHelper {
  /**
   * Returns index name based on product type identifier
   * @param productTypeId Product type identifier for desired index
   * @returns Index name (e.g. movie_main)
   */
  public static getIndexFromProductTypeId(productTypeId: string) {
    return `${productTypeId.toLowerCase()}_main`;
  }

  /**
   * Returns alias based on product type identifier
   * @param productTypeId Product type identifier for desired alias
   * @returns Alias name (e.g. movie_search)
   */
  public static getAliasFromProductTypeId(productTypeId: string): string {
    return `${productTypeId.toLowerCase()}_search`;
  }
}
