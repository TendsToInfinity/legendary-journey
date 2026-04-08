import { AuditHistory } from '@securustablets/libraries.audit-history';
import { InmateJwt } from '@securustablets/libraries.httpsecurity';
import { Schema, SpLite } from '@securustablets/libraries.json-schema';
import { DeepPartial, _ } from '@securustablets/libraries.utils';
import { SecurityFactory } from '@securustablets/libraries.utils-test';
import { Eligibility } from '@securustablets/services.eligibility.client';
import {
  Inmate,
  InmateVendor,
} from '@securustablets/services.inmate.client/dist/api';
import * as faker from 'faker';
import * as jsf from 'json-schema-faker';
import { QueryResult } from 'pg';
import { VideoRating } from '../../db/reference/MovieSchema';
import {
  BlockAction,
  BlockActionBy,
  BlockActionState,
  BlockActionType,
} from '../../src/controllers/models/BlockAction';
import { BlockReason } from '../../src/controllers/models/BlockReason';
import { BlocklistTerm } from '../../src/controllers/models/BlocklistTerm';
import { DistinctProductValue } from '../../src/controllers/models/DistinctProductValue';
import { Fee } from '../../src/controllers/models/Fee';
import {
  FutureProductChange,
  FutureState,
} from '../../src/controllers/models/FutureProductChange';
import {
  LargeImpactEvent,
  LargeImpactEventState,
} from '../../src/controllers/models/LargeImpactEvent';
import { LegacyApk } from '../../src/controllers/models/LegacyApk';
import { Package, PackageType } from '../../src/controllers/models/Package';
import {
  DigestProduct,
  PriceDetailType,
  PricedProduct,
  Product,
  ProductSales,
  ProductStatus,
  ProductTypeIds,
  VendorNames,
} from '../../src/controllers/models/Product';
import {
  ProductAvailabilityRule,
  ProductPriceRule,
  ProductSubscriptionAvailabilityRule,
  ProductTypeAvailabilityRule,
  ProductWebViewRule,
  Rule,
  RuleSet,
  RuleType,
} from '../../src/controllers/models/Rule';
import { TabletPackageFilter } from '../../src/controllers/models/TabletPackageFilter';
import { AuditContext } from '../../src/lib/models/AuditContext';
import { ProductType } from '../../src/lib/models/ProductType';
import { PurchaseToken } from '../../src/lib/models/PurchaseToken';
import { DpvCombination } from '../../src/messaging/lie/DistinctProductValueLie';
import { CidnMusicSharedOutput } from '../../src/messaging/models/CidnFulfillmentMessage';
import { Digest } from '../../src/models/Digest';
import {
  Order,
  OrderProduct,
  OrderPurchaseType,
  OrderState,
} from '../../src/models/Order';

export class ModelFactory {
  public static fakeProductTypes = faker.random.arrayElement<string>([
    'game',
    'movie',
    'tvEpisode',
    'album',
    'track',
  ]);
  public static fakeProductGroupIdTypes = faker.random.arrayElement<string>([
    'game',
    'music',
    'movie',
    'tv',
    'device',
  ]);

  public static httpsThumbnail = _.replace(
    faker.internet.url(),
    'http://',
    'https://',
  );

  public static fakeDistinctProductFieldPaths =
    faker.random.arrayElement<string>(['meta.categories', 'meta.genres']);

  public static auditContext(
    overrides: Partial<AuditContext> = {},
  ): AuditContext {
    return _.merge({ apiKey: 'TEST_API_KEY' }, overrides);
  }

  public static product(
    overrides: DeepPartial<Product> = <Product>{},
  ): Product {
    return _.mergeWith(
      <Product>{
        productId: faker.random.number(10000),
        productTypeId: 'movie',
        productTypeGroupId: 'movie',
        purchaseCode: 'VIDEO',
        purchaseTypes: ['rental', 'subscription', 'purchase'],
        fulfillmentType: 'digital',
        status: ProductStatus.Active,
        source: {
          vendorProductId: faker.random.alphaNumeric(10),
          vendorName: faker.random.word(),
          productTypeId: faker.random.word(),
        },
        meta: {
          name: faker.random.words(3),
          description: faker.random.words(15),
          compatibility: [],
          cameraRequired: faker.random.boolean(),
          thumbnail: faker.random.word(),
        },
        cdate: faker.date.past().toISOString(),
        udate: faker.date.recent().toISOString(),
        childProductIds: [],
      },
      overrides,
      ModelFactory.merge,
    );
  }

