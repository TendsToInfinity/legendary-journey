import { expect } from 'chai';
import * as request from 'supertest';
import { app } from '../../../src/main';

describe('SchemaController - Integration', () => {
  it('should return the json schema from the respective interface mentioned in url', async () => {
    const expectedSchema = {
      type: 'object',
      properties: {
        customerId: {
          type: 'string',
        },
        siteId: {
          type: 'string',
        },
        inmateId: {
          type: 'string',
        },
        custodyAccount: {
          type: 'string',
        },
        callPartyId: {
          type: 'string',
        },
        purchaseType: {
          type: 'string',
        },
        purchaseCode: {
          type: 'string',
        },
        product: {
          type: 'object',
          properties: {
            productId: {
              type: 'number',
            },
            price: {
              type: 'number',
            },
            name: {
              type: 'string',
            },
            multipleSubscription: {
              type: 'boolean',
            },
            description: {
              type: 'string',
            },
            thumbnail: {
              type: 'string',
            },
            productType: {
              type: 'string',
            },
            productTypeGroupId: {
              type: 'string',
            },
            priceDetail: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  name: {
                    type: 'string',
                  },
                  amount: {
                    type: 'number',
                  },
                  type: {
                    enum: ['fee', 'price'],
                    type: 'string',
                  },
                },
                required: ['amount', 'name', 'type'],
              },
            },
            version: {
              type: 'number',
            },
            fulfillmentType: {
              type: 'string',
            },
            includedProductIds: {
              items: {
                type: 'number',
              },
              type: 'array',
            },
            billingInterval: {
              type: 'object',
              properties: {
                count: {
                  type: 'number',
                },
                interval: {
                  enum: ['days', 'weeks', 'months'],
                  type: 'string',
                },
              },
              required: ['count', 'interval'],
            },
          },
          required: [
            'description',
            'name',
            'price',
            'priceDetail',
            'productId',
            'productType',
            'productTypeGroupId',
            'thumbnail',
            'version',
          ],
        },
      },
      required: [
        'customerId',
        'product',
        'purchaseCode',
        'purchaseType',
        'siteId',
      ],
    };
    const result = await request(app)
      .get(`/schemas/PurchaseToken`)
      .set('x-api-key', 'API_KEY_DEV')
      .expect(200);
    expect(result.body).to.deep.equal(expectedSchema);
  });
  it('throws a 404 if the model is not valid', async () => {
    await request(app)
      .get(`/schemas/FakeModel`)
      .set('x-api-key', 'API_KEY_DEV')
      .expect(404);
  });
});
