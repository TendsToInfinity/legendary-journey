// catalog/packages/catalog/test/unit/lib/OpenSearchManager.spec.ts

it('should throw an error if requested page exceeds OpenSearch result window', async () => {
  const search: Search = {
    pageSize: 5000,
    pageNumber: 3,
  };
  try {
    await openSearchManager.scrollSearch(productTypeId, search);
    expect.fail();
  } catch (error) {
    expect(error.code).to.equal(400);
    expect(error.errors).to.deep.equal([
      `Requested page exceeds OpenSearch result window (10,000). Please refine filters or use a scroll-based query.`,
    ]);
  }
});
