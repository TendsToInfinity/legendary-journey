original logic - 
private validateSearch(search: Search): void {
    if (search.query && search.match) {
      throw Exception.InvalidData({
        errors: `Cannot search with both 'query' and 'match'.`,
      });
    }

    if (search.pageSize * search.pageNumber > 10000) {
      throw Exception.InvalidData({
        errors:
          'Too many records requested. Please refine your search criteria.',
      });
    }
  }


NEWlogic - 
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
        errors: 'Too many records requested. Please refine your search criteria.',
      });
    }
  }



  ====================================
  Catalog needs to have better monitoring.  We are pegging out containers and OpenSearch queries that are to large and are falling.   We should be able to monitor for this and determine when this happening and alert.   If any of the new monitoring works for other services we should consider adding that additional monitoring there as well. 



From Dan Wright on 4/23

Catalog service needs some love and attention.  Are you getting any media tickets bubbling up?  Catalog has been pegging out at max 300 containers for a while now.  Memcached cache access is timing out regularly.  

 Some of  the catalog searches need some attention as well.  They need to be converted to scroll queries because they are starting to return to many records in one answer.

 

{"log.level":"error","@timestamp":"2026-03-23T15:47:50.343Z","service.name":"catalog","service.version":"14.13.0","message":"search_phase_execution_exception: [illegal_argument_exception] Reason: Result window is too large, from + size must be less than or equal to: [10000] but was [10024]. See the scroll api for a more efficient way to request large data sets. This limit can be set by changing the [index.max_result_window] index level setting.","log.origin.file.name":"Middleware.js","log.origin.file.function":"ApiApplication.<anonymous>","log.origin.file.line":16,"error.stack_trace":"ResponseError: search_phase_execution_exception: [illegal_argument_exception] Reason: Result window is too large, from + size must be less than or equal to: [10000] but was [10024].



