import { SvSecurityContext } from '@securustablets/libraries.httpsecurity';
import { Logger } from '@securustablets/libraries.logging';
import { MessagingManager } from '@securustablets/libraries.messaging';
import { _ } from '@securustablets/libraries.utils';
import * as Bluebird from 'bluebird';
import { Inject, Singleton } from 'typescript-ioc';
import {
  BlockAction,
  BlockActionBy,
  BlockActionLegacyMessage,
  BlockActionState,
  BlockActionType,
  LegacyAdditionalData,
} from '../controllers/models/BlockAction';
import { BlocklistTerm } from '../controllers/models/BlocklistTerm';
import { BlockActionDao } from '../data/PGCatalog/BlockActionDao';
import { BlockReasonDao } from '../data/PGCatalog/BlockReasonDao';
import { BlocklistTermDao } from '../data/PGCatalog/BlocklistTermDao';
import { MessagingConstants } from '../messaging/MessagingConstants';

@Singleton
export class BlocklistActionManager {
  @Inject
  private readonly logger!: Logger;
  @Inject
  private readonly blockActionDao!: BlockActionDao;
  @Inject
  private readonly blocklistTermDao!: BlocklistTermDao;
  @Inject
  private readonly blockReasonDao!: BlockReasonDao;
  @Inject
  private readonly messagingManager!: MessagingManager;

  private readonly chunkSize = 20;
  public getBlocklistTerm = this.blocklistTermDao.findOneOrFail;
  public getBlocklistTerms = this.blocklistTermDao.findByQueryString;
  public getBlockActions = this.blockActionDao.findByQueryString;
  public getBlockAction = this.blockActionDao.findOneOrFail;
  public getBlockReason = this.blockReasonDao.findOneOrFail;
  public getBlockReasons = this.blockReasonDao.findByQueryString;
  public updateBlockAction = this.blockActionDao.update;
  public findActiveByProductTypeGroupId =
    this.blocklistTermDao.findActiveByProductTypeGroupId.bind(
      this.blocklistTermDao,
    );

  public async createOrUpdateBlocklistTerms(
    blocklistTerms: string[],
    productTypeGroupId: string,
    securityContext: SvSecurityContext,
  ): Promise<BlocklistTerm[]> {
    const chunks = _.chunk(blocklistTerms, this.chunkSize);
    const data = await Bluebird.map(
      chunks,
      (chunk: string[]) =>
        this.upsertBlocklistTerms(chunk, productTypeGroupId, securityContext),
      { concurrency: 5 },
    );

    await Bluebird.map(
      // this is to flatten the array of arrays to get exact 20 per chunk
      _.chunk(_.flatten(data), this.chunkSize),
      async (blocklistTermsData: BlocklistTerm[]) => {
        const blockAction = {
          blocklistTermIds: blocklistTermsData.map((t) => t.blocklistTermId),
          type: BlockActionBy.Terms,
          action: BlockActionType.Add,
          state: BlockActionState.Pending,
        } as BlockAction;
        const legacyAdditionalData: LegacyAdditionalData = {
          blocklistTerms: blocklistTermsData,
        };
        await this.createAndPublish(
          blockAction,
          securityContext,
          legacyAdditionalData,
        );
      },
      { concurrency: 5 },
    );

    return _.flatten(data);
  }

  private async upsertBlocklistTerms(
    blocklistTerms: string[],
    productTypeGroupId: string,
    securityContext: SvSecurityContext,
  ): Promise<BlocklistTerm[]> {
    const existingBlocklistTerms: BlocklistTerm[] =
      await this.blocklistTermDao.findByTerms(
        blocklistTerms,
        productTypeGroupId,
      );
    const existingTerms: string[] = existingBlocklistTerms.map((t) => t.term);
    const notEnabledTermIds: number[] = existingBlocklistTerms
      .filter((t) => t.enabled !== true)
      .map((t) => t.blocklistTermId);

    // Enables existing terms instead of creating new ones
    let notEnabledTerms = [];
    if (!_.isEmpty(notEnabledTermIds)) {
      notEnabledTerms = await this.blocklistTermDao.setTermsStatus(
        notEnabledTermIds,
        true,
      );
    }

    let newBlocklistTerms: BlocklistTerm[] = [];
    const newTerms = _.difference(blocklistTerms, existingTerms);

    if (!_.isEmpty(newTerms)) {
      // create the new list of  blocklist terms
      newBlocklistTerms = await Bluebird.map(
        newTerms,
        async (term: string) => {
          const _blocklistTerm = {
            term,
            enabled: true,
            productTypeGroupId,
          } as BlocklistTerm;
          return this.blocklistTermDao.createAndRetrieve(
            _blocklistTerm,
            securityContext,
          );
        },
        { concurrency: 5 },
      );
    }

    return _.concat(notEnabledTerms, newBlocklistTerms);
  }

  public async create(
    blockAction: BlockAction,
    securityContext: SvSecurityContext,
  ): Promise<BlockAction> {
    return this.blockActionDao.createAndRetrieve(blockAction, securityContext);
  }

  public async createAndPublish(
    blockAction: BlockAction,
    securityContext: SvSecurityContext,
    legacyAdditionalData?: LegacyAdditionalData,
  ): Promise<void> {
    const action = await this.create(blockAction, securityContext);
    await this.publishBlocklistAction(action, legacyAdditionalData);
  }

  public async disableBlocklistTerms(
    blocklistTermIds: number[],
    securityContext: SvSecurityContext,
  ): Promise<BlocklistTerm[]> {
    const chunks = _.chunk(blocklistTermIds, this.chunkSize);
    const data = await Bluebird.map(
      chunks,
      (chunk: number[]) => this.blocklistTermDao.setTermsStatus(chunk, false),
      { concurrency: 5 },
    );

    await Bluebird.map(
      data,
      async (blocklistTerms: BlocklistTerm[]) => {
        const blockAction = {
          blocklistTermIds: blocklistTerms.map((t) => t.blocklistTermId),
          type: BlockActionBy.Terms,
          action: BlockActionType.Remove,
          state: BlockActionState.Pending,
        } as BlockAction;
        const legacyAdditionalData: LegacyAdditionalData = {
          blocklistTerms,
        };
        await this.createAndPublish(
          blockAction,
          securityContext,
          legacyAdditionalData,
        );
      },
      { concurrency: 5 },
    );

    return _.flatten(data);
  }

  /**
   * Enqueue an blockList Action to background process to add or remove blocks
   * @param blockAction BlockAction
   */
  public async publishBlocklistAction(
    blockAction: BlockAction,
    legacyAdditionalData?: LegacyAdditionalData,
  ): Promise<void> {
    await this.messagingManager.publish(
      MessagingConstants.PUBLICATION_ID,
      MessagingConstants.BLOCK_ACTION_PENDING_ROUTING_KEY,
      blockAction,
    );
    if (legacyAdditionalData)
      await this.notifyLegacySystem(blockAction, legacyAdditionalData);
  }

  /**
   * for legacy we need to send some extra params
   * for manual block - productTypeId
   * for terms - array of terms
   * @param blockAction
   * @param legacyAdditionalData
   */
  public async notifyLegacySystem(
    blockAction: BlockAction,
    legacyAdditionalData: LegacyAdditionalData,
  ): Promise<void> {
    const blockActionLegacyMessage: BlockActionLegacyMessage = {
      ...blockAction,
      ...legacyAdditionalData,
    };
    await this.messagingManager.publish(
      MessagingConstants.PUBLICATION_ID,
      MessagingConstants.BLOCK_ACTION_LEGACY_ROUTING_KEY,
      blockActionLegacyMessage,
    );
  }
}
