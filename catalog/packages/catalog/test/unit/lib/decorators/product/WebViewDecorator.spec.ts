import { assert } from 'chai';
import { Exception } from 'securus.tablets.libraries.exceptions';
import * as sinon from 'sinon';
import { RuleType } from '../../../../../src/controllers/models/Rule';
import { WebViewDecorator } from '../../../../../src/lib/decorators/product/WebViewDecorator';
import { ModelFactory } from '../../../../utils/ModelFactory';

describe('WebViewDecorator - Unit', () => {
  let webViewDecorator: WebViewDecorator;
  let mockDigestManager: sinon.SinonMock;

  beforeEach(() => {
    webViewDecorator = new WebViewDecorator();
    mockDigestManager = sinon.mock((webViewDecorator as any).digestManager);
  });

  afterEach(() => {
    sinon.restore();
  });

  it('respects webView rule overrides', async () => {
    const products = [
      ModelFactory.WebViewProduct({
        productTypeId: 'webView',
        meta: {
          webViewUrl: 'test',
          displayPriority: 3,
        } as any,
      }),
    ];

    mockDigestManager
      .expects('getRulesByProductType')
      .withExactArgs({}, ['webView'], [RuleType.ProductWebView])
      .resolves([{}]);
    mockDigestManager
      .expects('getProductDigest')
      .withExactArgs([{}], products[0])
      .returns({
        webViewOverrides: {
          url: 'https://elves.com/noldor/feanor',
          displayPriority: 3,
        },
      });
    mockDigestManager
      .expects('getEffectiveUrlAndDisplayPriority')
      .withExactArgs(
        {},
        {
          webViewOverrides: {
            url: 'https://elves.com/noldor/feanor',
            displayPriority: 3,
          },
        },
      )
      .returns({ url: 'https://elves.com/noldor/feanor', displayPriority: 3 });
    await webViewDecorator.decorator(products, {});
    const actualResults = {
      data: products,
      total: 1,
      pageNumber: 0,
      pageSize: 25,
    };

    assert.deepEqual(actualResults.data[0].meta, {
      ...actualResults.data[0].meta,
      webViewUrl: 'https://elves.com/noldor/feanor',
      displayPriority: 3,
    });
  });

  it('throws an exception when url is undefined for a webView product', async () => {
    const products = [
      ModelFactory.WebViewProduct({
        productTypeId: 'webView',
        meta: {
          webViewUrl: 'test',
          displayPriority: 3,
        } as any,
      }),
    ];

    mockDigestManager
      .expects('getRulesByProductType')
      .withExactArgs({}, ['webView'], [RuleType.ProductWebView])
      .resolves([{}]);
    mockDigestManager
      .expects('getProductDigest')
      .withExactArgs([{}], products[0])
      .returns({
        webViewOverrides: {
          url: 'https://elves.com/noldor/feanor',
          displayPriority: 3,
        },
      });
    mockDigestManager
      .expects('getEffectiveUrlAndDisplayPriority')
      .withExactArgs(
        {},
        {
          webViewOverrides: {
            url: 'https://elves.com/noldor/feanor',
            displayPriority: 3,
          },
        },
      );

    try {
      await webViewDecorator.decorator(products, {});
      assert.fail();
    } catch (ex) {
      assert.equal(ex.name, Exception.NotFound.name, ex);
      assert.deepEqual(ex.errors, [
        `No webView rule url found matching context for the webView`,
      ]);
      sinon.verify();
    }
  });

  it('does nothing if rules[] is empty', async () => {
    const products = [
      ModelFactory.WebViewProduct({
        productTypeId: 'webView',
        meta: {
          webViewUrl: 'test',
          displayPriority: 3,
        } as any,
      }),
    ];

    mockDigestManager
      .expects('getRulesByProductType')
      .withExactArgs({}, ['webView'], [RuleType.ProductWebView])
      .resolves([]);
    mockDigestManager.expects('getProductDigest').never();
    mockDigestManager.expects('getEffectiveUrlAndDisplayPriority').never();
    await webViewDecorator.decorator(products, {});
    const actualResults = {
      data: products,
      total: 1,
      pageNumber: 0,
      pageSize: 25,
    };

    assert.deepEqual(actualResults.data[0].meta, {
      ...actualResults.data[0].meta,
      webViewUrl: 'test',
      displayPriority: 3,
    });
  });

  it('does nothing if webViewOverrides[] is empty', async () => {
    const products = [
      ModelFactory.WebViewProduct({
        productTypeId: 'webView',
        meta: {
          webViewUrl: 'test',
          displayPriority: 3,
        } as any,
      }),
    ];

    mockDigestManager
      .expects('getRulesByProductType')
      .withExactArgs({}, ['webView'], [RuleType.ProductWebView])
      .resolves([{}]);
    mockDigestManager
      .expects('getProductDigest')
      .withExactArgs([{}], products[0])
      .returns({ productId: products[0].productId });
    mockDigestManager.expects('getEffectiveUrlAndDisplayPriority').never();
    await webViewDecorator.decorator(products, {});
    const actualResults = {
      data: products,
      total: 1,
      pageNumber: 0,
      pageSize: 25,
    };

    assert.deepEqual(actualResults.data[0].meta, {
      ...actualResults.data[0].meta,
      webViewUrl: 'test',
      displayPriority: 3,
    });
  });
});