  public static activeMovie(
    overrides: DeepPartial<Product> = <Product>{},
  ): Product {
    return _.mergeWith(
      <Product>{
        productId: faker.random.number(10000),
        productTypeId: 'movie',
        productTypeGroupId: 'movie',
        purchaseCode: 'VIDEO',
        purchaseTypes: ['rental'],
        fulfillmentType: 'digital',
        status: ProductStatus.Active,
        source: {
          vendorProductId: faker.random.alphaNumeric(10),
          vendorName: faker.random.word(),
          productTypeId: faker.random.word(),
          url: faker.random.word(),
        },
        meta: {
          name: faker.random.words(3),
          description: faker.random.words(15),
          thumbnail: faker.random.word(),
          year: faker.random.number(2050).toString(),
          genres: [],
          length: faker.random.number(200),
          rating: faker.random.arrayElement([
            VideoRating.R,
            VideoRating.G,
            VideoRating.PG,
          ]),
          basePrice: {
            rental: faker.random.number(20),
          },
          directors: [],
          cast: [],
        },
        cdate: faker.date.past().toISOString(),
        udate: faker.date.recent().toISOString(),
        childProductIds: [],
      },
      overrides,
      ModelFactory.merge,
    );
  }

  public static productSales(
    overrides: DeepPartial<ProductSales> = <ProductSales>{},
  ): ProductSales {
    return _.mergeWith(
      <ProductSales>{
        productSalesId: faker.random.number(10000),
        productId: faker.random.number(10000),
        productTypeId: this.fakeProductTypes,
        productTypeGroupId: this.fakeProductGroupIdTypes,
        purchaseType: faker.random.arrayElement([
          'rental',
          'subscription',
          'purchase',
        ]),
        productName: faker.random.words(3),
        artistProductId: faker.random.number(1000),
        parentProductId: faker.random.number(1000),
        customerId: faker.random.alphaNumeric(6),
        year: faker.random.number(1000),
        month: faker.random.number(1000),
        day: faker.random.number(1000),
        completedOrders: faker.random.number(1000),
        cdate: faker.date.past().toISOString(),
        udate: faker.date.recent().toISOString(),
        version: faker.random.number(100),
      },
      overrides,
      ModelFactory.merge,
    );
  }

  public static productSubscription(
    overrides: DeepPartial<Product> = <Product>{},
  ): Product {
    return _.mergeWith(
      <Product>({
        productId: faker.random.number(10000),
        productTypeId: 'movieSubscription',
        productTypeGroupId: 'movie',
        purchaseCode: 'VIDEO',
        purchaseTypes: ['subscription'],
        status: ProductStatus.Active,
        subscribable: true,
        meta: {
          name: faker.random.words(3),
          description: faker.random.words(15),
          thumbnail: faker.random.word(),
          billingInterval: {
            count: 1,
            interval: 'months',
          },
          basePrice: {
            subscription: 12.99,
          },
        },
        source: {
          productTypeId: 'movieSubscription',
          vendorName: 'Test Vendor',
          vendorProductId: faker.random.number(10000).toString(),
        },
        cdate: faker.date.past().toISOString(),
        udate: faker.date.recent().toISOString(),
      } as unknown),
      overrides,
      ModelFactory.merge,
    );
  }

  public static pricedProduct(
    overrides: DeepPartial<PricedProduct> = {},
    amount?: number,
    purchaseType?: string,
  ): PricedProduct {
    amount = _.isNumber(amount)
      ? amount
      : parseFloat(faker.finance.amount(0.1, 10));
    purchaseType = purchaseType ? purchaseType : 'rental';
    return _.mergeWith(
      ModelFactory.product(),
      {
        purchaseOptions: [
          {
            type: purchaseType,
            totalPrice: amount,
            priceDetails: [
              { name: 'Price', amount, type: PriceDetailType.Price },
            ],
          },
        ],
      },
      overrides,
      ModelFactory.merge,
    );
  }

  public static WebViewProduct(
    overrides: DeepPartial<Product> = {},
    url?: string,
    displayPriority?: number,
  ): Product {
    (url = url ? url : faker.random.alphaNumeric(10)),
      (displayPriority = displayPriority
        ? displayPriority
        : faker.random.number({ min: 1, max: 20 }));
    return _.mergeWith(
      ModelFactory.product(),
      {
        meta: {
          webViewUrl: url,
          displayPriority: displayPriority,
        },
      },
      overrides,
      ModelFactory.merge,
    );
  }

  public static pricedPackageWithChildren(
    overrides: Partial<PricedProduct> = {},
    amount?: number,
  ): PricedProduct {
    return _.mergeWith(
      ModelFactory.pricedProduct(),
      {
        filter: { customerId: ['customerId'], siteId: ['siteId'] },
        meta: {
          type: 'subscriber',
        },
        childProducts: [
          ModelFactory.product({
            meta: { modelNumber: 'jp5', features: { camera: false } },
            fulfillmentType: 'physical',
            productTypeId: 'device',
          }),
          ModelFactory.product(),
        ],
      },
      overrides,
      ModelFactory.merge,
    );
  }

