import { JwtType } from '@securustablets/libraries.httpsecurity';
import { SecurityFactory } from '@securustablets/libraries.utils-test';
import * as Bluebird from 'bluebird';
import { expect } from 'chai';
import * as faker from 'faker';
import * as sinon from 'sinon';
import * as request from 'supertest';
import { DistinctProductFieldPath } from '../../../src/controllers/models/Product';
import { DistinctProductValueDao } from '../../../src/data/PGCatalog/DistinctProductValueDao';
import { app } from '../../../src/main';
import { ModelFactory } from '../../utils/ModelFactory';
import { IntegrationTestSuite } from '../IntegrationTestSuite';
import '../global.spec';

describe('DistinctProductValueController - Integration', function () {
  IntegrationTestSuite.setUp(this);
  let testToken: string;
  let distinctProductValueDao: DistinctProductValueDao;

  before(async () => {
    testToken = await SecurityFactory.jwt(
      SecurityFactory.corpJwt({
        jwtType: JwtType.Corporate,
        username: 'testUser',
        permissions: ['catalogAdmin'],
      }),
    );
  });

  beforeEach(() => {
    distinctProductValueDao = new DistinctProductValueDao();
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('findOneOrFail', () => {
    it('should return a distinct product value ', async () => {
      const distinctProductValue =
        await distinctProductValueDao.createAndRetrieve(
          ModelFactory.distinctProductValue({ distinctProductValueId: 1 }),
          ModelFactory.auditContext(),
        );

      const res = await request(app)
        .get(
          `/distinctProductValues/${distinctProductValue.distinctProductValueId}`,
        )
        .set('Authorization', `Bearer ${testToken}`);

      expect(res.status).to.equal(200);
      expect(res.body.distinctProductValueId).to.deep.equal(
        distinctProductValue.distinctProductValueId,
      );
    });

    it('should get 404 if the product value is not found', async () => {
      return request(app)
        .get(`/distinctProductValues/${faker.random.number()}`)
        .set('Authorization', `Bearer ${testToken}`)
        .expect(404);
    });
  });

  describe('findByQueryString', () => {
    it('should return a distinct product values', async () => {
      const distinctProductValue1 =
        await distinctProductValueDao.createAndRetrieve(
          ModelFactory.distinctProductValue({ distinctProductValueId: 1 }),
          ModelFactory.auditContext(),
        );
      const distinctProductValue2 =
        await distinctProductValueDao.createAndRetrieve(
          ModelFactory.distinctProductValue({ distinctProductValueId: 2 }),
          ModelFactory.auditContext(),
        );

      const res = await request(app)
        .get(`/distinctProductValues`)
        .set('Authorization', `Bearer ${testToken}`);

      expect(res.status).to.equal(200);

      const result = res.body;
      expect(result.data.length).to.equal(2);
      expect(result.data[0].distinctProductValueId).to.deep.equal(
        distinctProductValue1.distinctProductValueId,
      );
      expect(result.data[1].distinctProductValueId).to.deep.equal(
        distinctProductValue2.distinctProductValueId,
      );
    });
  });

  describe('updateDistinctProductValue', () => {
    it('should update a distinct product value and send a message to rmq', async () => {
      const displayName = faker.random.word();
      let distinctProductValue = ModelFactory.distinctProductValue({
        fieldPath: DistinctProductFieldPath.Genres,
      });

      distinctProductValue = await distinctProductValueDao.createAndRetrieve(
        distinctProductValue,
        ModelFactory.auditContext(),
      );

      await request(app)
        .put(
          `/distinctProductValues/${distinctProductValue.distinctProductValueId}`,
        )
        .set('Authorization', `Bearer ${testToken}`)
        .send({ displayName: displayName })
        .then((response) => {
          expect(response.status).to.equal(200);
          expect(response.body.displayName).to.equal(displayName);
          expect(distinctProductValue.displayName).not.equal(
            response.body.displayName,
          );
        });

      await request(app)
        .get(
          `/distinctProductValues/${distinctProductValue.distinctProductValueId}`,
        )
        .set('Authorization', `Bearer ${testToken}`)
        .then((response) => {
          expect(response.status).to.equal(200);
          expect(response.body.distinctProductValueId).to.equal(
            distinctProductValue.distinctProductValueId,
          );
          expect(response.body.displayName).to.equal(displayName);
        });
      await Bluebird.delay(1000);
    });

    it('should get 404 if the product value is not found', async () => {
      const distinctProductValue = ModelFactory.distinctProductValue();

      return request(app)
        .put(
          `/distinctProductValues/${distinctProductValue.distinctProductValueId}`,
        )
        .set('Authorization', `Bearer ${testToken}`)
        .send(distinctProductValue)
        .expect(404);
    });
  });

  describe('bulkUpdateDistinctProductValue', () => {
    it('should update a distinct product value and send the message to the sqs queue alone, which is mocked', async () => {
      const displayName = faker.random.word();
      const distinctProductValues = await Promise.all([
        distinctProductValueDao.createAndRetrieve(
          ModelFactory.distinctProductValue({
            fieldPath: DistinctProductFieldPath.Genres,
            productTypeGroupId: 'music',
          }),
          ModelFactory.auditContext(),
        ),
        distinctProductValueDao.createAndRetrieve(
          ModelFactory.distinctProductValue({
            fieldPath: DistinctProductFieldPath.Genres,
            productTypeGroupId: 'music',
          }),
          ModelFactory.auditContext(),
        ),
      ]);

      await request(app)
        .put(`/distinctProductValues/bulk`)
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          data: {
            displayName: displayName,
          },
          ids: distinctProductValues.map(
            (distinctProductValue) =>
              distinctProductValue.distinctProductValueId,
          ),
        })
        .then((response) => {
          expect(response.status).to.equal(200);
          expect(response.body.data.length).to.equal(2);
          expect(response.body.data[0].displayName).to.equal(displayName);
          expect(response.body.data[1].displayName).to.equal(displayName);
        });

      for (const distinctProductValue of distinctProductValues) {
        await request(app)
          .get(
            `/distinctProductValues/${distinctProductValue.distinctProductValueId}`,
          )
          .set('Authorization', `Bearer ${testToken}`)
          .then((response) => {
            expect(response.status).to.equal(200);
            expect(response.body.distinctProductValueId).to.equal(
              distinctProductValue.distinctProductValueId,
            );
            expect(response.body.displayName).to.equal(displayName);
            expect(response.body.displayName).not.equal(
              distinctProductValue.displayName,
            );
          });
      }
      await Bluebird.delay(1000);
    });

    it('should update display name for all of the distinct product values', async () => {
      const displayName = faker.random.word();
      const distinctProductValues = await Promise.all([
        distinctProductValueDao.createAndRetrieve(
          ModelFactory.distinctProductValue({
            fieldPath: DistinctProductFieldPath.Genres,
            productTypeGroupId: 'music',
          }),
          ModelFactory.auditContext(),
        ),
        distinctProductValueDao.createAndRetrieve(
          ModelFactory.distinctProductValue({
            fieldPath: DistinctProductFieldPath.Genres,
            productTypeGroupId: 'music',
          }),
          ModelFactory.auditContext(),
        ),
        distinctProductValueDao.createAndRetrieve(
          ModelFactory.distinctProductValue({
            fieldPath: DistinctProductFieldPath.Genres,
            productTypeGroupId: 'music',
          }),
          ModelFactory.auditContext(),
        ),
      ]);

      await request(app)
        .put(`/distinctProductValues/bulk`)
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          data: {
            displayName: displayName,
          },
          ids: distinctProductValues.map(
            (distinctProductValue) =>
              distinctProductValue.distinctProductValueId,
          ),
        })
        .then((response) => {
          expect(response.status).to.equal(200);
          expect(response.body.data.length).to.equal(3);
          expect(response.body.data[0].displayName).to.equal(displayName);
          expect(response.body.data[1].displayName).to.equal(displayName);
          expect(response.body.data[2].displayName).to.equal(displayName);
        });

      for (const distinctProductValue of distinctProductValues) {
        await request(app)
          .get(
            `/distinctProductValues/${distinctProductValue.distinctProductValueId}`,
          )
          .set('Authorization', `Bearer ${testToken}`)
          .then((response) => {
            expect(response.status).to.equal(200);
            expect(response.body.distinctProductValueId).to.equal(
              distinctProductValue.distinctProductValueId,
            );
            expect(response.body.displayName).to.equal(displayName);
            expect(response.body.displayName).not.equal(
              distinctProductValue.displayName,
            );
          });
      }
      await Bluebird.delay(1000);
    });

    it('should get 404 if the product value is not found', async () => {
      const distinctProductValue = ModelFactory.distinctProductValue();

      return request(app)
        .put(`/distinctProductValues/bulk`)
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          data: {
            displayName: distinctProductValue.displayName,
          },
          ids: [distinctProductValue.distinctProductValueId],
        })
        .expect(404);
    });

    it('should throw a 400 if any of the dpvs submitted are for non-genre product fields', async () => {
      const genreDpv = await distinctProductValueDao.createAndRetrieve(
        ModelFactory.distinctProductValue({
          fieldPath: DistinctProductFieldPath.Genres,
          productTypeGroupId: 'music',
        }),
        { apiKey: 'test' },
      );
      const catDpv = await distinctProductValueDao.createAndRetrieve(
        ModelFactory.distinctProductValue({
          fieldPath: 'meta.categories',
          productTypeGroupId: 'music',
        }),
        { apiKey: 'test' },
      );

      await request(app)
        .put(`/distinctProductValues/bulk`)
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          data: {
            displayName: 'foobar',
          },
          ids: [genreDpv.distinctProductValueId, catDpv.distinctProductValueId],
        })
        .expect(400);
    });
  });
});
