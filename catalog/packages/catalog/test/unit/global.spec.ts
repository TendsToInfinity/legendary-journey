import { glob } from 'glob';
import * as path from 'path';

// Make sure all files under src/ are included in coverage metrics.
before(async function () {
  this.timeout(10000);
  try {
    const searchPath = path.join(__dirname, '../../src/**/*.@(js|ts)');
    const files = await glob(searchPath);
    files.forEach(require);
  } catch (err) {
    console.error(err);
  }
});
