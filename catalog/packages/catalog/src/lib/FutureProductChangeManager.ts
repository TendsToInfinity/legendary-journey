import { Inject, Singleton } from 'typescript-ioc';
import { FutureProductChange } from '../controllers/models/FutureProductChange';
import { FutureProductChangeDao } from '../data/PGCatalog/FutureProductChangeDao';
@Singleton
export class FutureProductChangeManager {
  @Inject
  private futureProductChangeDao!: FutureProductChangeDao;

  public update = this.futureProductChangeDao.update;
  public create = this.futureProductChangeDao.create;
  public productsToUpdateCount =
    this.futureProductChangeDao.productsToUpdateCount.bind(
      this.futureProductChangeDao,
    );
  public futureProductPerformChanges =
    this.futureProductChangeDao.futureProductPerformChanges.bind(
      this.futureProductChangeDao,
    );
  public findFutureProducts =
    this.futureProductChangeDao.findFutureProducts.bind(
      this.futureProductChangeDao,
    );

  public async findFutureProductChange(
    futureProductChange: FutureProductChange,
  ): Promise<FutureProductChange[]> {
    return await this.futureProductChangeDao.findFutureProductByVendorAndDate(
      futureProductChange.vendorProductId,
      futureProductChange.vendorName,
      futureProductChange.actionDate,
      futureProductChange.productTypeId,
      futureProductChange.ingestionBatchId,
    );
  }

  public async isProductsToUpdateExist(): Promise<boolean> {
    return this.futureProductChangeDao.exists({
      by: {
        state: 'pending',
      },
      customClauses: [
        {
          clause: `action_date <= CURRENT_DATE`,
          params: [],
        },
      ],
    });
  }
}
