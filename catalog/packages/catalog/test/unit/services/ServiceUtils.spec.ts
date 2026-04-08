import { expect } from 'chai';
import { Exception } from 'securus.tablets.libraries.exceptions';
import { ServiceUtils } from '../../../src/services/ServiceUtils';

describe('ServiceUtils - unit', () => {
  describe('passthroughAuthError', () => {
    it('should pass through auth error for 401', async () => {
      try {
        await ServiceUtils.passthroughAuthError<void>(async () => {
          throw Exception.Unauthorized({
            message: 'message',
            errors: 'errors',
            source: 'source',
          });
        });
        expect.fail();
      } catch (e) {
        expect(e.code).to.equal(401);
        expect(e.message).to.equal(
          'Unauthorized error received, forwarding this response ["errors"]',
        );
        expect(e.errors).to.deep.equal(['errors']);
      }
    });
    it('should not mutate misc errors', async () => {
      try {
        await ServiceUtils.passthroughAuthError<void>(async () => {
          throw Exception.InvalidData({
            message: 'message',
            errors: 'errors',
            source: 'source',
          });
        });
        expect.fail();
      } catch (e) {
        expect(e.code).to.equal(400);
        expect(e.message).to.equal('message ["errors"]');
        expect(e.errors).to.deep.equal(['errors']);
      }
    });
    it('should do nothing if no error', async () => {
      const result = await ServiceUtils.passthroughAuthError<string>(
        async () => 'This should work',
      );
      expect(result).to.equal('This should work');
    });
  });
});
