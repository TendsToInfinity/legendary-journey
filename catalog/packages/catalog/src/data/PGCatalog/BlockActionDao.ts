import { pga } from '@securustablets/libraries.audit-history';
import { PostgresDao } from '@securustablets/libraries.postgres';
import { BlockAction } from '../../controllers/models/BlockAction';
import { AuditContext } from '../../lib/models/AuditContext';

export class BlockActionDao extends PostgresDao<BlockAction> {
  protected pga = pga<AuditContext, BlockAction>(this);

  public findOneOrFail = this.pga.findOneOrFail();
  public createAndRetrieve = this.pga.createAndRetrieve();
  public findByQueryString = this.pga.findByQueryString();
  public update = this.pga.update();
}
