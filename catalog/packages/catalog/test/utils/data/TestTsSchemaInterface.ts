export enum aStringEnum {
  Ferrari = 'ferrari',
  Porsche = 'porsche',
  Maserati = 'maserati',
  AstonMartin = 'astonMartin',
}

export enum aArrayEnum {
  Tiger = 'tiger',
  Lion = 'lion',
  Liger = 'liger',
}
export interface TestTsSchemaInterface {
  aBoolean: boolean;
  aEnumString: aStringEnum;
  /**
   * @autoComplete true
   */
  aEnumArray: aArrayEnum[];
  /**
   * @autoComplete true
   */
  aStringArray: string[];
  aTuple: ['rental'];
  aString: string;
  aNumber: number;
  aObject: {
    /**
     * @autoComplete true
     */
    aObjEnumString: aStringEnum;
    /**
     * @autoComplete true
     */
    aObjEnumArray: aArrayEnum;
    aObjTuple: ['rental'];
    aObjArrayObjects: ObjArray[];
    price: {
      /**
       * @autoComplete true
       */
      rental: number;
    };
  };
}

export interface ObjArray {
  /**
   * @autoComplete true
   */
  name: string;
  data: ObjArrayData[];
}

export interface ObjArrayData {
  foo: string;
  /**
   * @autoComplete true
   */
  bar: string[];
}
