import { Exception } from 'securus.tablets.libraries.exceptions';

export class ServiceUtils {
  public static async passthroughAuthError<T>(
    apiCall: () => Promise<T>,
  ): Promise<T> {
    try {
      return await apiCall();
    } catch (errorResponse) {
      if (errorResponse.code === 401) {
        throw Exception.Unauthorized({
          message: 'Unauthorized error received, forwarding this response',
          errors: errorResponse.errors,
          source: errorResponse.source,
        });
      } else {
        throw errorResponse;
      }
    }
  }
}