  public static productFromSchema(
    schema: Schema,
    overrides: any = {},
    ommissions: string[] = [],
  ): Product {
    return _.omit(
      _.mergeWith(
        jsf.generate(schema as Schema),
        {
          // override the productId because jsf creates crazy big negative floating points
          productId: faker.random.number(100000),
          // Default to PendingReview because Active status has additional custom validations associated with it.
          status: ProductStatus.PendingReview,
          source: {
            vendorProductId: faker.random.alphaNumeric(10),
          },
          childProductIds: [],
        },
        overrides,
        ModelFactory.merge,
      ),
      ommissions,
    ) as unknown as Product;
  }

  public static productType(
    overrides: Partial<ProductType> = <ProductType>{},
  ): ProductType {
    return _.mergeWith(
      {
        productTypeId: 'movie',
        productTypeGroupId: 'movie',
        purchaseCode: faker.random.alphaNumeric(7),
        purchaseTypes: ['rental'],
        jsonSchema: ModelFactory.testMovieSchema(),
        available: true,
        subscribable: false,
        cdate: faker.date.past().toISOString(),
        udate: faker.date.recent().toISOString(),
        meta: {
          globalAvailability: faker.random.boolean(),
          telemetry: faker.random.boolean(),
          displayName: faker.random.word(),
          autoIngest: faker.random.boolean(),
          restrictedAccess: faker.random.boolean(),
        },
      } as ProductType,
      overrides,
      ModelFactory.merge,
    );
  }

  public static productTypeAvailabilityRule(
    overrides?: Partial<ProductTypeAvailabilityRule>,
  ): ProductTypeAvailabilityRule {
    return _.mergeWith(
      this.rule({
        type: RuleType.ProductTypeAvailability,
        action: { available: faker.random.boolean() },
      }),
      overrides,
      ModelFactory.merge,
    );
  }

  public static tvShowAvailabilityRule(
    overrides?: Partial<ProductAvailabilityRule>,
  ): ProductAvailabilityRule {
    return _.mergeWith(
      this.productAvailabilityRule({
        productTypeId: 'tvShow',
      }),
      overrides,
      ModelFactory.merge,
    );
  }

  public static movieAvailabilityRule(
    overrides?: Partial<ProductAvailabilityRule>,
  ): ProductAvailabilityRule {
    return _.mergeWith(
      this.productAvailabilityRule({
        productTypeId: 'movie',
      }),
      overrides,
      ModelFactory.merge,
    );
  }

  public static gameAvailabilityRule(
    overrides?: Partial<ProductAvailabilityRule>,
  ): ProductAvailabilityRule {
    return _.mergeWith(
      this.productAvailabilityRule({
        productTypeId: 'game',
      }),
      overrides,
      ModelFactory.merge,
    );
  }

  public static productSubscriptionAvailability(
    overrides?: Partial<ProductTypeAvailabilityRule>,
  ): ProductTypeAvailabilityRule {
    return _.mergeWith(
      this.rule({
        type: RuleType.ProductSubscriptionAvailability,
        action: { available: faker.random.boolean() },
      }),
      overrides,
      ModelFactory.merge,
    );
  }

  public static productAvailabilityRule(
    overrides?: Partial<ProductAvailabilityRule>,
  ): ProductAvailabilityRule {
    return _.mergeWith(
      this.rule({
        type: RuleType.ProductAvailability,
        action: { available: faker.random.boolean() },
      }),
      overrides,
      ModelFactory.merge,
    );
  }

  public static productSubscriptionAvailabilityRule(
    overrides?: Partial<ProductSubscriptionAvailabilityRule>,
  ): ProductSubscriptionAvailabilityRule {
    return _.mergeWith(
      this.rule({
        type: RuleType.ProductSubscriptionAvailability,
        productId: faker.random.number(10000),
        action: { available: true },
      }),
      overrides,
      ModelFactory.merge,
    );
  }

  public static moviePriceRule(
    overrides?: Partial<ProductPriceRule>,
  ): ProductPriceRule {
    return _.mergeWith(
      this.productPriceRule({
        productTypeId: 'movie',
      }),
      overrides,
      ModelFactory.merge,
    );
  }

  public static productPriceRule(
    overrides?: Partial<ProductPriceRule>,
    purchaseType: string = 'rental',
    amount?: number,
  ): ProductPriceRule {
    return _.mergeWith(
      this.rule({
        type: RuleType.ProductPrice,
        action: {
          meta: {
            effectivePrice: {
              [purchaseType]: amount
                ? amount
                : faker.random.number({ min: 1, max: 20 }),
            },
          },
        },
      }),
      overrides,
      ModelFactory.merge,
    );
  }

