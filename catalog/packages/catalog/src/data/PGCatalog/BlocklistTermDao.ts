import { pga } from '@securustablets/libraries.audit-history';
import { PostgresDao } from '@securustablets/libraries.postgres';
import { BlocklistTerm } from '../../controllers/models/BlocklistTerm';
import { AuditContext } from '../../lib/models/AuditContext';

export class BlocklistTermDao extends PostgresDao<BlocklistTerm> {
  protected pga = pga<AuditContext, BlocklistTerm>(this);

  public findOneOrFail = this.pga.findOneOrFail();
  public find = this.pga.find();
  public createAndRetrieve = this.pga.createAndRetrieve();
  public findByQueryString = this.pga.findByQueryString();

  public async findByTerms(
    terms: string[],
    productTypeGroupId: string,
  ): Promise<BlocklistTerm[]> {
    return this.find({
      by: { productTypeGroupId },
      customClauses: [{ clause: `term = ANY($1::text[])`, params: [terms] }],
    });
  }

  public async setTermsStatus(
    ids: number[],
    enabled: boolean,
  ): Promise<BlocklistTerm[]> {
    return (
      await this.write(
        `UPDATE blocklist_term SET enabled = $1 WHERE blocklist_term_id = ANY($2::int[]) RETURNING *`,
        [enabled, ids],
      )
    ).rows;
  }

  public async findActiveByProductTypeGroupId(
    productTypeGroupId: string,
  ): Promise<BlocklistTerm[]> {
    return this.find({ by: { productTypeGroupId, enabled: true } });
  }
}
