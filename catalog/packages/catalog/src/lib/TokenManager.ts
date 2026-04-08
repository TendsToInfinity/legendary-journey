import { findPkgRootSync } from '@securustablets/libraries.utils';
import * as fs from 'fs-extra';
import * as jwt from 'jsonwebtoken';
import * as path from 'path';
import { Inject, Singleton } from 'typescript-ioc';
import { AppConfig } from '../utils/AppConfig';
import { PurchaseToken } from './models/PurchaseToken';

@Singleton
export class TokenManager {
  @Inject
  private config!: AppConfig;

  public async generateJwt(payload: PurchaseToken): Promise<string> {
    return jwt.sign(payload, await this.privateKey, {
      expiresIn: this.jwtExpiry,
      algorithm: 'RS256',
    });
  }

  private get privateKey(): Promise<string> {
    return fs.readFile(
      path.resolve(
        findPkgRootSync(__dirname),
        this.config.signedData.privateKey,
      ),
      'utf8',
    );
  }

  private get jwtExpiry(): string {
    return this.config.signedData.jwtExpiry;
  }
}
