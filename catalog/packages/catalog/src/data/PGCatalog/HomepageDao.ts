import { pga } from '@securustablets/libraries.audit-history';
import { PostgresDao } from '@securustablets/libraries.postgres';
import { Homepage } from '../../controllers/models/Homepage';
import { AuditContext } from '../../lib/models/AuditContext';

export class HomepageDao extends PostgresDao<Homepage> {
  protected pga = pga<AuditContext, Homepage>(this);

  public findOneOrFail = this.pga.findOneOrFail();
  public find = this.pga.find();
  public update = this.pga.update();
  public delete = this.pga.delete();
  public create = this.pga.create();
}
