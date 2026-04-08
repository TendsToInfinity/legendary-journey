import { pga } from '@securustablets/libraries.audit-history';
import { PostgresDao } from '@securustablets/libraries.postgres';
import { BlockReason } from '../../controllers/models/BlockReason';
import { AuditContext } from '../../lib/models/AuditContext';

export class BlockReasonDao extends PostgresDao<BlockReason> {
  protected pga = pga<AuditContext, BlockReason>(this);

  public findOneOrFail = this.pga.findOneOrFail();
  public createAndRetrieve = this.pga.createAndRetrieve();
  public findByQueryString = this.pga.findByQueryString();
  public find = this.pga.find();
  public update = this.pga.update();
  public create = this.pga.create();
}
