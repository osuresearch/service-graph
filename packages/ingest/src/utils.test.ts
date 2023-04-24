import { updateObjectByJSONPath } from "./utils";

describe('updateObjectByJSONPath', () => {
  test('updates a simple object property', () => {
    const obj: any = { a: 1 };
    updateObjectByJSONPath('$.a', obj, 2);
    expect(obj.a).toBe(2);
  });

  test('updates a nested object property', () => {
    const obj: any = { a: { b: 1 } };
    updateObjectByJSONPath('$.a.b', obj, 2);
    expect(obj.a.b).toBe(2);
  });

  test('updates an array element', () => {
    const obj: any = { a: [1, 2, 3] };
    updateObjectByJSONPath('$.a[1]', obj, 4);
    expect(obj.a[1]).toBe(4);
  });

  test('adds an array element', () => {
    const obj: any = { a: [1, 2, 3] };
    updateObjectByJSONPath('$.a[4]', obj, 4);
    expect(obj.a[4]).toBe(4);
  });

  test('adds a new property to an object', () => {
    const obj: any = { a: 1 };
    updateObjectByJSONPath('$.b', obj, 2);
    expect(obj.b).toBe(2);
  });

  test('adds a new nested property to an object', () => {
    const obj: any = { a: 1 };
    updateObjectByJSONPath('$.b.c', obj, 2);
    expect(obj.b.c).toBe(2);
  });

  test('parses a stringified JSON value', () => {
    const obj: any = { a: 1 };
    updateObjectByJSONPath('$.b', obj, '{"c": 2}');
    expect(obj.b.c).toBe(2);
  });
});
