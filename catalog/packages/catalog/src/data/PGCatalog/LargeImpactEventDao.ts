import { pga } from '@securustablets/libraries.audit-history';
import { PostgresDao } from '@securustablets/libraries.postgres';
import { LargeImpactEvent } from '../../controllers/models/LargeImpactEvent';
import { AuditContext } from '../../lib/models/AuditContext';
import { LargeImpactEventState } from './../../controllers/models/LargeImpactEvent';

export class LargeImpactEventDao extends PostgresDao<LargeImpactEvent> {
  protected pga = pga<AuditContext, LargeImpactEvent>(this);

  public createAndRetrieve = pga(this).createAndRetrieve();
  public updateAndRetrieve = pga(this).updateAndRetrieve();
  public findOneOrFail = pga(this).findOneOrFail();
  public find = pga(this).find();
  public findByQueryString = pga(this).findByQueryString();

  public async retrieveProcessableEvent(
    routingKey: string,
  ): Promise<LargeImpactEvent> {
    const queryResult = await this.write(
      `
            UPDATE large_impact_event
            SET state = $1
            WHERE large_impact_event_id = (
                SELECT large_impact_event_id
                FROM large_impact_event
                WHERE routing_key= $3 AND state = $2
                AND NOT EXISTS (SELECT large_impact_event_id
                    FROM large_impact_event
                    WHERE routing_key= $3 AND state = $1)
                ORDER BY cdate ASC
                LIMIT 1
            )
            RETURNING *;`,
      [
        LargeImpactEventState.Processing,
        LargeImpactEventState.Pending,
        routingKey,
      ],
    );
    return (await this.convertQueryResult(queryResult))?.[0];
  }

  public async setLastProcessedPage(
    lieId: number,
    lastPage: number,
  ): Promise<void> {
    const updateQuery = `
            UPDATE large_impact_event
            SET payload = jsonb_set(payload,'{lastPage}', $1)
            WHERE large_impact_event_id = $2
        `;
    await this.write(updateQuery, [lastPage, lieId]);
  }
}