  public static productWebViewRule(
    overrides?: Partial<ProductWebViewRule>,
  ): ProductWebViewRule {
    return _.mergeWith(
      this.rule({
        type: RuleType.ProductWebView,
      }),
      overrides,
      ModelFactory.merge,
    );
  }

  public static rule(overrides?: Partial<Rule>): Rule {
    return _.mergeWith(
      {
        productTypeId: 'movie',
        type: RuleType.ProductAvailability,
        name: faker.random.word(),
        clauses: {},
        enabled: true,
      },
      overrides,
      ModelFactory.merge,
    );
  }

  public static fee(overrides?: Partial<Fee>): Fee {
    return _.mergeWith(
      {
        feeId: faker.random.number(10000),
        productTypeId: 'movie',
        name: faker.random.alphaNumeric(8),
        amount: parseFloat(faker.finance.amount(0.6, 10)),
        percent: false,
        enabled: true,
        clauses: {},
      },
      overrides,
      ModelFactory.merge,
    );
  }

  public static queryResult(
    overrides: Partial<QueryResult> = {},
    numRows: number = 1,
    method: any = ModelFactory.product,
  ): QueryResult {
    return _.mergeWith(
      {
        command: 'SELECT',
        oid: 999,
        rows: _.range(numRows).map(() => method()),
        rowCount: numRows,
        fields: [],
      },
      overrides,
      ModelFactory.merge,
    );
  }

  public static auditHistory(overrides?: Partial<AuditHistory>): AuditHistory {
    return _.mergeWith(
      {
        auditHistoryId: faker.random.number(9999),
        action: faker.random.arrayElement(['CREATE', 'UPDATE', 'DELETE']),
        entityType: faker.random.word(),
        entityId: faker.random.alphaNumeric(20),
        document: { name: faker.random.word() },
        context: {
          customerId: faker.random.alphaNumeric(6),
          corpJwt: SecurityFactory.corpJwt(),
        },
        cdate: faker.date.past().toISOString(),
        udate: faker.date.recent().toISOString(),
      },
      overrides,
      ModelFactory.merge,
    );
  }

  public static purchaseToken(
    overrides: Partial<PurchaseToken> = {},
  ): PurchaseToken {
    const id =
      overrides.custodyAccount ||
      overrides.inmateId ||
      faker.random.alphaNumeric(18);
    return _.mergeWith(
      {
        customerId: faker.random.alphaNumeric(8),
        siteId: faker.random.alphaNumeric(5),
        inmateId: id,
        custodyAccount: id,
        callPartyId: faker.random.alphaNumeric(18),
        purchaseType: faker.random.arrayElement([
          'rental',
          'subscription',
          'purchase',
        ]),
        purchaseCode: faker.random.arrayElement([
          'VIDEO',
          'MUSIC',
          'GAME',
          'TABLET',
        ]),
        product: {
          productId: faker.random.number(),
          price: _.toNumber(faker.finance.amount()),
          name: faker.lorem.word(),
          thumbnail: faker.internet.url(),
          description: faker.random.words(3),
          productType: faker.random.arrayElement([
            'music',
            'tvSeason',
            'tvEpisode',
          ]),
          priceDetail: [
            /* TODO what do I do here */
          ],
          version: faker.random.number(200),
        },
      } as PurchaseToken,
      overrides,
      ModelFactory.merge,
    );
  }

  public static inmateFromJwt(
    jwt: InmateJwt,
    overrides?: Partial<Inmate>,
  ): Inmate {
    const inmate: Inmate = {
      custodyAccount: jwt.custodyAccount,
      firstName: jwt.firstName,
      lastName: jwt.lastName,
      customerId: jwt.customerId,
      siteId: jwt.siteId,
      active: faker.random.boolean(),
      source: {
        inmateId: faker.random.uuid(),
        name: InmateVendor.Sds,
      },
      custodyPin: faker.random.alphaNumeric(4),
      customerName: faker.random.alphaNumeric(20),
      siteName: faker.random.alphaNumeric(20),
    };
    return _.mergeWith(inmate, overrides, ModelFactory.merge);
  }

  public static defaultEligibility(
    overrides: DeepPartial<Eligibility> = <Eligibility>{},
  ): Eligibility {
    return _.mergeWith(
      {
        disableMediaPurchase: false,
        disableApps: [],
        disableSubscription: false,
      },
      overrides,
      ModelFactory.merge,
    );
  }

