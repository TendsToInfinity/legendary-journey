if ((search.pageSize * search.pageNumber) + search.pageSize > 10000) 




private validateSearch(search: Search): void {
  if (search.query && search.match) {
    throw Exception.InvalidData({
      errors: `Cannot search with both 'query' and 'match'.`,
    });
  }

  const pageSize = search.pageSize || 25;
  const pageNumber = search.pageNumber || 0;

  if (
    !Number.isFinite(pageSize) ||
    !Number.isFinite(pageNumber) ||
    !Number.isInteger(pageSize) ||
    !Number.isInteger(pageNumber) ||
    pageSize <= 0 ||
    pageNumber < 0
  ) {
    throw Exception.InvalidData({
      errors:
        'Invalid pagination values. pageSize/pageNumber must be finite integers, with pageSize > 0 and pageNumber >= 0.',
    });
  }

  const from = pageSize * pageNumber;
  const resultWindow = from + pageSize;

  if (resultWindow > OpenSearchManager.MAX_RESULT_WINDOW) {
    throw Exception.InvalidData({
      errors:
        `Requested page exceeds OpenSearch result window (${OpenSearchManager.MAX_RESULT_WINDOW.toLocaleString()}). Please refine filters or use a scroll-based query.`,
    });
  }
}
