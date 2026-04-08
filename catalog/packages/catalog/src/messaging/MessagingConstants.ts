import { StandardMessagingConfigs } from '@securustablets/libraries.messaging';

/**
 * This file exists because when these constants were in MessagingConfig it caused a circular reference that Typescript IOC did not like.
 */
export class MessagingConstants {
  // rmq configs
  public static readonly EXCHANGE_ID =
    StandardMessagingConfigs.tabletServices.EXCHANGE_ID;
  public static readonly PUBLICATION_ID =
    StandardMessagingConfigs.tabletServices.PUBLICATION_ID;
  public static readonly QUEUE_ID = 'tablets.services.catalog';
  public static readonly BACKGROUND_QUEUE_ID =
    'tablets.services.catalog.background';

  public static readonly SUBSCRIPTION_ID =
    'tablets.services.catalog.subscription';

  // binding/routing keys
  public static readonly PRODUCT_UPSERT_REQUEST_ROUTING_KEY =
    'product.upsert.request';
  public static readonly SUBSCRIPTION_PRODUCT_REMOVED_ROUTING_KEY =
    'subscription.product.removed';
  public static readonly DISTINCT_PRODUCT_VALUE_UPDATED_ROUTING_KEY =
    'dpv.*.updated';
  public static readonly DISTINCT_PRODUCT_VALUE_UPDATED_PATTERN =
    /^dpv\.\w+\.updated$/;
  public static readonly CIDN_FULFILLMENT_UPDATE_KEY = 'cidn_order.updated'; // message from CIDN fulfillment
  public static readonly FUTURE_PRODUCT_CHANGE_REQUEST_ROUTING_KEY =
    'future.product.upsert.request';
  public static readonly LARGE_IMPACT_EVENT_PENDING_ROUTING_KEY =
    'large_impact_event.pending';
  public static readonly LARGE_IMPACT_EVENT_PROCESSING_ROUTING_KEY =
    'large_impact_event.processing';
  public static readonly LARGE_IMPACT_EVENT_COMPLETE_ROUTING_KEY =
    'large_impact_event.complete';
  public static readonly LEGACY_PRODUCT_INACTIVE_ROUTING_KEY =
    'legacy.product.inactive.ingested';
  public static readonly REDEEM_PRODUCT_REMOVED_ROUTING_KEY =
    'availability.redemption.productId.removed';

  // BG routing keys
  public static readonly BLOCK_ACTION_PENDING_ROUTING_KEY =
    'block_action.pending';
  public static readonly BLOCK_ACTION_LEGACY_ROUTING_KEY =
    'legacy.block_action.updated';

  // CDN Failure keys
  public static readonly CIDN_ORDER_PRODUCT_UNSUBSCRIBABLE =
    'cidn_order.product.unsubscribable';
  public static readonly CIDN_ORDER_PRODUCT_UNPURCHASABLE =
    'cidn_order.product.unpurchasable';

  // Order complete routing keys
  public static readonly ORDER_COMPLETE_PURCHASE_ROUTING_KEY =
    'order.digital.subscription.complete';
  public static readonly ORDER_COMPLETE_SUBSCRIPTION_ROUTING_KEY =
    'order.digital.purchase.complete';
  public static readonly ORDER_COMPLETE_RENTAL_ROUTING_KEY =
    'order.digital.rental.complete';
}