  public static distinctProductValue(
    overrides?: Partial<DistinctProductValue>,
  ): DistinctProductValue {
    return _.merge(
      {
        distinctProductValueId: faker.random.number(10000),
        fieldPath: ModelFactory.fakeDistinctProductFieldPaths,
        productTypeGroupId: ModelFactory.fakeProductGroupIdTypes,
        sourceValueName: faker.random.word(),
        displayName: faker.random.word(),
        cdate: faker.date.past().toISOString(),
        udate: faker.date.recent().toISOString(),
      },
      overrides,
    );
  }

  public static merge(
    objValue: any,
    srcValue: any,
    key,
    object,
    source,
    stack,
  ): any {
    if (Array.isArray(objValue)) {
      return srcValue;
    }
  }

  public static testMovieSchema(): any {
    return {
      type: 'object',
      properties: {
        enabled: {
          type: 'boolean',
        },
        productTypeId: {
          type: 'string',
          enum: ['movie'],
        },
        productTypeGroupId: {
          type: 'string',
          enum: ['movie'],
        },
        purchaseCode: {
          type: 'string',
          enum: ['VIDEO'],
        },
        purchaseTypes: {
          type: 'array',
          items: [
            {
              type: 'string',
              enum: ['rental'],
            },
          ],
          minItems: 1,
          additionalItems: {
            anyOf: [
              {
                type: 'string',
                enum: ['rental'],
              },
            ],
          },
        },
        vendorName: {
          type: 'string',
          enum: ['Swank'],
        },
        vendorProductId: {
          type: 'string',
        },
        sourceUrl: {
          type: 'object',
          properties: {
            video: {
              type: 'string',
            },
            audio: {
              type: 'string',
            },
            subtitle: {
              type: 'string',
            },
          },
          required: ['audio', 'subtitle', 'video'],
        },
        digest: {
          type: 'object',
          properties: {
            sales: {
              type: 'object',
              properties: {
                totalSales: {
                  type: 'number',
                },
              },
            },
          },
        },
        meta: {
          type: 'object',
          properties: {
            name: {
              type: 'string',
            },
            description: {
              longText: true,
              type: 'string',
            },
            thumbnail: {
              type: 'string',
            },
            year: {
              type: 'string',
            },
            genres: {
              autoComplete: true,
              type: 'array',
              items: {
                type: 'string',
              },
            },
            categories: {
              autoComplete: true,
              distinctValue: 'meta.categories',
              type: 'array',
              items: {
                type: 'string',
              },
            },
            cast: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  name: {
                    type: 'string',
                  },
                  roles: {
                    type: 'array',
                    items: {
                      type: 'string',
                    },
                  },
                },
                required: ['name', 'role'],
              },
            },
            director: {
              type: 'array',
              items: {
                type: 'string',
              },
            },
            rating: {
              autoComplete: true,
              enum: [
                'G',
                'NC-17',
                'NR',
                'PG',
                'PG-13',
                'R',
                'TV-17',
                'TV-Y',
                'TV-Y7',
                'TV-G',
                'TV-PG',
                'TV-14',
                'TV-MA',
              ],
              type: 'string',
            },
            length: {
              type: 'number',
            },
            basePrice: {
              type: 'object',
              properties: {
                rental: {
                  distinctValue: 'meta.basePrice.rental',
                  autoComplete: true,
                  type: 'number',
                },
              },
              required: ['rental'],
            },
            startDate: {
              type: 'string',
            },
            endDate: {
              type: 'string',
            },
          },
          required: [
            'category',
            'description',
            'genre',
            'length',
            'name',
            'rating',
            'thumbnail',
            'year',
          ],
        },
        productId: {
          type: 'number',
        },
        childProductIds: {
          type: 'array',
          items: {
            type: 'number',
          },
        },
        status: {
          enum: ['Active', 'Inactive', 'Deleted', 'PendingReview', 'Reingest'],
          type: 'string',
        },
        cdate: {
          type: 'string',
        },
        udate: {
          type: 'string',
        },
        subscribable: {
          type: 'boolean',
        },
        source: {
          type: 'object',
          properties: {
            genres: {
              distinctValue: 'meta.genres',
              type: 'array',
              items: {
                type: 'string',
              },
            },
          },
        },
      },
      required: [
        'cdate',
        'meta',
        'productId',
        'productTypeId',
        'productTypeGroupId',
        'purchaseCode',
        'purchaseTypes',
        'status',
        'udate',
        'vendorName',
        'vendorProductId',
      ],
      $schema: 'http://json-schema.org/draft-07/schema#',
    };
  }

  public static testSchema(overrides?: SpLite): SpLite {
    return _.mergeWith(
      {
        type: 'object',
        properties: {
          aBoolean: {
            type: 'boolean',
          },
          aEnumString: {
            enum: ['astonMartin', 'ferrari', 'maserati', 'porsche'],
            type: 'string',
          },
          aEnumArray: {
            autoComplete: true,
            type: 'array',
            items: {
              enum: ['liger', 'lion', 'tiger'],
              type: 'string',
            },
          },
          aStringArray: {
            autoComplete: true,
            type: 'array',
            items: {
              type: 'string',
            },
          },
          aTuple: {
            type: 'array',
            items: [
              {
                type: 'string',
                enum: ['rental'],
              },
            ],
            minItems: 1,
            additionalItems: {
              anyOf: [
                {
                  type: 'string',
                  enum: ['rental'],
                },
              ],
            },
          },
          aString: {
            type: 'string',
          },
          aNumber: {
            type: 'number',
          },
          aObject: {
            type: 'object',
            properties: {
              aObjEnumString: {
                autoComplete: true,
                enum: ['astonMartin', 'ferrari', 'maserati', 'porsche'],
                type: 'string',
              },
              aObjEnumArray: {
                autoComplete: true,
                enum: ['liger', 'lion', 'tiger'],
                type: 'string',
              },
              aObjTuple: {
                type: 'array',
                items: [
                  {
                    type: 'string',
                    enum: ['rental'],
                  },
                ],
                minItems: 1,
                additionalItems: {
                  anyOf: [
                    {
                      type: 'string',
                      enum: ['rental'],
                    },
                  ],
                },
              },
              aObjArrayObjects: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    name: {
                      autoComplete: true,
                      type: 'string',
                    },
                    data: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          foo: {
                            type: 'string',
                          },
                          bar: {
                            autoComplete: true,
                            type: 'array',
                            items: {
                              type: 'string',
                            },
                          },
                        },
                        required: ['bar', 'foo'],
                      },
                    },
                  },
                  required: ['data', 'name'],
                },
              },
              price: {
                type: 'object',
                properties: {
                  rental: {
                    autoComplete: true,
                    type: 'number',
                  },
                },
                required: ['rental'],
              },
            },
            required: [
              'aObjArrayObjects',
              'aObjEnumArray',
              'aObjEnumString',
              'aObjTuple',
              'price',
            ],
          },
        },
        required: [
          'aBoolean',
          'aEnumArray',
          'aEnumString',
          'aNumber',
          'aObject',
          'aString',
          'aStringArray',
          'aTuple',
        ],
        $schema: 'http://json-schema.org/draft-07/schema#',
      },
      overrides,
      ModelFactory.merge,
    );
  }

  public static blocklistTerm(
    override?: Partial<BlocklistTerm>,
  ): BlocklistTerm {
    return _.mergeWith(
      {
        term: faker.random.word(),
        enabled: true,
        productTypeGroupId: faker.random.arrayElement(_.values(ProductTypeIds)),
      },
      override,
      ModelFactory.merge,
    );
  }

  public static blockAction(override?: Partial<BlockAction>): BlockAction {
    return _.mergeWith(
      {
        type: BlockActionBy.Terms,
        action: BlockActionType.Add,
        state: BlockActionState.Pending,
      },
      override,
      ModelFactory.merge,
    );
  }

  public static blockReason(
    override?: Partial<BlockReason>,
    ommissions: string[] = [],
  ): BlockReason {
    return _.omit(
      _.mergeWith(
        {
          blockReasonId: faker.random.number(10000),
          productId: faker.random.number(10000),
          term: 'test',
          isActive: true,
        },
        override,
        ModelFactory.merge,
      ),
      ommissions,
    ) as unknown as BlockReason;
  }

  public static testAlbumSchema(): any {
    return {
      type: 'object',
      properties: {
        productTypeId: { type: 'string', enum: ['album'] },
        productTypeGroupId: { type: 'string', enum: ['music'] },
        purchaseCode: { type: 'string', enum: ['MUSIC'] },
        purchaseTypes: {
          type: 'array',
          items: [{ type: 'string', enum: ['purchase'] }],
          minItems: 1,
          additionalItems: { anyOf: [{ type: 'string', enum: ['purchase'] }] },
        },
        fulfillmentType: { type: 'string', enum: ['digital'] },
        status: {
          enum: ['Active', 'Deleted', 'Inactive', 'PendingReview', 'Reingest'],
          type: 'string',
        },
        subscribable: { enum: [false], type: 'boolean' },
        childProductIds: { type: 'array', items: { type: 'number' } },
        source: {
          type: 'object',
          properties: {
            vendorName: { keyField: true, type: 'string' },
            vendorProductId: { type: 'string' },
            productTypeId: { type: 'string' },
            ingestionBatchId: { type: 'string' },
            contentFeedVersion: { type: 'string' },
            wholesalePrice: { type: 'string' },
            msrp: { keyField: true, type: 'string' },
            upcs: { type: 'array', items: { type: 'string' } },
            assetCode: { type: 'string' },
            parentLabelCode: { type: 'string' },
            parentLabelName: { keyField: true, type: 'string' },
            albumArtUrl: { type: 'string' },
            copyright: { type: 'string' },
            genres: {
              distinctValue: 'meta.genres',
              type: 'array',
              items: { type: 'string' },
            },
          },
          required: [
            'msrp',
            'productTypeId',
            'vendorName',
            'vendorProductId',
            'wholesalePrice',
          ],
        },
        meta: {
          type: 'object',
          properties: {
            name: { keyField: true, requiredIfActive: true, type: 'string' },
            subTitle: { type: 'string' },
            description: { requiredIfActive: true, type: 'string' },
            thumbnail: { type: 'string' },
            genres: {
              autoComplete: true,
              requiredIfActive: true,
              keyField: true,
              type: 'array',
              items: { type: 'string' },
            },
            categories: {
              distinctValue: 'meta.categories',
              autoComplete: true,
              keyField: true,
              type: 'array',
              items: { type: 'string' },
            },
            length: { keyField: true, type: 'number' },
            basePrice: {
              type: 'object',
              properties: {
                purchase: {
                  distinctValue: 'meta.basePrice.purchase',
                  keyField: true,
                  autoComplete: true,
                  requiredIfActive: true,
                  type: 'number',
                },
              },
              required: ['purchase'],
            },
            startDate: { format: 'date', type: 'string' },
            endDate: { format: 'date', type: 'string' },
            releaseDate: { keyField: true, type: 'string' },
            explicit: { type: 'boolean' },
            artists: {
              keyField: true,
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  name: { keyField: true, type: 'string' },
                  role: { type: 'string' },
                  vendorArtistId: { type: 'string' },
                  vendorName: { type: 'string' },
                },
                required: ['name', 'role', 'vendorArtistId', 'vendorName'],
              },
            },
            rendition: { type: 'string' },
            thumbnailApproved: { type: 'string' },
          },
          required: ['artists', 'name'],
        },
        productId: { type: 'number' },
        requiredProductIds: {
          type: 'array',
          items: { type: 'number' },
        },
        cdate: { type: 'string' },
        udate: { type: 'string' },
      },
      required: [
        'fulfillmentType',
        'meta',
        'productTypeGroupId',
        'productTypeId',
        'purchaseCode',
        'purchaseTypes',
        'source',
        'status',
      ],
      $schema: 'http://json-schema.org/draft-07/schema#',
    };
  }

  public static futureProduct(
    overrides: DeepPartial<FutureProductChange> = {},
  ): FutureProductChange {
    return _.mergeWith(
      {
        productTypeId: faker.random.arrayElement<string>(['album', 'track']),
        vendorProductId: faker.random.alphaNumeric(10),
        actionDate: faker.date.past().toISOString(),
        vendorName: faker.random.word(),
        ingestionBatchId: faker.random.number(1000).toString(),
        action: {},
        state: faker.random.arrayElement<string>([
          FutureState.Pending,
          FutureState.Complete,
          FutureState.Error,
          FutureState.Processing,
        ]),
      },
      overrides,
      ModelFactory.merge,
    );
  }

  public static largeImpactEvent(
    overrides: DeepPartial<LargeImpactEvent> = {},
    ommissions: string[] = ['largeImpactId'],
  ): LargeImpactEvent {
    return _.omit(
      _.mergeWith(
        {
          largeImpactId: faker.random.number(1000),
          routingKey: faker.random.words(5).split(' ').join('.').toLowerCase(),
          payload: JSON.stringify({ prop: faker.random.words(10) }),
          state: LargeImpactEventState.Pending,
          cdate: faker.date.recent().toISOString(),
          udate: faker.date.recent().toISOString(),
          version: 0,
        },
        overrides,
        ModelFactory.merge,
      ),
      ommissions,
    ) as unknown as LargeImpactEvent;
  }

  public static dpvCombination(
    overrides: DeepPartial<DpvCombination> = {},
  ): DpvCombination {
    return _.mergeWith(
      {
        sourceValue: ['Indie Pop', 'Folk', 'Instrumental'],
        destinationValue: faker.random.arrayElement<string[]>([
          ['Pop', 'Folk', 'Instrumental'],
          ['Indie Pop', 'Folk New', 'Instrumental'],
        ]),
        fieldPath: 'meta.genres',
        fieldSourcePath: 'source.genres',
        productTypeGroupId: 'music',
      },
      overrides,
      ModelFactory.merge,
    );
  }

  public static package(overrides: DeepPartial<Package> = {}): Package {
    return _.mergeWith(
      {
        name: faker.internet.domainWord(),
        id: faker.random.number(1000).toString(),
        price: faker.finance.amount(),
        description: faker.lorem.words(),
        applications: [
          ModelFactory.legacyApk(),
          ModelFactory.legacyApk(),
          ModelFactory.legacyApk(),
        ],
        demo: faker.random.boolean(),
        modelNumber: faker.random.word(),
        type: faker.random.arrayElement(_.values(PackageType)),
        deviceFeatures: { camera: faker.random.boolean() },
        filters: ModelFactory.tabletPackageFilter(),
      },
      overrides,
      ModelFactory.merge,
    );
  }

  public static legacyApk(overrides: DeepPartial<LegacyApk> = {}): LegacyApk {
    return _.merge(
      {
        id: faker.random.number(1000).toString(),
        packageName: faker.internet.domainName(),
        category: faker.random.word(),
        name: faker.internet.domainWord(),
        description: faker.lorem.words(),
        isSystemApp: faker.random.boolean(),
        isPrivileged: faker.random.boolean(),
        postInstallCommand: faker.hacker.phrase(),
        allowAppManagement: faker.random.boolean(),
      },
      overrides,
    );
  }

  public static tabletPackageFilter(
    overrides: DeepPartial<TabletPackageFilter> = {},
  ): TabletPackageFilter {
    return _.mergeWith(
      {
        customerId: Array(3)
          .fill(null)
          .map(() => faker.random.alphaNumeric),
        siteId: Array(3)
          .fill(null)
          .map(() => faker.random.alphaNumeric),
        channel: Array(3)
          .fill(null)
          .map(() => faker.random.alphaNumeric),
      },
      overrides,
      ModelFactory.merge,
    );
  }

  public static cidnMusicSharedOutput(
    overrides: DeepPartial<CidnMusicSharedOutput> = {},
  ): CidnMusicSharedOutput {
    return _.mergeWith(
      {
        vendor: VendorNames.AudibleMagic,
        customerId: faker.random.word(),
        transactionId: faker.random.number(10).toString(),
        contentToDeliver: [
          {
            vendorProductId: faker.random.number(10000).toString(),
            fileName: `${faker.internet.url}.mp3`,
            s3Path: `${faker.internet.url}.mp3`,
          },
        ],
      },
      overrides,
      ModelFactory.merge,
    );
  }

  public static digest(overrides: DeepPartial<Digest> = {}): Digest {
    return _.mergeWith(
      {
        productId: faker.random.number(10000),
        ruleIds: [],
        availableGlobally: true,
        whitelist: [],
        blacklist: [],
        subscriptionProductIds: [],
        priceOverrides: [],
        webViewOverrides: [],
        sales: { totalSales: null },
      },
      overrides,
      ModelFactory.merge,
    );
  }

  public static ruleSet(overrides: DeepPartial<RuleSet> = {}): RuleSet {
    return _.mergeWith(
      {
        productTypeId: faker.random.word(),
        rules: [],
        context: { isGlobal: true },
      },
      overrides,
      ModelFactory.merge,
    );
  }

  public static digestProduct(
    overrides: DeepPartial<DigestProduct> = <DigestProduct>{},
  ): DigestProduct {
    return _.mergeWith(ModelFactory.product(), overrides, ModelFactory.merge);
  }

  public static defaultOpenSearchSortStatement() {
    return [{ 'digest.sales.totalSales': { order: 'DESC', missing: '_last' } }];
  }

  public static order(overrides: DeepPartial<Order> = {}): Order {
    return _.mergeWith(
      {
        orderId: faker.random.number(99999),
        parentOrderId: null,
        state: OrderState.Complete,
        isActive: true,
        customerId: faker.random.word(),
        siteId: faker.random.alphaNumeric(5),
        inmateId: faker.random.uuid(),
        custodyAccount: faker.random.uuid(),
        callPartyId: faker.random.alphaNumeric(18),
        purchaseType: OrderPurchaseType.Purchase,
        product: ModelFactory.orderProduct(),
        cdate: faker.date.past().toISOString(),
        udate: faker.date.recent().toISOString(),
      },
      overrides,
      ModelFactory.merge,
    );
  }

  public static orderProduct(overrides: DeepPartial<Order> = {}): OrderProduct {
    return _.mergeWith(
      {
        productId: faker.random.number(),
        productType: faker.random.arrayElement(['movie', 'game', 'track']),
        productTypeGroupId: faker.random.arrayElement([
          'movie',
          'game',
          'music',
        ]),
        price: faker.random.number(),
        name: faker.random.word(),
      },
      overrides,
      ModelFactory.merge,
    );
  }
}
