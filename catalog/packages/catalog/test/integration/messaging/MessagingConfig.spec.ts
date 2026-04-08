import { PgSandbox } from '@securustablets/libraries.utils-test';
import * as ampq from 'amqplib';
import * as Bluebird from 'bluebird';
import { expect } from 'chai';
import * as sinon from 'sinon';
import { Container } from 'typescript-ioc';
import { ProductDao } from '../../../src/data/PGCatalog/ProductDao';
import { ProductTypeDao } from '../../../src/data/PGCatalog/ProductTypeDao';
import { MessagingConstants } from '../../../src/messaging/MessagingConstants';
import { AppConfig } from '../../../src/utils/AppConfig';
import { ModelFactory } from '../../utils/ModelFactory';
import { IntegrationTestSuite } from '../IntegrationTestSuite';
import '../global.spec';

describe('MessagingConfig - Integration', function () {
  IntegrationTestSuite.setUp(this);
  let amqpConnection: ampq.Connection;
  let amqpChannel: ampq.Channel;
  let productDao: ProductDao;
  let productTypeDao: ProductTypeDao;
  const pgSandbox = Container.get(PgSandbox);

  before(async () => {
    productDao = Container.get(ProductDao);
    productTypeDao = Container.get(ProductTypeDao);
    const rmqConfig = Container.get(AppConfig).rmq;
    amqpConnection = await ampq.connect(
      `amqp://${rmqConfig.user}:${rmqConfig.password}@${rmqConfig.host}`,
    );
    amqpChannel = await amqpConnection.createChannel();
    await amqpChannel.assertQueue(MessagingConstants.QUEUE_ID);
    await amqpChannel.assertQueue(MessagingConstants.SUBSCRIPTION_ID);
  });

  beforeEach(async () => {
    await pgSandbox.wipe();
  });

  after(async () => {
    amqpChannel.close();
    amqpConnection.close();
  });

  afterEach(() => {
    sinon.restore();
  });

  it('creates a product', async () => {
    const movieSchema = (await productTypeDao.findOneOrFail('movie'))
      .jsonSchema;

    const product = ModelFactory.productFromSchema(movieSchema);

    amqpChannel.publish(
      MessagingConstants.EXCHANGE_ID,
      MessagingConstants.PRODUCT_UPSERT_REQUEST_ROUTING_KEY,
      Buffer.from(JSON.stringify({ product })),
    );

    await Bluebird.delay(1000);

    const result = await productDao.findOneOrFail({
      contains: {
        source: {
          vendorName: product.source.vendorName,
          vendorProductId: product.source.vendorProductId,
        },
      },
    });

    expect(result.meta.name).to.equal(product.meta.name);
    expect(result.meta.description).to.equal(product.meta.description);
  });

  it('does nothing if a product already exists during creation', async () => {
    const movieSchema = (await productTypeDao.findOneOrFail('movie'))
      .jsonSchema;

    const product1 = ModelFactory.productFromSchema(movieSchema);
    product1.source.vendorParentProductId = undefined;

    const product2 = ModelFactory.productFromSchema(movieSchema, {
      source: product1.source,
    });

    await productDao.create(product1, {});

    amqpChannel.publish(
      MessagingConstants.EXCHANGE_ID,
      MessagingConstants.PRODUCT_UPSERT_REQUEST_ROUTING_KEY,
      Buffer.from(JSON.stringify({ product: product2 })),
    );

    await Bluebird.delay(500);

    const result = await productDao.findOneOrFail({
      contains: {
        source: {
          vendorName: product2.source.vendorName,
          vendorProductId: product2.source.vendorProductId,
        },
      },
    });

    expect(result.meta.name).to.equal(product1.meta.name);
    expect(result.meta.description).to.equal(product1.meta.description);
  });

  it("Waits for a parent to be created before creating a child and adds the child to the parent's childProductId array", async function () {
    this.timeout(20000);
    const trackSchema = (await productTypeDao.findOneOrFail('track'))
      .jsonSchema;
    const albumSchema = (await productTypeDao.findOneOrFail('album'))
      .jsonSchema;
    const parentProduct = ModelFactory.productFromSchema(
      albumSchema,
      { source: { vendorName: 'vendorName' } },
      ['productId'],
    );
    const childProduct = ModelFactory.productFromSchema(
      trackSchema,
      {
        source: {
          vendorName: 'vendorName',
          vendorParentProductId: parentProduct.source.vendorProductId,
        },
      },
      ['productId'],
    );

    amqpChannel.publish(
      MessagingConstants.EXCHANGE_ID,
      MessagingConstants.PRODUCT_UPSERT_REQUEST_ROUTING_KEY,
      Buffer.from(JSON.stringify({ product: childProduct })),
    );

    await Bluebird.delay(500);

    let childResult = await productDao.findOne({
      contains: {
        source: {
          vendorName: 'vendorName',
          vendorProductId: childProduct.source.vendorProductId,
        },
      },
    });

    expect(childResult).to.equal(undefined);

    amqpChannel.publish(
      MessagingConstants.EXCHANGE_ID,
      MessagingConstants.PRODUCT_UPSERT_REQUEST_ROUTING_KEY,
      Buffer.from(JSON.stringify({ product: parentProduct })),
    );

    await Bluebird.delay(18000);

    const parentResult = await productDao.findOneOrFail({
      contains: {
        source: {
          vendorName: 'vendorName',
          vendorProductId: parentProduct.source.vendorProductId,
        },
      },
    });
    childResult = await productDao.findOneOrFail({
      contains: {
        source: {
          vendorName: 'vendorName',
          vendorProductId: childProduct.source.vendorProductId,
        },
      },
    });

    expect(childResult.meta.name).to.equal(childProduct.meta.name);
    expect(childResult.meta.description).to.equal(
      childProduct.meta.description,
    );
    expect(parentResult.meta.name).to.equal(parentProduct.meta.name);
    expect(parentResult.meta.description).to.equal(
      parentProduct.meta.description,
    );
    expect(parentResult.childProductIds).to.deep.equal([childResult.productId]);
  });

  it('updates a product', async () => {
    const movieSchema = (await productTypeDao.findOneOrFail('movie'))
      .jsonSchema;

    const product = ModelFactory.productFromSchema(movieSchema, {
      source: { productTypeId: 'movie' },
    });

    await productDao.create(product, {});

    product.meta.name = product.meta.name + '!!!';

    amqpChannel.publish(
      MessagingConstants.EXCHANGE_ID,
      MessagingConstants.PRODUCT_UPSERT_REQUEST_ROUTING_KEY,
      Buffer.from(JSON.stringify({ product })),
    );

    await Bluebird.delay(500);

    const result = await productDao.findOneOrFail({
      contains: {
        source: {
          vendorName: product.source.vendorName,
          vendorProductId: product.source.vendorProductId,
        },
      },
    });

    expect(result.meta.name).to.equal(product.meta.name);
    expect(result.meta.description).to.equal(product.meta.description);
  });
});
